import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { AdminAccessNotice, AdminPageHeading } from "../../admin-ui";
import { MovieUploadForm } from "./movie-upload-form";

export const metadata = { title: "Add movie" };

export default async function NewMoviePage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  return (
    <>
      <AdminPageHeading eyebrow="Movie management" title="Upload a movie" />
      <p className="muted admin-intro">
        Select a supported video and enter its title. Vistara creates a draft
        and begins uploading right away; add other catalogue details later.
      </p>
      <section className="admin-panel">
        <h2>Movie video</h2>
        <MovieUploadForm />
      </section>
    </>
  );
}
