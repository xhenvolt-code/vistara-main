import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import {
  AdminAccessNotice,
  AdminPageHeading,
  formatAdminCurrency,
} from "../admin-ui";

export const metadata = { title: "Purchases and payments" };

export default async function AdminPaymentsPage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  const purchases = await prisma.purchase.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      entitlement: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        include: {
          events: { orderBy: { receivedAt: "desc" }, take: 3 },
        },
      },
    },
  });

  return (
    <>
      <AdminPageHeading title="Purchases & payments" />
      <p className="muted admin-intro">
        Payment status is reconciled from verified MarzPay callbacks. This
        screen is intentionally read-only; do not mark a payment as paid
        manually.
      </p>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Latest purchases</h2>
          <span className="admin-role-badge">Showing up to 100</span>
        </div>
        {purchases.length ? (
          <div className="admin-record-list">
            {purchases.map((purchase) => (
              <details className="admin-record" key={purchase.id}>
                <summary>
                  <span>
                    <strong>{purchase.productName}</strong>
                    <small>
                      {purchase.id} · User {purchase.userId}
                    </small>
                  </span>
                  <span className="admin-record-summary-meta">
                    <strong>{formatAdminCurrency(purchase.amountUgx, purchase.currency)}</strong>
                    <span
                      className={`status-pill status-${purchase.status.toLowerCase()}`}
                    >
                      {purchase.status}
                    </span>
                  </span>
                </summary>
                <div className="admin-payment-detail">
                  <p>
                    <strong>Created:</strong>{" "}
                    {purchase.createdAt.toLocaleString()}
                  </p>
                  <p>
                    <strong>Pass snapshot:</strong> {purchase.durationDays} days
                  </p>
                  {purchase.entitlement && (
                    <p>
                      <strong>Entitlement:</strong>{" "}
                      {purchase.entitlement.startsAt.toLocaleString()} –{" "}
                      {purchase.entitlement.expiresAt.toLocaleString()}
                      {purchase.entitlement.revokedAt ? " (revoked)" : ""}
                    </p>
                  )}
                  {purchase.transactions.length ? (
                    purchase.transactions.map((transaction) => (
                      <article
                        className="admin-transaction"
                        key={transaction.id}
                      >
                        <strong>
                          {transaction.provider} · {transaction.status}
                        </strong>
                        <span>Reference: {transaction.providerReference}</span>
                        <span>
                          Provider transaction:{" "}
                          {transaction.providerTransactionId ?? "Not assigned"}
                        </span>
                        <span>
                          Verified:{" "}
                          {transaction.verifiedAt?.toLocaleString() ?? "Not verified"}
                        </span>
                        {transaction.events.map((event) => (
                          <span key={event.id}>
                            Event: {event.eventType} ·{" "}
                            {event.processedAt ? "processed" : "pending"} ·{" "}
                            {event.receivedAt.toLocaleString()}
                          </span>
                        ))}
                      </article>
                    ))
                  ) : (
                    <p className="muted">No provider transaction is attached.</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="muted">No purchases have been recorded.</p>
        )}
      </section>
    </>
  );
}
