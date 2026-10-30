import { connection } from "next/server";
import { auth } from "@/server/auth/neon";
import { syncAuthProfile } from "@/server/auth/sync-profile";
import { prisma } from "@/server/db/prisma";

export async function GET() {
  await connection();
  const { data: session, error } = await auth.getSession();

  if (error) {
    throw new Error("Unable to verify the current mobile authentication session.", {
      cause: error,
    });
  }

  if (!session?.user) {
    return Response.json(
      { error: "Sign in to view your Vistara account." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  await syncAuthProfile(session.user);

  const now = new Date();
  const [profile, entitlement, purchases] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { displayName: true, accountStatus: true },
    }),
    prisma.entitlement.findFirst({
      where: {
        userId: session.user.id,
        startsAt: { lte: now },
        expiresAt: { gt: now },
        revokedAt: null,
        purchase: { status: "PAID" },
      },
      orderBy: { expiresAt: "desc" },
      select: {
        startsAt: true,
        expiresAt: true,
        purchase: { select: { productName: true } },
      },
    }),
    prisma.purchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        productName: true,
        amountUgx: true,
        currency: true,
        status: true,
        createdAt: true,
        entitlement: {
          select: { startsAt: true, expiresAt: true, revokedAt: true },
        },
      },
    }),
  ]);

  return Response.json(
    {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: profile?.displayName || session.user.name || "",
        accountStatus: profile?.accountStatus || "ACTIVE",
      },
      entitlement,
      purchases,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
