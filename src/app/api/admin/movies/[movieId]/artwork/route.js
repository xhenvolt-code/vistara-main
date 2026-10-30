import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MAX_ARTWORK_UPLOAD_BYTES } from "@/domain/video-playback";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { createNeonArtworkUpload } from "@/server/storage/neon-object-storage";

const mimeExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const artworkSchema = z.object({
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

  const { movieId } = await params;
  let body;

  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    throw error;
  }

  const parsed = artworkSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Choose a JPEG, PNG, or WebP image no larger than 10 MB." },
      { status: 400 },
    );
  }

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { id: true, status: true },
  });

  if (!movie || movie.status === "ARCHIVED") {
    return Response.json({ error: "This movie cannot receive artwork." }, { status: 404 });
  }

  const assetKey = `${randomUUID()}.${mimeExtensions[parsed.data.contentType]}`;
  const key = `movies/${movie.id}/artwork/${assetKey}`;

  try {
    const upload = await createNeonArtworkUpload(key, parsed.data.contentType);
    return Response.json(
      {
        assetKey,
        uploadUrl: upload.uploadUrl,
        expiresInSeconds: upload.expiresInSeconds,
        headers: { "Content-Type": parsed.data.contentType },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not create a signed artwork upload.", {
      movieId,
      purpose: parsed.data.purpose,
      message: error instanceof Error ? error.message : "Unknown storage error",
    });

    return Response.json(
      { error: "Artwork upload could not be started. Check storage configuration and try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
