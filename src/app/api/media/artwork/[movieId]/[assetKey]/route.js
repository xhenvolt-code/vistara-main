import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { getNeonArtworkObject } from "@/server/storage/neon-object-storage";

export async function GET(_request, { params }) {
  const { movieId, assetKey } = await params;

  if (!/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(assetKey)) {
    return new Response(null, { status: 404 });
  }

  const artworkUrl = `/api/media/artwork/${movieId}/${assetKey}`;
  const movie = await prisma.movie.findFirst({
    where: {
      id: movieId,
      OR: [{ posterUrl: artworkUrl }, { backdropUrl: artworkUrl }],
    },
    select: {
      id: true,
      status: true,
      rightsStatus: true,
      videoAssets: {
        where: {
          status: "READY",
          provider: "NEON_OBJECT_STORAGE",
          contentType: "video/mp4",
          fileSizeBytes: { not: null },
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!movie) {
    return new Response(null, { status: 404 });
  }

  const isPublic =
    movie.status === "PUBLISHED" &&
    movie.rightsStatus === "APPROVED" &&
    movie.videoAssets.length > 0;
  const isAdmin = isPublic
    ? false
    : (await getAdminAccess()).status === "authorized";

  if (!isPublic && !isAdmin) {
    return new Response(null, { status: 404 });
  }

  let object;

  try {
    object = await getNeonArtworkObject(
      `movies/${movieId}/artwork/${assetKey}`,
    );
  } catch (error) {
    console.error("Artwork could not be loaded from object storage.", {
      movieId,
      message: error instanceof Error ? error.message : "Unknown storage error",
    });
    return new Response(null, {
      status: 502,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (!object.Body || !["image/jpeg", "image/png", "image/webp"].includes(object.ContentType)) {
    return new Response(null, {
      status: 502,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": object.ContentType,
    "X-Content-Type-Options": "nosniff",
  });

  if (object.ContentLength !== undefined) {
    headers.set("Content-Length", String(object.ContentLength));
  }

  return new Response(object.Body.transformToWebStream(), { headers });
}
