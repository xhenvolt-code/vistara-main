import { z } from "zod";
import { MAX_ARTWORK_UPLOAD_BYTES } from "@/domain/video-playback";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { verifyNeonArtworkUpload } from "@/server/storage/neon-object-storage";

const completeSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileSizeBytes: z.number().int().positive().max(MAX_ARTWORK_UPLOAD_BYTES),
  purpose: z.enum(["poster", "backdrop"]),
});

function isSameOrigin(request) {
  const appBaseUrl = process.env.APP_BASE_URL;
  const origin = request.headers.get("origin");

  return Boolean(appBaseUrl && origin && new URL(appBaseUrl).origin === origin);
}

export async function POST(request, { params }) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  const { movieId, assetKey } = await params;
  let body;

  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    throw error;
  }

  const parsed = completeSchema.safeParse(body);

  if (!parsed.success || !/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(assetKey)) {
    return Response.json({ error: "Invalid artwork upload." }, { status: 400 });
  }

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { id: true, status: true },
  });

  if (!movie || movie.status === "ARCHIVED") {
    return Response.json({ error: "This movie cannot receive artwork." }, { status: 404 });
  }

  const key = `movies/${movie.id}/artwork/${assetKey}`;
  let object;

  try {
    object = await verifyNeonArtworkUpload(key);
  } catch (error) {
    console.error("Artwork upload completion could not be verified.", {
      movieId,
      purpose: parsed.data.purpose,
      message: error instanceof Error ? error.message : "Unknown storage error",
    });
    return Response.json(
      { error: "The uploaded artwork could not be verified in object storage." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    Number(object.ContentLength) !== parsed.data.fileSizeBytes ||
    object.ContentType?.toLowerCase() !== parsed.data.contentType
  ) {
    return Response.json(
      { error: "The stored artwork does not match the selected image." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  await prisma.auditLog.create({
    data: {
      actorId: access.userId,
      action: "catalogue.artwork.upload_completed",
      entityType: "Movie",
      entityId: movie.id,
      metadata: {
        purpose: parsed.data.purpose,
        contentType: parsed.data.contentType,
        fileSizeBytes: parsed.data.fileSizeBytes,
      },
    },
  });

  const artworkUrl = `/api/media/artwork/${movie.id}/${assetKey}`;

  return Response.json(
    { artworkUrl, purpose: parsed.data.purpose },
    { headers: { "Cache-Control": "no-store" } },
  );
}
