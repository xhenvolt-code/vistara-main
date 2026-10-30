"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";

function formString(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function optionalInteger(value, minimum, maximum) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : Number.NaN;
}

async function requireAdmin() {
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    throw new Error("Administrator access is required.");
  }

  return access;
}

function prismaMessage(error, fallback) {
  if (error?.code === "P2002") {
    return "That name or slug is already in use.";
  }

  if (error?.code === "P2025") {
    return "The selected record no longer exists. Refresh and try again.";
  }

  return fallback;
}

const movieSchema = z.object({
  id: z.string().max(100),
  title: z.string().min(2).max(160),
  slug: z.string().min(2).max(180),
  synopsis: z.string().max(5000),
  director: z.string().max(160),
  cast: z.array(z.string().min(1).max(100)).max(30),
  contentRating: z.string().max(30),
  releaseYear: z.number().int().min(1888).max(2200).optional(),
  runtimeMinutes: z.number().int().min(1).max(1000).optional(),
  language: z.string().max(80),
  posterUrl: z.union([
    z.literal(""),
    z.string().url().max(2048),
    z.string().regex(/^\/api\/media\/artwork\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/i),
  ]),
  backdropUrl: z.union([
    z.literal(""),
    z.string().url().max(2048),
    z.string().regex(/^\/api\/media\/artwork\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/i),
  ]),
  status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"]),
  rightsStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  rightsSource: z.string().max(500),
  genres: z.array(z.string().min(1).max(60)).max(12),
});

