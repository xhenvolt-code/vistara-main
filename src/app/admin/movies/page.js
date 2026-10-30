import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import {
  AdminAccessNotice,
  AdminPageHeading,
} from "../admin-ui";

export const metadata = { title: "Movie library" };

const videoStatuses = [
  "UPLOADING",
  "UPLOAD_FAILED",
  "PROCESSING",
  "PROCESSING_FAILED",
  "READY",
  "UNAVAILABLE",
];

function queryString(params, changes = {}) {
  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) {
      nextParams.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
  }
  return nextParams.toString();
}

export default async function MovieLibraryPage({ searchParams }) {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  const search = await searchParams;
  const q = typeof search?.q === "string" ? search.q.trim().slice(0, 100) : "";
  const status =
    ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"].includes(search?.status)
      ? search.status
      : "";
  const videoStatus = videoStatuses.includes(search?.video)
    ? search.video
    : "";
  const genre = typeof search?.genre === "string" ? search.genre : "";
  const sort = ["title", "oldest", "release"].includes(search?.sort)
    ? search.sort
    : "recent";
  const requestedPage = Number(search?.page ?? 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 18;
  const where = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(genre ? { genres: { some: { genre: { slug: genre } } } } : {}),
    ...(videoStatus
      ? { videoAssets: { some: { status: videoStatus } } }
      : {}),
  };
  const orderBy =
    sort === "title"
      ? [{ title: "asc" }]
      : sort === "oldest"
        ? [{ createdAt: "asc" }]
        : sort === "release"
          ? [{ releaseYear: "desc" }, { title: "asc" }]
          : [{ updatedAt: "desc" }];
  const [total, movies, genres] = await Promise.all([
    prisma.movie.count({ where }),
    prisma.movie.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        genres: { include: { genre: true } },
        videoAssets: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    }),
    prisma.genre.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = { q, status, video: videoStatus, genre, sort };

  return (
    <>
      <AdminPageHeading
        eyebrow="Movie management"
        title="Movie library"
      >
        <Link className="button-primary" href="/admin/movies/new">
          Upload movie
        </Link>
      </AdminPageHeading>

      <p className="muted admin-intro">
        Review movie artwork, metadata, publishing, and verified video
        readiness in one library. Only uploaded and storage-verified videos can
        be marked ready.
      </p>

      <form action="/admin/movies" className="movie-library-filters">
        <label>
          Search movies
          <input
            defaultValue={q}
            maxLength={100}
            name="q"
            placeholder="Search title or slug"
            type="search"
          />
        </label>
        <label>
          Publication
          <select defaultValue={status} name="status">
            <option value="">All publication states</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="UNPUBLISHED">Unpublished</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <label>
          Video status
          <select defaultValue={videoStatus} name="video">
            <option value="">All video states</option>
            {videoStatuses.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Genre
          <select defaultValue={genre} name="genre">
            <option value="">All genres</option>
            {genres.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select defaultValue={sort} name="sort">
            <option value="recent">Recently updated</option>
            <option value="oldest">Oldest added</option>
            <option value="title">Title A–Z</option>
            <option value="release">Release year</option>
          </select>
        </label>
        <button className="button-secondary" type="submit">
          Apply filters
        </button>
      </form>

      <div className="movie-library-summary">
        <span>{total.toLocaleString()} movies</span>
        {pageCount > 1 && <span>Page {page} of {pageCount}</span>}
      </div>

      {movies.length ? (
        <section aria-label="Movies" className="admin-movie-grid">
          {movies.map((movie) => {
            const asset = movie.videoAssets[0];
            return (
              <article className="admin-movie-card" key={movie.id}>
                <Link
                  aria-label={`Open ${movie.title}`}
                  className="admin-movie-art"
                  href={`/admin/movies/${movie.id}`}
                >
                  {movie.posterUrl ? (
                    <Image
                      alt={`Poster for ${movie.title}`}
                      fill
                      sizes="(max-width: 700px) 45vw, (max-width: 1200px) 30vw, 220px"
                      src={movie.posterUrl}
                      unoptimized
                    />
                  ) : (
                    <span className="poster-placeholder">
                      <span aria-hidden="true" className="poster-placeholder-mark">V</span>
                      Artwork not added
                    </span>
                  )}
                </Link>
                <div className="admin-movie-card-body">
                  <h2>
                    <Link href={`/admin/movies/${movie.id}`}>{movie.title}</Link>
                  </h2>
                  <p>
                    {[movie.releaseYear, movie.genres.map(({ genre: item }) => item.name).join(", ")]
                      .filter(Boolean)
                      .join(" · ") || "Film details not added"}
                  </p>
                  <div className="admin-movie-statuses">
                    <span className={`status-pill status-${movie.status.toLowerCase()}`}>
                      {movie.status}
                    </span>
                    <span className={`status-pill ${asset?.status === "READY" ? "status-paid" : "status-pending"}`}>
                      {asset?.status ?? "NO VIDEO"}
                    </span>
                  </div>
                  <small>Updated {movie.updatedAt.toLocaleDateString()}</small>
                  <Link className="text-link" href={`/admin/movies/${movie.id}`}>
                    Open movie workspace
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="admin-message movie-library-empty">
          <h2>{total === 0 && !q && !status && !videoStatus && !genre ? "Your movie library is ready" : "No movies match these filters"}</h2>
          <p>
            {total === 0 && !q && !status && !videoStatus && !genre
              ? "Add a movie record, document distribution rights, and upload its video from the movie workspace."
              : "Try changing the search or filters to find another movie."}
          </p>
          <Link className="button-primary" href="/admin/movies/new">
            Add a movie
          </Link>
        </section>
      )}

      {pageCount > 1 && (
        <nav aria-label="Movie library pages" className="movie-library-pagination">
          {page > 1 && (
            <Link
              className="button-secondary"
              href={`/admin/movies?${queryString(baseParams, { page: String(page - 1) })}`}
            >
              Previous
            </Link>
          )}
          {page < pageCount && (
            <Link
              className="button-secondary"
              href={`/admin/movies?${queryString(baseParams, { page: String(page + 1) })}`}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
