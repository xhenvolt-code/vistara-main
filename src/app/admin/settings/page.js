import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import {
  AdminAccessNotice,
  AdminPageHeading,
} from "../admin-ui";

export const metadata = { title: "System settings" };

const integrations = [
  {
    label: "Neon PostgreSQL",
    configured: () => Boolean(process.env.DATABASE_URL),
    detail: "Application data and payment records",
  },
  {
    label: "Neon Auth",
    configured: () =>
      Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET),
    detail: "Email/password and Google OAuth sessions",
  },
  {
    label: "Clerk",
    configured: () => false,
    detail:
      "Not integrated; requires Clerk setup and an approved account-migration plan",
  },
  {
    label: "Neon Object Storage",
    configured: () =>
      Boolean(
        process.env.AWS_ENDPOINT_URL_S3 &&
          process.env.AWS_ACCESS_KEY_ID &&
          process.env.AWS_SECRET_ACCESS_KEY,
      ),
    detail: "S3-compatible media and asset storage",
  },
  {
    label: "MarzPay",
    configured: () =>
      Boolean(process.env.MARZPAY_API_KEY && process.env.MARZPAY_API_SECRET),
    detail: "Mobile-money collection and verified callbacks",
  },
  {
    label: "MarzPay webhook",
    configured: () => Boolean(process.env.MARZPAY_CALLBACK_URL),
    detail: "Public HTTPS callback required before checkout",
  },
  {
    label: "Cloudinary",
    configured: () => Boolean(process.env.CLOUDINARY_URL),
    detail: "Signed movie uploads and on-demand H.264/AAC MP4 delivery",
  },
  {
    label: "Cloudinary token access",
    configured: () =>
      Boolean(
        process.env.CLOUDINARY_AUTH_TOKEN_KEY &&
          /^(?:[a-f\d]{2})+$/i.test(process.env.CLOUDINARY_AUTH_TOKEN_KEY),
      ),
    detail:
      "Requires Cloudinary Support to enable token access and provision a key (Advanced plan or higher)",
  },
];

export default async function AdminSettingsPage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  return (
    <>
      <AdminPageHeading title="System settings" />
      <p className="muted admin-intro">
        This panel reports configuration presence only; secret values are never
        exposed. Change credentials in the deployment environment, not here.
      </p>
      <section className="admin-panel">
        <h2>Integration readiness</h2>
        <div className="admin-integration-list">
          {integrations.map((integration) => {
            const configured = integration.configured();

            return (
              <article className="admin-integration" key={integration.label}>
                <span
                  aria-label={configured ? "Configured" : "Needs configuration"}
                  className={`admin-health-dot ${configured ? "is-ready" : "is-missing"}`}
                />
                <div>
                  <strong>{integration.label}</strong>
                  <span>{integration.detail}</span>
                </div>
                <span
                  className={`status-pill ${configured ? "status-paid" : "status-pending"}`}
                >
                  {configured ? "Configured" : "Needs setup"}
                </span>
              </article>
            );
          })}
        </div>
      </section>
      <section className="admin-panel">
        <h2>Authentication provider</h2>
        <div className="admin-integration-list">
          <article className="admin-integration">
            <span
              aria-label="Active provider"
              className="admin-health-dot is-ready"
            />
            <div>
              <strong>Neon Auth</strong>
              <span>
                Active provider. Existing users and sessions remain on Neon.
              </span>
            </div>
            <span className="status-pill status-paid">Active</span>
          </article>
        </div>
        <p className="muted">
          Provider switching is unavailable until Clerk is integrated and the
          user, password, social-account, profile-ID, and session migration
          plan is approved. This prevents a provider change from locking out
          existing users.
        </p>
      </section>
      <section className="admin-panel">
        <h2>Administrator access</h2>
        <p className="muted">
          Manage <code>ADMIN_EMAILS</code> and <code>SUPERADMIN_EMAILS</code>{" "}
          through your private server environment. A superadmin can manage
          user accounts; add or remove administrators only through a trusted
          deployment workflow.
        </p>
      </section>
    </>
  );
}
