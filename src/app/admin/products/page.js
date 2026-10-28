import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import { AdminAccessNotice, AdminPageHeading, formatAdminCurrency } from "../admin-ui";
import { ProductEditor } from "../admin-forms";

export const metadata = { title: "Access products" };

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
      <AdminPageHeading title="Access products" />
      <p className="muted admin-intro">
        Product price and duration are copied into each purchase at checkout.
        Disabling a product prevents new purchases but preserves existing
        purchase records.
      </p>

      <section className="admin-panel">
        <h2>Create a pass</h2>
        <ProductEditor />
      </section>

      <section className="admin-panel">
        <h2>Configured products</h2>
        {products.length ? (
          <div className="admin-record-list">
            {products.map((product) => (
              <details className="admin-record" key={product.id}>
                <summary>
                  <span>
                    <strong>{product.name}</strong>
                    <small>
                      {product.durationDays} days ·{" "}
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
                <ProductEditor product={product} label="Save product" />
              </details>
            ))}
          </div>
        ) : (
          <p className="muted">No access products have been configured.</p>
        )}
      </section>
    </>
  );
}
