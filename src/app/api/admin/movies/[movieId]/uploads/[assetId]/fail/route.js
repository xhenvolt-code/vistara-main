import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { deleteCloudinaryVideoAsset } from "@/server/storage/cloudinary-video";

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
      provider: "CLOUDINARY",
      status: { in: ["UPLOADING", "UPLOAD_FAILED"] },
    },
    select: { id: true, providerAssetId: true, status: true },
  });

  if (!asset) {
    return Response.json({ error: "This upload is no longer active." }, { status: 404 });
  }

  if (asset.status === "UPLOADING") {
    const result = await prisma.videoAsset.updateMany({
      where: { id: asset.id, status: "UPLOADING" },
      data: { status: "UPLOAD_FAILED" },
    });

    if (result.count === 0) {
      return Response.json({ error: "This upload is no longer active." }, { status: 409 });
    }
  }

  try {
    await deleteCloudinaryVideoAsset(asset.providerAssetId);
  } catch (error) {
    console.error("Could not clean up failed movie video upload.", {
      movieId,
      assetId,
      message: error instanceof Error ? error.message : "Unknown storage error",
    });
    return Response.json(
      { error: "Upload marked failed, but its Cloudinary asset could not be removed." },
      { status: 502 },
    );
  }

  if (asset.status === "UPLOADING") {
    await prisma.auditLog.create({
      data: {
        actorId: access.userId,
        action: "catalogue.video.upload_failed",
        entityType: "VideoAsset",
        entityId: assetId,
        metadata: { movieId },
      },
    });
  }

  return Response.json({ status: "UPLOAD_FAILED" });
}
