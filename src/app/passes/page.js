import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/server/auth/neon";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { prisma } from "@/server/db/prisma";
import { getMarzPayReadiness } from "@/server/payments/marzpay";
import { SubscriptionCheckout } from "./subscription-checkout";

export const metadata = {
  title: "Subscriptions",
};

async function PassOptions() {
  await connection();
  const { data: session, error: sessionError } = await auth.getSession();

  if (sessionError) {
    throw new Error("Unable to verify the current subscription session.", {
      cause: sessionError,
    });
  }

  const plans = await prisma.accessProduct.findMany({
    where: { isAvailable: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const user = session?.user ?? null;
  const now = new Date();
  const currentSubscription = user
    ? await prisma.entitlement.findFirst({
        where: {
          userId: user.id,
          startsAt: { lte: now },
          expiresAt: { gt: now },
          revokedAt: null,
        },
        orderBy: { expiresAt: "desc" },
        select: { expiresAt: true },
      })
    : null;
  const checkoutReady = getMarzPayReadiness().checkoutReady;

  return (
    <main className="page-wrap section">
      <p className="eyebrow">Vistara subscriptions</p>
      <h1 className="page-title">Choose your viewing subscription.</h1>
      <p className="muted">
        Choose a subscription period and pay securely with Uganda mobile money
        through MarzPay.
      </p>
      {currentSubscription && (
        <div className="notice subscription-status" role="status">
          <strong>Your subscription is active</strong>
          <span>
            You can watch until {currentSubscription.expiresAt.toLocaleString()}.
          </span>
        </div>
      )}
      {plans.length ? (
        <>
          <div className="pass-grid">
            {plans.map((plan) => (
              <article className="pass-card" key={plan.id}>
                <h2>{plan.name}</h2>
                <p className="pass-duration">
                  {plan.durationDays === 1
                    ? "Daily"
                    : plan.durationDays === 7
                      ? "Weekly"
                      : plan.durationDays === 14
                        ? "Every two weeks"
                        : plan.durationDays === 30
                          ? "Monthly (30 days)"
                          : `${plan.durationDays} days`}{" "}
                  subscription term
                </p>
                <p className="pass-price">
                  UGX {plan.priceUgx.toLocaleString("en-UG")}
                </p>
                <SubscriptionCheckout
                  checkoutReady={checkoutReady}
                  plan={plan}
                  signedIn={Boolean(user)}
                />
              </article>
            ))}
          </div>
          <div className="notice" role="note" style={{ marginTop: 28 }}>
            <strong>Prepaid subscription</strong>
            <span>
              Plans are paid upfront for the displayed term and do not renew
              automatically. Access begins only after MarzPay payment
              verification.
            </span>
          </div>
        </>
      ) : (
        <div className="empty-state" style={{ marginTop: 30 }}>
          No subscription plans are available right now. Please check back soon.
        </div>
      )}
      <p className="muted" style={{ marginTop: 24 }}>
        <Link className="text-link" href="/movies">
          Return to the catalogue
        </Link>
        {user && (
          <span>
            {" "}· Signed in as {user.email || user.name || "Vistara member"}
          </span>
        )}
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
            <p className="muted">Loading subscriptions...</p>
          </main>
        }
      >
        <PassOptions />
      </Suspense>
      <SiteFooter />
    </>
  );
}
