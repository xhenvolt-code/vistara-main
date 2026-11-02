import { connection } from "next/server";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import {
  AdminAccessNotice,
  AdminPageHeading,
} from "../admin-ui";
import {
  TemporarySubscriptionGrantForm,
  UserStatusForm,
} from "../admin-forms";

export const metadata = { title: "User management" };

export default async function AdminUsersPage() {
  await connection();
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return <AdminAccessNotice status={access.status} />;
  }

  const users = await prisma.userProfile.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  const superadmins = new Set(
    (process.env.SUPERADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const userIds = users.map((user) => user.userId);
  const now = new Date();
  const [purchaseCounts, activeEntitlements] = userIds.length
    ? await Promise.all([
        prisma.purchase.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _count: { _all: true },
        }),
        prisma.entitlement.groupBy({
          by: ["userId"],
          where: {
            userId: { in: userIds },
            startsAt: { lte: now },
            revokedAt: null,
            expiresAt: { gt: now },
          },
          _max: { expiresAt: true },
        }),
      ])
    : [[], []];
  const purchasesByUser = new Map(
    purchaseCounts.map((entry) => [entry.userId, entry._count._all]),
  );
  const entitlementsByUser = new Map(
    activeEntitlements.map((entry) => [
      entry.userId,
      {
        expiresAt: entry._max.expiresAt,
      },
    ]),
  );

  return (
    <>
      <AdminPageHeading title="User accounts" />
      <p className="muted admin-intro">
        Administrators can grant temporary subscription access for testing and
        support. Only superadmins can view email addresses or change account
        status; authentication credentials remain managed by Neon Auth.
      </p>
      <section className="admin-panel">
        <h2>Registered profiles</h2>
        {users.length ? (
          <div className="storage-table-wrap">
            <table className="storage-table admin-users-table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Status</th>
                  <th scope="col">Purchases</th>
                  <th scope="col">Active subscription</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Subscription access</th>
                  {access.role === "superadmin" && <th scope="col">Account action</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.userId}>
                    <td>
                      <strong>{user.displayName || "Vistara user"}</strong>
                      <span className="admin-user-email">
                        {access.role === "superadmin"
                          ? user.email || user.userId
                          : `User ID: ${user.userId}`}
                      </span>
                    </td>
                    <td>{user.accountStatus}</td>
                    <td>{purchasesByUser.get(user.userId) ?? 0}</td>
                    <td>
                      {entitlementsByUser.has(user.userId)
                        ? `Until ${entitlementsByUser.get(user.userId).expiresAt?.toLocaleString()}`
                        : "None"}
                    </td>
                    <td>{user.createdAt.toLocaleDateString()}</td>
                    <td>
                      <TemporarySubscriptionGrantForm userId={user.userId} />
                    </td>
                    {access.role === "superadmin" && (
                      <td>
                        {user.email &&
                        superadmins.has(user.email.toLowerCase()) ? (
                          <span className="status-pill status-info">
                            Protected superadmin
                          </span>
                        ) : (
                          <UserStatusForm
                            status={user.accountStatus}
                            userId={user.userId}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            No profiles are synced yet. Profiles are created when members sign
            in or complete a purchase.
          </p>
        )}
      </section>
    </>
  );
}
