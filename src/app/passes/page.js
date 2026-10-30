import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { prisma } from "@/server/db/prisma";

export const metadata = {
  title: "Access passes",
};

async function PassOptions() {
  await connection();
  const availablePasses = await prisma.accessProduct.findMany({
    where: { isAvailable: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <main className="page-wrap section">
      <p className="eyebrow">Access pass previews</p>
      <h1 className="page-title">Explore viewing passes.</h1>
      <p className="muted">
        Review the pass options currently planned for Vistara.
      </p>
      {availablePasses.length ? (
        <>
          <div className="pass-grid">
            {availablePasses.map((pass) => (
              <article className="pass-card" key={pass.id}>
                <h2>{pass.name}</h2>
                <p className="pass-duration">
                  {pass.durationDays}{" "}
                  {pass.durationDays === 1 ? "day" : "days"} of access
                </p>
                <p className="pass-price">
                  UGX {pass.priceUgx.toLocaleString("en-UG")}
                </p>
                <button className="button-secondary" disabled type="button">
                  Purchases unavailable
                </button>
              </article>
            ))}
          </div>
          <div className="notice" role="note" style={{ marginTop: 28 }}>
            <strong>Preview only</strong>
            <span>
              Online checkout is not available yet. Prices shown are previews;
              do not make a payment. You can still{" "}
              <Link className="text-link" href="/auth/sign-in">
                sign in to your account
              </Link>
              .
            </span>
          </div>
        </>
      ) : (
        <div className="empty-state" style={{ marginTop: 30 }}>
          No access passes are available right now. Please check back soon.
        </div>
      )}
      <p className="muted" style={{ marginTop: 24 }}>
        <Link className="text-link" href="/movies">
          Return to the catalogue
        </Link>
      </p>
    </main>
  );
}

export default function PassesPage() {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <main className="page-wrap section">
            <p className="muted">Loading access passes...</p>
          </main>
        }
      >
        <PassOptions />
      </Suspense>
      <SiteFooter />
    </>
  );
}
