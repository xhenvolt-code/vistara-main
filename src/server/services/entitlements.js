import "server-only";
import { prisma } from "@/server/db/prisma";

export async function authorizePlayback(userId, movieId) {
  const [profile, movie, entitlement] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { accountStatus: true },
    }),
    prisma.movie.findFirst({
      where: {
        id: movieId,
        status: "PUBLISHED",
        rightsStatus: "APPROVED",
        videoAssets: { some: { status: "READY" } },
      },
      select: { id: true },
    }),
    prisma.entitlement.findFirst({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        purchase: { status: "PAID" },
      },
      orderBy: { expiresAt: "desc" },
      select: { startsAt: true, expiresAt: true },
    }),
  ]);

  if (profile?.accountStatus === "SUSPENDED") {
    return { allowed: false, reason: "account_suspended" };
  }

  if (!movie) {
    return { allowed: false, reason: "movie_unavailable" };
  }

  if (!entitlement) {
    return { allowed: false, reason: "access_required" };
  }

  return {
    allowed: true,
    startsAt: entitlement.startsAt,
    expiresAt: entitlement.expiresAt,
  };
}
