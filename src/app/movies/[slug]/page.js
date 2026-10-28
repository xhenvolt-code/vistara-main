import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { prisma } from "@/server/db/prisma";

async function MovieDetails({ params }) {
  const { slug } = await params;
  const movie = await prisma.movie.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      rightsStatus: "APPROVED",
      videoAssets: { some: { status: "READY" } },
    },
    include: {
      genres: { include: { genre: true } },
    },
  });

  if (!movie) {
    notFound();
  }

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
          </p>
          <div className="notice" role="note" style={{ marginTop: 28 }}>
            <strong>Not available to watch</strong>
            <span>
              Playback is not yet available for this title. Please check back
              later.
            </span>
          </div>
          <Link
            className="button-secondary"
            href="/passes"
            style={{ marginTop: 22 }}
          >
            See proposed access passes
          </Link>
        </div>
      </div>
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
