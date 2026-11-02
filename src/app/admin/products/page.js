import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { AdminAccessNotice, AdminPageHeading, formatAdminCurrency } from "../admin-ui";
import { ProductEditor } from "../admin-forms";

export const metadata = { title: "Subscription plans" };

export default async function AdminProductsPage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  const products = await prisma.accessProduct.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { purchases: true } } },
  });

  return (
    <>
      <AdminPageHeading title="Subscription plans" />
      <p className="muted admin-intro">
        Plan price and term are copied into each purchase at checkout.
        Disabling a plan prevents new subscriptions but preserves existing
        purchase records.
      </p>

      <section className="admin-panel">
        <h2>Create a subscription plan</h2>
        <ProductEditor />
      </section>

      <section className="admin-panel">
        <h2>Configured plans</h2>
        {products.length ? (
          <div className="admin-record-list">
            {products.map((product) => (
              <details className="admin-record" key={product.id}>
                <summary>
                  <span>
                    <strong>{product.name}</strong>
                    <small>
                      {product.durationDays === 1
                        ? "Daily"
                        : product.durationDays === 7
                          ? "Weekly"
                          : product.durationDays === 14
                            ? "Every two weeks"
                            : product.durationDays === 30
                              ? "Monthly (30 days)"
                              : `${product.durationDays} days`} ·{" "}
                      {formatAdminCurrency(product.priceUgx)} ·{" "}
                      {product._count.purchases} purchases
                    </small>
                  </span>
                  <span
                    className={`status-pill ${product.isAvailable ? "status-paid" : "status-info"}`}
                  >
                    {product.isAvailable ? "Available" : "Disabled"}
                  </span>
                </summary>
                <ProductEditor product={product} label="Save plan" />
              </details>
            ))}
          </div>
        ) : (
          <p className="muted">No subscription plans have been configured.</p>
        )}
      </section>
    </>
  );
}
