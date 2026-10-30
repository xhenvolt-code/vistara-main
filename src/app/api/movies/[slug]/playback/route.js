import { auth } from "@/server/auth/neon";
import { isValidByteRange } from "@/domain/video-playback";
import { prisma } from "@/server/db/prisma";
import { authorizePlayback } from "@/server/services/entitlements";
import { fetchCloudinaryVideo } from "@/server/storage/cloudinary-video";
import { getNeonVideoObject } from "@/server/storage/neon-object-storage";

function storageFailure(error, slug) {
  console.error("Video object request failed.", {
    slug,
    message: error instanceof Error ? error.message : "Unknown storage error",
  });

  return Response.json(
    { error: "The video could not be loaded. Please try again later." },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request, { params }) {
  const { slug } = await params;
  const { data: session, error: sessionError } = await auth.getSession();

  if (sessionError) {
    throw new Error("Unable to verify the current playback session.", {
      cause: sessionError,
    });
  }

  if (!session?.user) {
    return Response.json(
      { error: "Sign in to watch this title." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const movie = await prisma.movie.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      rightsStatus: "APPROVED",
    },
    select: {
      id: true,
      videoAssets: {
        where: {
          status: "READY",
          provider: { in: ["CLOUDINARY", "NEON_OBJECT_STORAGE"] },
          contentType: "video/mp4",
          fileSizeBytes: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { provider: true, providerAssetId: true },
      },
    },
  });

  if (!movie) {
    return Response.json(
      { error: "This title is not available." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const authorization = await authorizePlayback(session.user.id, movie.id);

  if (!authorization.allowed) {
    const status = authorization.reason === "movie_unavailable" ? 404 : 403;
    return Response.json(
      { error: "An active Vistara access pass is required to watch this title." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const asset = movie.videoAssets[0];

  if (!["CLOUDINARY", "NEON_OBJECT_STORAGE"].includes(asset?.provider)) {
    return Response.json(
      { error: "This title does not have a supported playback asset yet." },
      { status: 501, headers: { "Cache-Control": "no-store" } },
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
    return storageFailure(error, slug);
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

  if (
    (asset.provider === "CLOUDINARY" && !object.ok) ||
    !body
  ) {
    if (asset.provider === "CLOUDINARY" && !object.ok) {
      console.error("Cloudinary video request failed.", {
        slug,
        status: object.status,
      });
    }
    return storageFailure(new Error("Storage returned no video body."), slug);
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
