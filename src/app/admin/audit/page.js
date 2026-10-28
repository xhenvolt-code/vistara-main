import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { AdminAccessNotice, AdminPageHeading } from "../admin-ui";

export const metadata = { title: "Audit history" };

export default async function AdminAuditPage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  const entries = await prisma.auditLog.findMany({
    take: 150,
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <AdminPageHeading title="Audit history" />
      <p className="muted admin-intro">
        Recent administrative changes. Sensitive provider credentials are never
        recorded in audit metadata.
      </p>
      <section className="admin-panel">
        <h2>Latest 150 events</h2>
        {entries.length ? (
          <div className="admin-record-list">
            {entries.map((entry) => (
              <article className="admin-audit-entry" key={entry.id}>
                <div>
                  <strong>{entry.action}</strong>
                  <span>
                    {entry.entityType}
                    {entry.entityId ? ` · ${entry.entityId}` : ""}
                  </span>
                </div>
                <div>
                  <span>Actor {entry.actorId}</span>
                  <time dateTime={entry.createdAt.toISOString()}>
                    {entry.createdAt.toLocaleString()}
                  </time>
                </div>
                {entry.metadata && (
                  <pre>{JSON.stringify(entry.metadata, null, 2)}</pre>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No administrative events have been recorded.</p>
        )}
      </section>
    </>
  );
}
