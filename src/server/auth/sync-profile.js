import "server-only";
import { prisma } from "@/server/db/prisma";

export async function syncAuthProfile(user) {
  const email = user.email?.trim().toLowerCase();

  if (!user.id || !email) {
    throw new Error("The authenticated account is missing its user ID or email.");
  }

  const displayName = user.name?.trim() || null;

  return prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      email,
      displayName,
    },
    update: {
      email,
      displayName,
    },
    select: { userId: true },
  });
}
