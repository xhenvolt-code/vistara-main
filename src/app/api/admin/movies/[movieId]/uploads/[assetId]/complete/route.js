import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import {
  deleteNeonUploadObject,
  verifyNeonVideoUpload,
} from "@/server/storage/neon-object-storage";

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

  const { movieId, assetId } = await params;
  const asset = await prisma.videoAsset.findFirst({
    where: {
      id: assetId,
      movieId,
      provider: "NEON_OBJECT_STORAGE",
      status: "UPLOADING",
    },
    select: {
      id: true,
      movieId: true,
      providerAssetId: true,
      contentType: true,
      fileSizeBytes: true,
    },
  });

  if (!asset || !asset.fileSizeBytes) {
    return Response.json({ error: "This upload is no longer active." }, { status: 404 });
  }

  let object;

  try {
    object = await verifyNeonVideoUpload(asset.providerAssetId);
  } catch (error) {
    console.error("Video upload completion could not be verified.", {
      movieId,
      assetId,
      message: error instanceof Error ? error.message : "Unknown storage error",
    });
    return Response.json(
      { error: "The uploaded file could not be verified in object storage." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    BigInt(object.ContentLength ?? -1) !== asset.fileSizeBytes ||
    object.ContentType?.toLowerCase() !== asset.contentType
  ) {
    const failed = await prisma.videoAsset.updateMany({
      where: { id: asset.id, status: "UPLOADING" },
      data: { status: "UPLOAD_FAILED" },
    });

    if (failed.count !== 1) {
      return Response.json(
        { error: "This upload is no longer active." },
        { status: 409 },
      );
    }

    await deleteNeonUploadObject(asset.providerAssetId);
    await prisma.auditLog.create({
      data: {
        actorId: access.userId,
        action: "catalogue.video.upload_failed",
        entityType: "VideoAsset",
        entityId: asset.id,
        metadata: { movieId: asset.movieId, reason: "verification_mismatch" },
      },
    });
    return Response.json(
      { error: "The stored video does not match the selected file. Start a new upload." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.videoAsset.updateMany({
      where: { id: asset.id, status: "UPLOADING" },
      data: { status: "READY" },
    });

    if (updated.count !== 1) {
      throw new Error("This upload was already completed or failed.");
    }

    await tx.videoAsset.updateMany({
      where: {
        movieId: asset.movieId,
        status: "READY",
        id: { not: asset.id },
      },
      data: { status: "UNAVAILABLE" },
    });
    await tx.auditLog.create({
      data: {
        actorId: access.userId,
        action: "catalogue.video.upload_completed",
        entityType: "VideoAsset",
        entityId: asset.id,
        metadata: { movieId: asset.movieId },
      },
    });
  });

  return Response.json(
    { status: "READY", assetId: asset.id },
    { headers: { "Cache-Control": "no-store" } },
  );
}
