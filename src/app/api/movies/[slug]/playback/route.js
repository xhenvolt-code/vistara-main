import { auth } from "@/server/auth/neon";
import { isValidByteRange } from "@/domain/video-playback";
import { prisma } from "@/server/db/prisma";
import { authorizePlayback } from "@/server/services/entitlements";
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
          provider: "NEON_OBJECT_STORAGE",
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

  if (asset?.provider !== "NEON_OBJECT_STORAGE") {
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
    object = await getNeonVideoObject(asset.providerAssetId, range ?? undefined);
  } catch (error) {
    return storageFailure(error, slug);
  }

  if (!object.Body) {
    return storageFailure(new Error("Storage returned no video body."), slug);
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
