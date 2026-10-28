import Link from "next/link";
import { connection } from "next/server";
import { AdminAccessNotice, AdminPageHeading, formatAdminCurrency } from "./admin-ui";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Admin overview" };

const panels = [
  { href: "/admin/catalogue", title: "Catalogue & rights", text: "Manage titles, media assets, and distribution clearances." },
  { href: "/admin/products", title: "Access products", text: "Set pass durations, prices, ordering, and availability." },
  { href: "/admin/payments", title: "Purchases & payments", text: "Review purchase states, MarzPay transactions, and event history." },
  { href: "/admin/finance", title: "Revenue shares", text: "Assign administrator shares, record reinvestment choices, and review payout requests." },
  { href: "/admin/users", title: "Users", text: "Review Vistara profiles and account status." },
  { href: "/admin/storage", title: "Object storage", text: "Inspect branch inventory and configure the application cap." },
  { href: "/admin/audit", title: "Audit history", text: "See who changed system records and when." },
  { href: "/admin/settings", title: "System settings", text: "Check integration readiness without exposing credentials." },
];

export default async function AdminOverviewPage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  const [
    movies,
    products,
    users,
    purchases,
    paidPurchases,
    pendingPurchases,
    recentPurchases,
    pendingRights,
  ] = await Promise.all([
    prisma.movie.count(),
    prisma.accessProduct.count(),
    prisma.userProfile.count(),
    prisma.purchase.count(),
    prisma.purchase.aggregate({
      where: { status: "PAID" },
      _sum: { amountUgx: true },
    }),
    prisma.purchase.count({ where: { status: "PENDING" } }),
    prisma.purchase.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        productName: true,
        amountUgx: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.movie.count({ where: { rightsStatus: "PENDING" } }),
  ]);

  return (
    <>
      <AdminPageHeading title="System overview">
        <span className="admin-role-badge">
          Signed in as {access.email}
        </span>
      </AdminPageHeading>

      <section aria-label="Business metrics" className="admin-metrics">
        <article className="admin-metric">
          <span>Paid purchase volume</span>
          <strong>{formatAdminCurrency(paidPurchases._sum.amountUgx ?? 0)}</strong>
          <small>Gross recorded purchases, before provider fees/refunds</small>
        </article>
        <article className="admin-metric">
          <span>Pending purchases</span>
          <strong>{pendingPurchases.toLocaleString()}</strong>
          <small>Require payment verification or reconciliation</small>
        </article>
        <article className="admin-metric">
          <span>Catalogue titles</span>
          <strong>{movies.toLocaleString()}</strong>
          <small>{pendingRights.toLocaleString()} have rights pending review</small>
        </article>
        <article className="admin-metric">
          <span>Access products</span>
          <strong>{products.toLocaleString()}</strong>
          <small>{users.toLocaleString()} Vistara user profiles</small>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Recent purchases</h2>
          <Link className="text-link" href="/admin/payments">
            View all
          </Link>
        </div>
        {recentPurchases.length ? (
          <div className="storage-table-wrap">
            <table className="storage-table">
              <thead>
                <tr>
                  <th scope="col">Purchase</th>
                  <th scope="col">Product</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{purchase.id.slice(0, 10)}</td>
                    <td>{purchase.productName}</td>
                    <td>{formatAdminCurrency(purchase.amountUgx)}</td>
                    <td>
                      <span className={`status-pill status-${purchase.status.toLowerCase()}`}>
                        {purchase.status}
                      </span>
                    </td>
                    <td>{purchase.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No purchases have been recorded.</p>
        )}
      </section>

      <section className="admin-quick-links" aria-label="Admin screens">
        {panels.map((panel) => (
          <Link className="admin-quick-link" href={panel.href} key={panel.href}>
            <strong>{panel.title}</strong>
            <span>{panel.text}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
