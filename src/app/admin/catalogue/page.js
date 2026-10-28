import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { AdminAccessNotice, AdminPageHeading } from "../admin-ui";
import { MovieEditor } from "../admin-forms";

export const metadata = { title: "Catalogue management" };

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
      <AdminPageHeading title="Catalogue & distribution rights" />
      <p className="muted admin-intro">
        A title can be published only after rights are approved, the agreement
        reference is recorded, and a playback asset is marked ready.
      </p>

      <section className="admin-panel">
        <h2>Add a catalogue title</h2>
        <MovieEditor />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Managed titles</h2>
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
                      {movie.slug} · {movie.status} · Rights {movie.rightsStatus}
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
