import { getAdminAccess } from "@/server/auth/admin";
import { isValidByteRange } from "@/domain/video-playback";
import { prisma } from "@/server/db/prisma";
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
      provider: "NEON_OBJECT_STORAGE",
      status: "READY",
      contentType: "video/mp4",
      fileSizeBytes: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: { providerAssetId: true, contentType: true },
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
    object = await getNeonVideoObject(asset.providerAssetId, range ?? undefined);
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

  if (!object.Body) {
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

  if (object.ContentLength !== undefined) {
    headers.set("Content-Length", String(object.ContentLength));
  }
  if (object.ContentRange) {
    headers.set("Content-Range", object.ContentRange);
  }

  return new Response(object.Body.transformToWebStream(), {
    status: object.ContentRange ? 206 : 200,
    headers,
  });
}
