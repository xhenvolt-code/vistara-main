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
      <p className="eyebrow">Simple viewing access</p>
      <h1 className="page-title">Choose your movie-night pass.</h1>
      <p className="muted">
        Choose an access pass that works for your movie night.
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
                <Link className="button-secondary" href="/auth/sign-in">
                  Sign in to purchase
                </Link>
              </article>
            ))}
          </div>
          <div className="notice" role="note" style={{ marginTop: 28 }}>
            <strong>Payments not enabled</strong>
            <span>
              MarzPay checkout will be enabled when its public HTTPS callback
              endpoint is configured and verified.
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