export async function saveMovie(_previousState, formData) {
  const access = await requireAdmin();
  const title = formString(formData, "title");
  const requestedSlug = formString(formData, "slug");
  const genreNames = [
    ...new Set(
      formString(formData, "genres")
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean),
    ),
  ];
  const castNames = [
    ...new Set(
      formString(formData, "cast")
        .split(",")
        .map((person) => person.trim())
        .filter(Boolean),
    ),
  ];
  const parsed = movieSchema.safeParse({
    id: formString(formData, "id"),
    title,
    slug: slugify(requestedSlug || title),
    synopsis: formString(formData, "synopsis"),
    director: formString(formData, "director"),
    cast: castNames,
    contentRating: formString(formData, "contentRating"),
    releaseYear: optionalInteger(formString(formData, "releaseYear"), 1888, 2200),
    runtimeMinutes: optionalInteger(
      formString(formData, "runtimeMinutes"),
      1,
      1000,
    ),
    language: formString(formData, "language"),
    posterUrl: formString(formData, "posterUrl"),
    backdropUrl: formString(formData, "backdropUrl"),
    status: formString(formData, "status"),
    rightsStatus: formString(formData, "rightsStatus"),
    rightsSource: formString(formData, "rightsSource"),
    genres: genreNames,
  });

  if (!parsed.success) {
    return {
      error:
        "Check the title, year, runtime, media URLs, rights fields, and comma-separated genres.",
    };
  }

  const data = parsed.data;
  if (!data.slug) {
    return { error: "Enter a title with at least one letter or number." };
  }

  if (data.rightsStatus === "APPROVED" && !data.rightsSource) {
    return { error: "Record the rights source before approving distribution." };
  }

  if (
    data.status === "PUBLISHED" &&
    (data.rightsStatus !== "APPROVED" || !data.rightsSource || !data.id)
  ) {
    return {
      error:
        "A movie needs approved rights, a recorded rights source, and a verified uploaded video before publishing.",
    };
  }

  if (data.status === "PUBLISHED") {
    const readyAsset = await prisma.videoAsset.findFirst({
      where: {
        movieId: data.id,
        status: "READY",
        provider: "NEON_OBJECT_STORAGE",
        contentType: "video/mp4",
        fileSizeBytes: { not: null },
      },
      select: { id: true },
    });

    if (!readyAsset) {
      return {
        error:
          "Upload and verify a video in this movie's workspace before publishing.",
      };
    }
  }

  const now = new Date();

  try {
    const movieId = await prisma.$transaction(async (tx) => {
      let movie;
      const currentMovie = data.id
        ? await tx.movie.findUnique({
            where: { id: data.id },
            select: {
              rightsStatus: true,
              rightsReviewedAt: true,
              publishedAt: true,
            },
          })
        : null;
      if (data.status === "PUBLISHED") {
        const readyAsset = await tx.videoAsset.findFirst({
          where: {
            movieId: data.id,
            status: "READY",
            provider: "NEON_OBJECT_STORAGE",
            contentType: "video/mp4",
            fileSizeBytes: { not: null },
          },
          select: { id: true },
        });

        if (!readyAsset) {
          throw new Error(
            "A movie needs a verified uploaded video before it can be published.",
          );
        }
      }
      const movieData = {
        title: data.title,
        slug: data.slug,
        synopsis: data.synopsis || null,
        director: data.director || null,
        cast: data.cast,
        contentRating: data.contentRating || null,
        releaseYear: data.releaseYear,
        runtimeMinutes: data.runtimeMinutes,
        language: data.language || null,
        posterUrl: data.posterUrl || null,
        backdropUrl: data.backdropUrl || null,
        status: data.status,
        rightsStatus: data.rightsStatus,
        rightsSource: data.rightsSource || null,
        rightsReviewedAt:
          data.rightsStatus === "PENDING"
            ? null
            : currentMovie?.rightsStatus === data.rightsStatus
              ? currentMovie.rightsReviewedAt
              : now,
        isFeatured: formData.get("isFeatured") === "on",
        publishedAt:
          data.status !== "PUBLISHED"
            ? null
            : currentMovie?.publishedAt ?? now,
      };

      if (data.id) {
        movie = await tx.movie.update({
          where: { id: data.id },
          data: movieData,
        });
        await tx.movieGenre.deleteMany({ where: { movieId: movie.id } });
      } else {
        movie = await tx.movie.create({ data: movieData });
      }

      for (const name of data.genres) {
        const slug = slugify(name);

        if (!slug) {
          throw new Error("Each genre must contain letters or numbers.");
        }

        const genre = await tx.genre.upsert({
          where: { slug },
          create: { name, slug },
          update: {},
        });
        await tx.movieGenre.create({
          data: { movieId: movie.id, genreId: genre.id },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: data.id ? "catalogue.movie.updated" : "catalogue.movie.created",
          entityType: "Movie",
          entityId: movie.id,
          metadata: {
            status: data.status,
            rightsStatus: data.rightsStatus,
            genreCount: data.genres.length,
            castCount: data.cast.length,
          },
        },
      });

      return movie.id;
    });

    revalidatePath("/admin");
    revalidatePath("/admin/catalogue");
    revalidatePath("/admin/movies");
    revalidatePath(`/admin/movies/${movieId}`);
    revalidatePath("/movies");
    revalidatePath(`/movies/${data.slug}`);
    return { success: `Saved ${data.title}.`, movieId };
  } catch (error) {
    if (error?.code === "P2002" || error?.code === "P2025") {
      return { error: prismaMessage(error, "Unable to save this movie.") };
    }
    if (
      error instanceof Error &&
      error.message ===
        "A movie needs a verified uploaded video before it can be published."
    ) {
      return { error: error.message };
    }

    console.error("Admin movie save failed.", {
      actorId: access.userId,
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    return { error: "Unable to save this movie. Review the fields and try again." };
  }
}

const productSchema = z.object({
  id: z.string().max(100),
  name: z.string().min(2).max(100),
  durationDays: z.number().int().min(1).max(3650),
  priceUgx: z.number().int().min(500).max(10_000_000),
  sortOrder: z.number().int().min(0).max(100_000),
});

export async function saveAccessProduct(_previousState, formData) {
  const access = await requireAdmin();
  const parsed = productSchema.safeParse({
    id: formString(formData, "id"),
    name: formString(formData, "name"),
    durationDays: Number(formString(formData, "durationDays")),
    priceUgx: Number(formString(formData, "priceUgx")),
    sortOrder: Number(formString(formData, "sortOrder") || "0"),
  });

  if (!parsed.success) {
    return {
      error: "Enter a unique name, 1–3650 days, a price of UGX 500–10,000,000, and a valid order.",
    };
  }

  const data = parsed.data;
  const isAvailable = formData.get("isAvailable") === "on";

  try {
    await prisma.$transaction(async (tx) => {
      const { id, ...productData } = data;
      const product = id
        ? await tx.accessProduct.update({
            where: { id },
            data: { ...productData, isAvailable },
          })
        : await tx.accessProduct.create({
            data: { ...productData, isAvailable },
          });

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: id ? "product.updated" : "product.created",
          entityType: "AccessProduct",
          entityId: product.id,
          metadata: {
            priceUgx: product.priceUgx,
            durationDays: product.durationDays,
            isAvailable: product.isAvailable,
          },
        },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/admin/products");
    revalidatePath("/passes");
    return { success: `Saved ${data.name}.` };
  } catch (error) {
    if (error?.code === "P2002" || error?.code === "P2025") {
      return { error: prismaMessage(error, "Unable to save this product.") };
    }

    console.error("Admin access product save failed.", {
      actorId: access.userId,
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    return { error: "Unable to save this access product. Try again." };
  }
}

const userStatusSchema = z.object({
  userId: z.string().min(1).max(100),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export async function updateUserStatus(_previousState, formData) {
  const access = await requireAdmin();

  if (access.role !== "superadmin") {
    return { error: "Only a superadmin can change account status." };
  }

  const parsed = userStatusSchema.safeParse({
    userId: formString(formData, "userId"),
    status: formString(formData, "status"),
  });

  if (!parsed.success) {
    return { error: "Choose a valid user and account status." };
  }

  const target = await prisma.userProfile.findUnique({
    where: { userId: parsed.data.userId },
    select: { email: true },
  });
  const superadmins = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!target) {
    return { error: "User profile not found." };
  }

  if (target.email && superadmins.includes(target.email.toLowerCase())) {
    return { error: "A superadmin account cannot be suspended here." };
  }

  await prisma.$transaction([
    prisma.userProfile.update({
      where: { userId: parsed.data.userId },
      data: { accountStatus: parsed.data.status },
    }),
    prisma.auditLog.create({
      data: {
        actorId: access.userId,
        action: "user.account_status.updated",
        entityType: "UserProfile",
        entityId: parsed.data.userId,
        metadata: { status: parsed.data.status },
      },
    }),
  ]);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: "Account status updated." };
}
