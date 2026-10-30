import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import {
  AdminAccessNotice,
  AdminPageHeading,
} from "../../admin-ui";
import { MovieEditor } from "../../admin-forms";
import { VideoUploadPanel } from "../video-upload-panel";
import { VideoPlayer } from "@/components/video-player";

export const metadata = { title: "Movie workspace" };

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) {
    return "Not recorded";
  }
  const size = Number(bytes);
  if (!Number.isSafeInteger(size) || size < 0) {
    return "Unknown size";
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(0)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function MovieWorkspacePage({ params }) {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  const { movieId } = await params;
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    include: {
      genres: { include: { genre: true } },
      videoAssets: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!movie) {
    notFound();
  }

  const assetIds = movie.videoAssets.map((asset) => asset.id);
  const activity = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "Movie", entityId: movie.id },
        ...(assetIds.length ? [{ entityType: "VideoAsset", entityId: { in: assetIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const readyAsset = movie.videoAssets.find(
    (asset) =>
      asset.status === "READY" &&
      asset.provider === "NEON_OBJECT_STORAGE" &&
      asset.contentType === "video/mp4" &&
      asset.fileSizeBytes !== null,
  );

  return (
    <>
      <AdminPageHeading eyebrow="Movie management" title={movie.title}>
        {movie.status !== "ARCHIVED" && (
          <Link className="button-primary" href="#video-upload">
            {readyAsset ? "Replace MP4 video" : "Upload MP4 video"}
          </Link>
        )}
        <Link className="button-secondary" href="/admin/movies">
          Back to library
        </Link>
      </AdminPageHeading>

      <div className="movie-workspace-overview">
        <div className="movie-workspace-art">
          {movie.posterUrl ? (
            <Image
              alt={`Poster for ${movie.title}`}
              fill
              sizes="(max-width: 700px) 90vw, 300px"
              src={movie.posterUrl}
              unoptimized
            />
          ) : (
            <span className="poster-placeholder">Movie poster not added</span>
          )}
        </div>
        <div className="movie-workspace-summary">
          <div className="admin-movie-statuses">
            <span className={`status-pill status-${movie.status.toLowerCase()}`}>
              {movie.status}
            </span>
            <span className={`status-pill status-${movie.rightsStatus.toLowerCase()}`}>
              Rights {movie.rightsStatus}
            </span>
            <span className={`status-pill ${readyAsset ? "status-paid" : "status-pending"}`}>
              {readyAsset ? "VIDEO READY" : movie.videoAssets[0]?.status ?? "NO VIDEO"}
            </span>
          </div>
          <p>{movie.synopsis || "No synopsis recorded."}</p>
          <dl className="movie-workspace-facts">
            <div><dt>Release year</dt><dd>{movie.releaseYear ?? "Not recorded"}</dd></div>
            <div><dt>Runtime</dt><dd>{movie.runtimeMinutes ? `${movie.runtimeMinutes} minutes` : "Not recorded"}</dd></div>
            <div><dt>Genre</dt><dd>{movie.genres.map(({ genre }) => genre.name).join(", ") || "Not recorded"}</dd></div>
            <div><dt>Language</dt><dd>{movie.language || "Not recorded"}</dd></div>
            <div><dt>Director</dt><dd>{movie.director || "Not recorded"}</dd></div>
            <div><dt>Content rating</dt><dd>{movie.contentRating || "Not recorded"}</dd></div>
            <div><dt>Distribution rights</dt><dd>{movie.rightsSource || "No agreement reference recorded"}</dd></div>
            <div><dt>Updated</dt><dd>{movie.updatedAt.toLocaleString()}</dd></div>
          </dl>
          {movie.cast.length > 0 && (
            <p><strong>Cast:</strong> {movie.cast.join(", ")}</p>
          )}
        </div>
      </div>

      {movie.status !== "ARCHIVED" && (
        <section className="admin-panel" id="video-upload">
          <h2>{readyAsset ? "Replace movie video" : "Upload movie video"}</h2>
          <p className="muted">
            Select an MP4 file up to 5 GiB. It uploads directly to Neon Object
            Storage, then Vistara verifies it before making it available.
          </p>
          <VideoUploadPanel movieId={movie.id} />
        </section>
      )}

      <section className="admin-panel">
        <h2>Movie playback preview</h2>
        {readyAsset ? (
          <VideoPlayer
            className="admin-movie-player"
            poster={movie.backdropUrl || movie.posterUrl || undefined}
            src={`/api/admin/movies/${movie.id}/playback`}
            title={`Admin preview: ${movie.title}`}
          />
        ) : (
          <p className="muted">
            Playback preview becomes available after an MP4 upload is completed
            and verified in object storage.
          </p>
        )}
      </section>

      <section className="admin-panel">
        <h2>Video assets</h2>
        {movie.videoAssets.length ? (
          <div className="movie-asset-list">
            {movie.videoAssets.map((asset) => (
              <article className="movie-asset-row" key={asset.id}>
                <div>
                  <strong>{asset.originalFilename || "Video asset"}</strong>
                  <span>
                    {asset.contentType || "Format not recorded"} ·{" "}
                    {formatBytes(asset.fileSizeBytes)} · Added{" "}
                    {asset.createdAt.toLocaleString()}
                  </span>
                  <span>
                    {asset.durationSeconds
                      ? `${Math.floor(asset.durationSeconds / 60)} min ${asset.durationSeconds % 60} sec`
                      : "Duration not recorded"}
                  </span>
                </div>
                <span className={`status-pill ${asset.status === "READY" ? "status-paid" : asset.status.includes("FAILED") ? "status-failed" : "status-pending"}`}>
                  {asset.status.replaceAll("_", " ")}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No video uploads have been started.</p>
        )}
      </section>

      <section className="admin-panel">
        <h2>Movie metadata and publishing</h2>
        <MovieEditor movie={movie} label="Save movie changes" />
      </section>

      <section className="admin-panel">
        <h2>Activity</h2>
        {activity.length ? (
          <ol className="movie-activity-list">
            {activity.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.action.replaceAll(".", " ")}</strong>
                <span>{entry.createdAt.toLocaleString()} · Admin {entry.actorId}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">No movie administration activity recorded yet.</p>
        )}
      </section>
    </>
  );
}
