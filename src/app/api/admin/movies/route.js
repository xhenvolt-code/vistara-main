import { z } from "zod";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";

const createMovieSchema = z.object({
  title: z.string().trim().min(2).max(160),
});

function isSameOrigin(request) {
  const appBaseUrl = process.env.APP_BASE_URL;
  const origin = request.headers.get("origin");

  if (!appBaseUrl || !origin) {
    return false;
  }

  return new URL(appBaseUrl).origin === origin;
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return Response.json(
      { error: "Administrator access is required." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }
    throw error;
  }

  const parsed = createMovieSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Enter a movie title between 2 and 160 characters." },
      { status: 400 },
    );
  }

  const slug = slugify(parsed.data.title);
  if (!slug) {
    return Response.json(
      { error: "Enter a title containing letters or numbers." },
      { status: 400 },
    );
  }

  try {
    const movie = await prisma.$transaction(async (tx) => {
      const createdMovie = await tx.movie.create({
        data: { title: parsed.data.title, slug },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "catalogue.movie.created",
          entityType: "Movie",
          entityId: createdMovie.id,
          metadata: { status: "DRAFT", creationFlow: "direct_video_upload" },
        },
      });

      return createdMovie;
    });

    return Response.json(
      { movieId: movie.id },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error?.code === "P2002") {
      return Response.json(
        { error: "A movie with this title already exists. Add a distinguishing detail to the title." },
        { status: 409 },
      );
    }

    console.error("Could not create a movie draft for video upload.", {
      actorId: access.userId,
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    return Response.json(
      { error: "The movie draft could not be created. Try again or contact support." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
