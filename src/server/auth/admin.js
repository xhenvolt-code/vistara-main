import "server-only";
import { auth } from "./neon";
import { prisma } from "@/server/db/prisma";

export async function getAdminAccess() {
  const { data: session, error } = await auth.getSession();

  if (error) {
    throw new Error("Unable to verify the current authentication session.", {
      cause: error,
    });
  }

  if (!session?.user) {
    return { status: "unauthenticated" };
  }

  const email = session.user.email?.trim().toLowerCase();
  const superadmins = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const admins = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  superadmins.forEach((value) => admins.add(value));

  if (admins.size === 0) {
    return { status: "not-configured" };
  }

  if (!email || !admins.has(email)) {
    return { status: "forbidden" };
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { accountStatus: true },
  });

  if (!profile || profile.accountStatus !== "ACTIVE") {
    return { status: "forbidden" };
  }

  return {
    status: "authorized",
    role: superadmins.includes(email) ? "superadmin" : "admin",
    userId: session.user.id,
    email,
  };
}
