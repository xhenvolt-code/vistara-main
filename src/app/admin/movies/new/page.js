import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { AdminAccessNotice, AdminPageHeading } from "../../admin-ui";
import { MovieEditor } from "../../admin-forms";

export const metadata = { title: "Add movie" };

export default async function NewMoviePage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  return (
    <>
      <AdminPageHeading eyebrow="Movie management" title="Add a movie" />
      <p className="muted admin-intro">
        Create the movie record first, then upload and verify its MP4 video in
        the movie workspace. New movies remain drafts until you explicitly
        publish them.
      </p>
      <section className="admin-panel">
        <h2>Movie metadata</h2>
        <MovieEditor label="Create movie record" />
      </section>
    </>
  );
}
