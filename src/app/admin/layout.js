import { Suspense } from "react";
import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { AdminShell } from "./admin-ui";

async function AdminContent({ children }) {
  await connection();
  const access = await getAdminAccess();

  return <AdminShell access={access}>{children}</AdminShell>;
}

export default function AdminLayout({ children }) {
  return (
    <Suspense
      fallback={
        <main className="admin-content">
          <p className="muted">Loading administration...</p>
        </main>
      }
    >
      <AdminContent>{children}</AdminContent>
    </Suspense>
  );
}
