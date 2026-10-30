import { connection } from "next/server";
import Link from "next/link";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { AdminAccessNotice, AdminPageHeading } from "../admin-ui";
import { MovieEditor } from "../admin-forms";

export const metadata = { title: "Rights and genres" };

export default async function AdminCataloguePage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  const movies = await prisma.movie.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      genres: { include: { genre: true } },
      videoAssets: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });

  return (
    <>
      <AdminPageHeading
        eyebrow="Movie management"
        title="Rights & genres"
      >
        <Link className="button-secondary" href="/admin/movies">
          Movie library
        </Link>
      </AdminPageHeading>
      <p className="muted admin-intro">
        Record distribution rights and manage genre assignments. Video assets
        are uploaded and verified from each movie workspace.
      </p>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Add a movie video</h2>
          <Link className="button-primary" href="/admin/movies/new">
            Upload MP4
          </Link>
        </div>
        <p className="muted">
          Movie creation requires only a title and MP4. Artwork, synopsis,
          rights records, cast, and other catalogue details can be added later.
        </p>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Movie rights records</h2>
          <span className="admin-role-badge">{movies.length} total</span>
        </div>
        {movies.length ? (
          <div className="admin-record-list">
            {movies.map((movie) => (
              <details className="admin-record" key={movie.id}>
                <summary>
                  <span>
                    <strong>{movie.title}</strong>
                    <small>
                      {movie.slug} · Rights {movie.rightsStatus}
                    </small>
                  </span>
                  {movie.videoAssets[0] ? (
                    <span className="status-pill status-info">
                      Video {movie.videoAssets[0].status}
                    </span>
                  ) : (
                    <span className="status-pill status-pending">No video asset</span>
                  )}
                </summary>
                <p className="admin-record-workspace-link">
                  <Link className="text-link" href={`/admin/movies/${movie.id}`}>
                    Open movie workspace
                  </Link>
                </p>
                <MovieEditor movie={movie} label="Save changes" />
              </details>
            ))}
          </div>
        ) : (
          <p className="muted">No catalogue titles exist yet.</p>
        )}
      </section>
    </>
  );
}
