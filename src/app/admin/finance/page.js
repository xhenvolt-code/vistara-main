import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import {
  AdminAccessNotice,
  AdminPageHeading,
  formatAdminCurrency,
} from "../admin-ui";
import {
  AdminShareForm,
  AllocationDecisionForm,
  SharePayoutRequestForm,
  SharePayoutReviewForm,
} from "./finance-forms";

export const metadata = { title: "Revenue shares and reinvestment" };

const balanceReducingPayoutStatuses = ["REQUESTED", "APPROVED", "PAID"];

function sumForUser(rows, userId) {
  return rows
    .filter((row) => row.shareholderUserId === userId)
    .reduce((total, row) => total + (row._sum.amountUgx ?? 0), 0);
}

export default async function AdminFinancePage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  const shareholders = access.role === "superadmin"
    ? await prisma.adminShareholder.findMany({
        orderBy: [{ isActive: "desc" }, { percentageBps: "desc" }],
        include: { profile: { select: { email: true, displayName: true } } },
      })
    : [];
  const shareholderUserIds =
    access.role === "superadmin"
      ? shareholders.map((shareholder) => shareholder.userId)
      : [access.userId];
  const [availableTotals, reinvestedTotals, reservedTotals, allocations, payouts] =
    shareholderUserIds.length
      ? await Promise.all([
          prisma.adminRevenueAllocation.groupBy({
            by: ["shareholderUserId"],
            where: {
              shareholderUserId: { in: shareholderUserIds },
              status: "AVAILABLE",
            },
            _sum: { amountUgx: true },
          }),
          prisma.adminRevenueAllocation.groupBy({
            by: ["shareholderUserId"],
            where: {
              shareholderUserId: { in: shareholderUserIds },
              status: "REINVESTED",
            },
            _sum: { amountUgx: true },
          }),
          prisma.sharePayoutRequest.groupBy({
            by: ["shareholderUserId"],
            where: {
              shareholderUserId: { in: shareholderUserIds },
              status: { in: balanceReducingPayoutStatuses },
            },
            _sum: { amountUgx: true },
          }),
          prisma.adminRevenueAllocation.findMany({
            where: {
              shareholderUserId: { in: shareholderUserIds },
            },
            take: 50,
            orderBy: { createdAt: "desc" },
            include: { purchase: { select: { productName: true } } },
          }),
          prisma.sharePayoutRequest.findMany({
            where:
              access.role === "superadmin"
                ? {}
                : { shareholderUserId: access.userId },
            take: 100,
            orderBy: { createdAt: "desc" },
          }),
        ])
      : [[], [], [], [], []];

  const ownAvailableGross = sumForUser(availableTotals, access.userId);
  const ownReserved = sumForUser(reservedTotals, access.userId);
  const ownAvailable = Math.max(0, ownAvailableGross - ownReserved);
  const ownReinvested = sumForUser(reinvestedTotals, access.userId);
  const availableByUser = new Map(
    shareholders.map((shareholder) => [
      shareholder.userId,
      Math.max(
        0,
        sumForUser(availableTotals, shareholder.userId) -
          sumForUser(reservedTotals, shareholder.userId),
      ),
    ]),
  );
  const reinvestedByUser = new Map(
    shareholders.map((shareholder) => [
      shareholder.userId,
      sumForUser(reinvestedTotals, shareholder.userId),
    ]),
  );
  const adminEmails = new Set(
    `${process.env.ADMIN_EMAILS ?? ""},${process.env.SUPERADMIN_EMAILS ?? ""}`
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const adminProfiles =
    access.role === "superadmin"
      ? await prisma.userProfile.findMany({
          where: {
            OR: [
              { email: { in: [...adminEmails] } },
              {
                userId: {
                  in: shareholders.map((shareholder) => shareholder.userId),
                },
              },
            ],
          },
          orderBy: { email: "asc" },
          select: { userId: true, email: true, displayName: true },
        })
      : [];
  const shareholderByUser = new Map(
    shareholders.map((shareholder) => [shareholder.userId, shareholder]),
  );
  const allocationTotal = allocations.reduce(
    (total, allocation) => total + allocation.amountUgx,
    0,
  );

  return (
    <>
      <AdminPageHeading title="Revenue shares & reinvestment" />
      <p className="muted admin-intro">
        Share percentages allocate a portion of future verified gross MarzPay
        collections to configured administrators. They are internal allocation
        settings, not legal equity, provider balances, or guaranteed payouts.
      </p>

      <section aria-label="Revenue share balances" className="admin-metrics">
        <article className="admin-metric">
          <span>{access.role === "superadmin" ? "My available share" : "Available share"}</span>
          <strong>{formatAdminCurrency(ownAvailable)}</strong>
          <small>Unreserved gross allocation eligible for a payout request</small>
        </article>
        <article className="admin-metric">
          <span>{access.role === "superadmin" ? "My reinvested share" : "Reinvested share"}</span>
          <strong>{formatAdminCurrency(ownReinvested)}</strong>
          <small>Marked for retention; not an actual investment transaction</small>
        </article>
        {access.role === "superadmin" && (
          <>
            <article className="admin-metric">
              <span>Active shares assigned</span>
              <strong>
                {(shareholders
                  .filter((shareholder) => shareholder.isActive)
                  .reduce(
                    (total, shareholder) => total + shareholder.percentageBps,
                    0,
                  ) / 100).toFixed(2)}%
              </strong>
              <small>Combined active allocation, capped at 100%</small>
            </article>
            <article className="admin-metric">
              <span>Recent allocations</span>
              <strong>{formatAdminCurrency(allocationTotal)}</strong>
              <small>Latest {allocations.length} entries in view, not total lifetime allocation</small>
            </article>
          </>
        )}
      </section>

      {access.role === "superadmin" && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Administrator share assignments</h2>
            <span className="admin-role-badge">
              {shareholders.length} assigned
            </span>
          </div>
          <p className="muted">
            Assign percentages to existing admin accounts. Percentage shares
            are calculated against gross verified purchase amounts before
            provider fees, refunds, and operating costs. Changes apply only to
            future successful collections.
          </p>
          {adminProfiles.length ? (
            <div className="storage-table-wrap">
              <table className="storage-table">
                <thead>
                  <tr>
                    <th scope="col">Administrator</th>
                    <th scope="col">Share</th>
                    <th scope="col">Available balance</th>
                    <th scope="col">Reinvested</th>
                    <th scope="col">Change share</th>
                  </tr>
                </thead>
                <tbody>
                  {adminProfiles.map((profile) => {
                    const shareholder = shareholderByUser.get(profile.userId);
                    return (
                      <tr key={profile.userId}>
                        <td>
                          <strong>
                            {profile.displayName || profile.email || "Administrator"}
                          </strong>
                          <span className="admin-user-email">
                            {profile.email || profile.userId}
                          </span>
                        </td>
                        <td>
                          {shareholder?.isActive
                            ? `${(shareholder.percentageBps / 100).toFixed(2)}%`
                            : "Not assigned"}
                        </td>
                        <td>
                          {formatAdminCurrency(
                            availableByUser.get(profile.userId) ?? 0,
                          )}
                        </td>
                        <td>
                          {formatAdminCurrency(
                            reinvestedByUser.get(profile.userId) ?? 0,
                          )}
                        </td>
                        <td>
                          <AdminShareForm
                            email={profile.email || "this admin"}
                            percentageBps={shareholder?.percentageBps ?? 0}
                            userId={profile.userId}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">
              No configured administrators have signed in and synced a profile
              yet. Assign them in the server allowlists and have them sign in
              before assigning shares.
            </p>
          )}
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>{access.role === "superadmin" ? "All payout requests" : "My payout requests"}</h2>
          <span className="admin-role-badge">{payouts.length} recent</span>
        </div>
        {payouts.length ? (
          <div className="admin-record-list">
            {payouts.map((payout) => {
              const profile = shareholders.find(
                (shareholder) =>
                  shareholder.userId === payout.shareholderUserId,
              )?.profile;
              return (
                <article className="admin-record" key={payout.id}>
                  <div className="admin-record-summary-meta">
                    <strong>{formatAdminCurrency(payout.amountUgx)}</strong>
                    <span className={`status-pill status-${payout.status.toLowerCase()}`}>
                      {payout.status}
                    </span>
                    {access.role === "superadmin" && (
                      <span>{profile?.email || payout.shareholderUserId}</span>
                    )}
                    <time dateTime={payout.createdAt.toISOString()}>
                      {payout.createdAt.toLocaleString()}
                    </time>
                    {payout.externalReference && (
                      <span>External reference: {payout.externalReference}</span>
                    )}
                    {payout.reviewNote && <span>Review note: {payout.reviewNote}</span>}
                  </div>
                  {access.role === "superadmin" &&
                    ["REQUESTED", "APPROVED"].includes(payout.status) && (
                      <SharePayoutReviewForm payout={payout} />
                    )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">No payout requests have been recorded.</p>
        )}
      </section>

      <section className="admin-panel">
        <h2>My allocation decisions</h2>
        <p className="muted">
          You may keep each available allocation eligible for a payout request
          or mark it retained for reinvestment. This records your preference;
          it does not transfer money or execute an investment.
        </p>
        {allocations.filter(
          (allocation) => allocation.shareholderUserId === access.userId,
        ).length ? (
          <div className="admin-record-list">
            {allocations
              .filter(
                (allocation) =>
                  allocation.shareholderUserId === access.userId,
              )
              .map((allocation) => (
                <article className="admin-record" key={allocation.id}>
                  <div className="admin-record-summary-meta">
                    <strong>{formatAdminCurrency(allocation.amountUgx)}</strong>
                    <span>{allocation.purchase.productName}</span>
                    <span>
                      {(allocation.percentageBps / 100).toFixed(2)}% of{" "}
                      {formatAdminCurrency(allocation.grossAmountUgx)} gross
                    </span>
                    <span>{allocation.createdAt.toLocaleString()}</span>
                    <span className={`status-pill status-${allocation.status.toLowerCase()}`}>
                      {allocation.status}
                    </span>
                  </div>
                  <AllocationDecisionForm allocation={allocation} />
                </article>
              ))}
          </div>
        ) : (
          <p className="muted">
            No allocations yet. Shares begin accruing on verified purchases
            after the revenue-share migration is applied.
          </p>
        )}
        <div className="admin-payout-request">
          <p>
            Available to request: <strong>{formatAdminCurrency(ownAvailable)}</strong>
          </p>
          <SharePayoutRequestForm />
          <p className="muted">
            Payout requests require review by a different superadmin. Vistara
            records requests and external transfer references; MarzPay payout
            execution is not integrated.
          </p>
        </div>
      </section>
    </>
  );
}
