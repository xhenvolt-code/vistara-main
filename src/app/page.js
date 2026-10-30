import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { prisma } from "@/server/db/prisma";

async function HomeCatalogue() {
  await io();
  const movies = await prisma.movie.findMany({
    where: {
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
    take: 10,
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    include: { genres: { include: { genre: true } } },
  });
  const featuredMovie = movies.find((movie) => movie.isFeatured) ?? movies[0];

  return (
    <>
      <section
        aria-labelledby="home-title"
        className={`hero${featuredMovie?.backdropUrl ? " hero-with-artwork" : ""}`}
      >
        {featuredMovie?.backdropUrl && (
          <Image
            alt=""
            className="hero-image"
            fill
            priority
            sizes="100vw"
            src={featuredMovie.backdropUrl}
            unoptimized
          />
        )}
        <div className="hero-content">
          <p className="eyebrow">Vistara · Uganda</p>
          <h1 id="home-title">
            {featuredMovie
              ? `Your next story: ${featuredMovie.title}.`
              : "Find your next story."}
          </h1>
          <p className="hero-copy">
            Discover films selected for Vistara and see what is available
            before choosing an access pass.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" href="/movies">
              Explore films
            </Link>
            <Link className="button-secondary" href="/passes">
              View access passes
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="catalogue-title" className="section page-wrap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Made for movie nights</p>
            <h2 id="catalogue-title">Available on Vistara</h2>
            <p>
              Titles shown here have been approved for listing by the Vistara
              team.
            </p>
          </div>
          <Link className="text-link" href="/movies">
            Browse all films
          </Link>
        </div>

        {movies.length ? (
          <div className="movie-grid">
            {movies.map((movie) => (
              <Link
                className="movie-card"
                href={`/movies/${movie.slug}`}
                key={movie.id}
              >
                <div className="movie-poster">
                  {movie.posterUrl ? (
                    <img
                      alt={`Poster for ${movie.title}`}
                      src={movie.posterUrl}
                    />
                  ) : (
                    <span className="poster-placeholder">
                      <span
                        aria-hidden="true"
                        className="poster-placeholder-mark"
                      >
                        V
                      </span>
                      Artwork coming soon
                    </span>
                  )}
                </div>
                <h3>{movie.title}</h3>
                <span className="movie-meta">
                  {movie.releaseYear ?? "Release year TBA"} ·{" "}
                  {movie.genres.map(({ genre }) => genre.name).join(", ") ||
                    "Film"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="catalogue-empty-state">
            <span aria-hidden="true" className="catalogue-empty-icon">
              V
            </span>
            <h3>Our catalogue is taking shape</h3>
            <p>
              There are no films listed yet. We will add titles here once the
              catalogue is ready.
            </p>
            <Link className="button-secondary" href="/movies">
              Check the catalogue
            </Link>
          </div>
        )}
        <p className="catalogue-availability-note">
          Protected playback currently supports MP4 titles stored in Neon
          Object Storage. Online purchases are not available yet; access pass
          prices, when listed, are for preview only.
        </p>
      </section>
    </>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense
          fallback={
            <div className="home-loading" role="status">
              <span className="loading-indicator" />
              <span>Loading the Vistara catalogue…</span>
            </div>
          }
        >
          <HomeCatalogue />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
