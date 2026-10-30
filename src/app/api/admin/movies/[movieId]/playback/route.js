import { getAdminAccess } from "@/server/auth/admin";
import { isValidByteRange } from "@/domain/video-playback";
import { prisma } from "@/server/db/prisma";
import { fetchCloudinaryVideo } from "@/server/storage/cloudinary-video";
import { getNeonVideoObject } from "@/server/storage/neon-object-storage";

export async function GET(request, { params }) {
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return Response.json(
      { error: "Administrator access is required." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { movieId } = await params;
  const asset = await prisma.videoAsset.findFirst({
    where: {
      movieId,
      provider: { in: ["CLOUDINARY", "NEON_OBJECT_STORAGE"] },
      status: "READY",
      contentType: "video/mp4",
      fileSizeBytes: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: { provider: true, providerAssetId: true, contentType: true },
  });

  if (!asset) {
    return Response.json(
      { error: "This movie has no verified MP4 playback asset." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const range = request.headers.get("range");

  if (range && !isValidByteRange(range)) {
    return new Response(null, {
      status: 416,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  }

  let object;

  try {
    object =
      asset.provider === "CLOUDINARY"
        ? await fetchCloudinaryVideo(asset.providerAssetId, range ?? undefined)
        : await getNeonVideoObject(asset.providerAssetId, range ?? undefined);
  } catch (error) {
    console.error("Admin video preview failed to load from storage.", {
      movieId,
      message: error instanceof Error ? error.message : "Unknown storage error",
    });
    return Response.json(
      { error: "The video could not be loaded. Please try again later." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (asset.provider === "CLOUDINARY" && object.status === 416) {
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    });
    const contentRange = object.headers.get("content-range");
    if (contentRange) {
      headers.set("Content-Range", contentRange);
    }
    return new Response(null, { status: 416, headers });
  }

  const body =
    asset.provider === "CLOUDINARY" ? object.body : object.Body?.transformToWebStream();

  if (!object.ok && asset.provider === "CLOUDINARY") {
    console.error("Admin video preview failed to load from Cloudinary.", {
      movieId,
      status: object.status,
    });
    return Response.json(
      { error: "The video could not be loaded. Please try again later." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!body) {
    return Response.json(
      { error: "Storage returned no video data." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Type": "video/mp4",
    "X-Content-Type-Options": "nosniff",
  });

  const contentLength =
    asset.provider === "CLOUDINARY"
      ? object.headers.get("content-length")
      : object.ContentLength;
  const contentRange =
    asset.provider === "CLOUDINARY"
      ? object.headers.get("content-range")
      : object.ContentRange;

  if (contentLength !== undefined && contentLength !== null) {
    headers.set("Content-Length", String(contentLength));
  }
  if (contentRange) {
    headers.set("Content-Range", contentRange);
  }

  return new Response(body, {
    status:
      asset.provider === "CLOUDINARY"
        ? object.status
        : object.ContentRange
          ? 206
          : 200,
    headers,
  });
}
