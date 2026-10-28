import { z } from "zod";
import { auth } from "@/server/auth/neon";
import { prisma } from "@/server/db/prisma";

export async function GET(_request, { params }) {
  const { data: session, error } = await auth.getSession();

  if (error) {
    throw new Error("Unable to verify the current authentication session.", {
      cause: error,
    });
  }

  if (!session?.user) {
    return Response.json({ error: "Sign in to view this purchase." }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = z.string().min(1).max(100).safeParse(id);

  if (!parsedId.success) {
    return Response.json({ error: "Purchase not found." }, { status: 404 });
  }

  const purchase = await prisma.purchase.findFirst({
    where: { id: parsedId.data, userId: session.user.id },
    select: {
      status: true,
      amountUgx: true,
      currency: true,
      createdAt: true,
      entitlement: {
        select: {
          startsAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      },
    },
  });

  if (!purchase) {
    return Response.json({ error: "Purchase not found." }, { status: 404 });
  }

  return Response.json(purchase, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
