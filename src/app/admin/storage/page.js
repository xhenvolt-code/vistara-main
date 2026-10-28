import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import {
  getNeonStorageInventory,
  getStorageHardLimit,
} from "@/server/storage/neon-object-storage";
import { StorageLimitForm } from "./storage-limit-form";

export const metadata = {
  title: "Object storage",
};

function formatBytes(bytes) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1000)),
    units.length - 1,
  );

  return `${(bytes / 1000 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

async function StorageDashboard() {
  await connection();
  const access = await getAdminAccess();

  if (access.status === "unauthenticated") {
    return (
      <section className="admin-message">
        <h1>Sign in to continue</h1>
        <Link className="button-primary" href="/auth/sign-in">
          Sign in
        </Link>
      </section>
    );
  }

  if (access.status === "not-configured") {
    return (
      <section className="admin-message">
        <h1>Administrator access needs setup</h1>
        <p>
          Add the administrator account email to <code>ADMIN_EMAILS</code> in
          the server environment. This page is not available to regular
          accounts.
        </p>
      </section>
    );
  }

  if (access.status === "forbidden") {
    return (
      <section className="admin-message">
        <h1>Access denied</h1>
        <p>This account is not authorized to manage Vistara storage.</p>
      </section>
    );
  }

  const [inventory, hardLimit] = await Promise.all([
    getNeonStorageInventory(),
    getStorageHardLimit(),
  ]);
  const usagePercent =
    hardLimit > 0
      ? Math.min(100, (inventory.branchBytes / hardLimit) * 100)
      : 100;
  const configuredBucketExists = inventory.buckets.some(
    (bucket) => bucket.name === inventory.configuredBucket,
  );

  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="page-title">Neon object storage</h1>
          <p className="muted">
            {inventory.objectCount.toLocaleString()} objects across{" "}
            {inventory.buckets.length} buckets on this branch.
          </p>
        </div>
        <Link className="text-link" href="/">
          Back to Vistara
        </Link>
      </div>

      <div className="storage-summary">
        <article className="storage-card">
          <span className="muted">Branch storage in listed buckets</span>
          <strong>{formatBytes(inventory.branchBytes)}</strong>
          <span className="muted">
            Current branch only; other branches are not included.
          </span>
        </article>
        <article className="storage-card">
          <span className="muted">Configured Vistara application cap</span>
          <strong>{formatBytes(hardLimit)}</strong>
          <span className="muted">
            {usagePercent.toFixed(1)}% used against this cap
          </span>
        </article>
        <article className="storage-card">
          <span className="muted">Configured application bucket</span>
          <strong>{inventory.configuredBucket || "Not configured"}</strong>
          <span className="muted">
            {configuredBucketExists ? "Bucket found" : "Bucket not found"}
          </span>
        </article>
      </div>

      <div
        aria-label="Storage limit usage"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(usagePercent)}
        className="storage-meter"
        role="meter"
      >
        <span style={{ width: `${usagePercent}%` }} />
      </div>

      <section className="admin-panel">
        <h2>Manage the application cap</h2>
        <StorageLimitForm currentLimitBytes={hardLimit} />
      </section>

      <section className="admin-panel">
        <h2>Bucket inventory</h2>
        {inventory.buckets.length ? (
          <div className="storage-table-wrap">
            <table className="storage-table">
              <thead>
                <tr>
                  <th scope="col">Bucket</th>
                  <th scope="col">Objects</th>
                  <th scope="col">Size</th>
                </tr>
              </thead>
              <tbody>
                {inventory.buckets.map((bucket) => (
                  <tr key={bucket.name}>
                    <td>{bucket.name}</td>
                    <td>{bucket.objectCount.toLocaleString()}</td>
                    <td>{formatBytes(bucket.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No buckets are available on this branch.</p>
        )}
      </section>

      <div className="notice" role="note">
        <strong>Usage scope</strong>
        <span>
          Neon&apos;s Free plan includes 5 GB of object storage per project;
          paid plans are metered without a fixed total-storage cap. The usage
          shown here is calculated from S3 object listings on this branch, not
          the project-wide billing meter. Confirm your plan and total usage in
          the Neon Console before setting a production cap.
        </span>
      </div>
    </>
  );
}

export default function AdminStoragePage() {
  return (
    <main className="page-wrap admin-page">
      <Suspense fallback={<p className="muted">Loading storage controls...</p>}>
        <StorageDashboard />
      </Suspense>
    </main>
  );
}
