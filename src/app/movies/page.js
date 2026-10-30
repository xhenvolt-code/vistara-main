import Link from "next/link";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { prisma } from "@/server/db/prisma";

export const metadata = {
  title: "Discover",
};

async function MovieResults({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.trim() : "";
  const searchConditions = query
    ? [
        { title: { contains: query, mode: "insensitive" } },
        {
          genres: {
            some: {
              genre: { name: { contains: query, mode: "insensitive" } },
            },
          },
        },
        ...(Number.isInteger(Number(query))
          ? [{ releaseYear: Number(query) }]
          : []),
      ]
    : undefined;
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
      ...(searchConditions ? { OR: searchConditions } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    include: { genres: { include: { genre: true } } },
  });

  return (
    <main className="page-wrap section">
      <p className="eyebrow">Discover</p>
      <h1 className="page-title">Find a film for tonight.</h1>
      <p className="muted">
        Search titles approved for distribution by the Vistara team.
      </p>
      <div className="catalogue-toolbar">
        <form action="/movies" className="search-form" role="search">
          <label className="sr-only" htmlFor="movie-search">
            Search movies
          </label>
          <input
            autoComplete="off"
            defaultValue={query}
            id="movie-search"
            name="q"
            placeholder="Search titles or genres"
            type="search"
          />
          <button className="button-primary" type="submit">
            Search
          </button>
        </form>
      </div>

      <section className="section" aria-label="Movie results">
        {movies.length > 0 ? (
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
                      Artwork coming soon
                    </span>
                  )}
                </div>
                <h2>{movie.title}</h2>
                <span className="movie-meta">
                  {movie.releaseYear ?? "Release year TBA"} ·{" "}
                  {movie.genres.map(({ genre }) => genre.name).join(", ") ||
                    "Film"}{" "}
                  · Vistara
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            {query
              ? `No available titles match “${query}”. Try another search.`
              : "There are no titles in the Vistara catalogue yet."}
          </p>
        )}
      </section>
    </main>
  );
}

export default function MoviesPage({ searchParams }) {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <main className="page-wrap section">
            <p className="muted">Loading preview catalogue...</p>
          </main>
        }
      >
        <MovieResults searchParams={searchParams} />
      </Suspense>
      <SiteFooter />
    </>
  );
}
