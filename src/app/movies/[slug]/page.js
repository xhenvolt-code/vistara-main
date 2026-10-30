import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { auth } from "@/server/auth/neon";
import { prisma } from "@/server/db/prisma";
import { authorizePlayback } from "@/server/services/entitlements";
import { VideoPlayer } from "@/components/video-player";

async function MovieDetails({ params }) {
  const { slug } = await params;
  const movie = await prisma.movie.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      rightsStatus: "APPROVED",
      videoAssets: {
        some: {
          status: "READY",
          provider: "NEON_OBJECT_STORAGE",
          contentType: "video/mp4",
          fileSizeBytes: { not: null },
        },
      },
    },
    include: {
      genres: { include: { genre: true } },
      videoAssets: {
        where: {
          status: "READY",
          provider: "NEON_OBJECT_STORAGE",
          contentType: "video/mp4",
          fileSizeBytes: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!movie) {
    notFound();
  }

  const { data: session, error: sessionError } = await auth.getSession();

  if (sessionError) {
    throw new Error("Unable to verify the current playback session.", {
      cause: sessionError,
    });
  }

  const authorization = session?.user
    ? await authorizePlayback(session.user.id, movie.id)
    : { allowed: false };
  const videoAsset = movie.videoAssets[0];
  const canPlayVideo =
    authorization.allowed &&
    videoAsset?.provider === "NEON_OBJECT_STORAGE" &&
    videoAsset.providerAssetId.toLowerCase().endsWith(".mp4");

  return (
    <main className="page-wrap section">
      <Link className="text-link" href="/movies">
        Back to discover
      </Link>
      <div className="movie-detail">
        <div className="movie-detail-poster">
          {movie.posterUrl ? (
            <img
              alt={`Poster for ${movie.title}`}
              src={movie.posterUrl}
            />
          ) : (
            <span className="poster-placeholder">
              Artwork coming soon
            </span>
          )}
        </div>
        <div>
          <p className="eyebrow">Vistara selection</p>
          <h1 className="page-title">{movie.title}</h1>
          <p className="muted">
            {movie.releaseYear ?? "Release year TBA"} ·{" "}
            {movie.genres.map(({ genre }) => genre.name).join(", ") ||
              "Film"}
            {movie.runtimeMinutes ? ` · ${movie.runtimeMinutes} min` : ""}
            {movie.contentRating ? ` · ${movie.contentRating}` : ""}
          </p>
          {movie.synopsis && <p className="movie-synopsis">{movie.synopsis}</p>}
          {(movie.director || movie.cast.length > 0) && (
            <p className="movie-credit">
              {movie.director ? `Directed by ${movie.director}` : ""}
              {movie.director && movie.cast.length ? " · " : ""}
              {movie.cast.length ? `Featuring ${movie.cast.join(", ")}` : ""}
            </p>
          )}
        </div>
      </div>
      {canPlayVideo ? (
        <section aria-label={`Watch ${movie.title}`} className="movie-watch">
          <h2>Watch now</h2>
          <VideoPlayer
            poster={movie.backdropUrl || movie.posterUrl || undefined}
            src={`/api/movies/${encodeURIComponent(movie.slug)}/playback`}
            title={movie.title}
          />
        </section>
      ) : (
        <div className="notice movie-playback-notice" role="note">
          <strong>
            {!session?.user
              ? "Sign in to watch"
              : authorization.reason === "account_suspended"
                ? "Account access is restricted"
                : authorization.allowed
                  ? "Playback unavailable"
                  : "An access pass is required"}
          </strong>
          <span>
            {!session?.user
              ? "Sign in to check whether your account has access to this title."
              : authorization.reason === "account_suspended"
                ? "This account cannot play videos. Contact Vistara support if you think this is a mistake."
                : authorization.allowed
                  ? "This title does not yet have a supported MP4 streaming asset."
                  : "An active Vistara access pass is required to watch this title."}
          </span>
        </div>
      )}
      {!session?.user && (
        <Link className="button-secondary movie-access-link" href="/auth/sign-in">
          Sign in
        </Link>
      )}
      {session?.user &&
        !authorization.allowed &&
        authorization.reason !== "account_suspended" && (
          <Link className="button-secondary movie-access-link" href="/passes">
            View access pass previews
          </Link>
        )}
    </main>
  );
}

export default function MovieDetailsPage({ params }) {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <main className="page-wrap section">
            <p className="muted">Loading preview listing...</p>
          </main>
        }
      >
        <MovieDetails params={params} />
      </Suspense>
      <SiteFooter />
    </>
  );
}
