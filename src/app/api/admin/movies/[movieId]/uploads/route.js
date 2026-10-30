import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MAX_VIDEO_UPLOAD_BYTES } from "@/domain/video-playback";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { createNeonVideoUpload } from "@/server/storage/neon-object-storage";

const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(240),
  contentType: z.literal("video/mp4"),
  fileSizeBytes: z.number().int().positive().max(MAX_VIDEO_UPLOAD_BYTES),
});

function isSameOrigin(request) {
  const appBaseUrl = process.env.APP_BASE_URL;
  const origin = request.headers.get("origin");

  if (!appBaseUrl || !origin) {
    return false;
  }

  return new URL(appBaseUrl).origin === origin;
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

  const parsed = uploadSchema.safeParse(body);

  if (!parsed.success || !parsed.data.filename.toLowerCase().endsWith(".mp4")) {
    return Response.json(
      { error: "Choose an MP4 file no larger than 5 GiB." },
      { status: 400 },
    );
  }

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { id: true, status: true },
  });

  if (!movie || movie.status === "ARCHIVED") {
    return Response.json({ error: "This movie cannot receive a video upload." }, { status: 404 });
  }

  const key = `movies/${movie.id}/${randomUUID()}.mp4`;
  let asset;

  try {
    asset = await prisma.videoAsset.create({
      data: {
        movieId: movie.id,
        provider: "NEON_OBJECT_STORAGE",
        providerAssetId: key,
        status: "UPLOADING",
        originalFilename: parsed.data.filename.split(/[\\/]/).pop(),
        contentType: "video/mp4",
        fileSizeBytes: BigInt(parsed.data.fileSizeBytes),
      },
      select: { id: true },
    });
  } catch (error) {
    console.error("Could not create a movie video asset.", {
      movieId: movie.id,
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    return Response.json(
      {
        error:
          error?.code === "P2022"
            ? "The movie database migration is not applied yet. Apply the pending media migration before uploading videos."
            : "The video upload could not be prepared. Check database connectivity and try again.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const upload = await createNeonVideoUpload(key, parsed.data.fileSizeBytes);
    await prisma.auditLog.create({
      data: {
        actorId: access.userId,
        action: "catalogue.video.upload_started",
        entityType: "VideoAsset",
        entityId: asset.id,
        metadata: {
          movieId: movie.id,
          filename: parsed.data.filename.split(/[\\/]/).pop(),
          fileSizeBytes: parsed.data.fileSizeBytes,
        },
      },
    });

    return Response.json(
      {
        assetId: asset.id,
        uploadUrl: upload.uploadUrl,
        expiresInSeconds: upload.expiresInSeconds,
        headers: { "Content-Type": "video/mp4" },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await prisma.videoAsset.update({
      where: { id: asset.id },
      data: { status: "UPLOAD_FAILED" },
    });
    console.error("Could not create a signed video upload.", {
      movieId: movie.id,
      assetId: asset.id,
      message: error instanceof Error ? error.message : "Unknown storage error",
    });

    return Response.json(
      { error: "Video upload could not be started. Check storage configuration and try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
