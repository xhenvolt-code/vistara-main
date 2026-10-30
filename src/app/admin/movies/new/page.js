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
      <AdminPageHeading eyebrow="Movie management · Step 1 of 2" title="Add a movie" />
      <p className="muted admin-intro">
        Add the movie details and save. You will then continue to Step 2, where
        you can select and upload the MP4 video. New movies remain drafts until
        you explicitly publish them.
      </p>
      <section className="admin-panel">
        <h2>Step 1: Movie details and artwork</h2>
        <MovieEditor label="Create movie record" />
      </section>
    </>
  );
}
