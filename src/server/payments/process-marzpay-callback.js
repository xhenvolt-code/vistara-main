import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { calculateEntitlementWindow } from "@/domain/entitlement-window";
import { calculateShareAmount } from "@/domain/revenue-shares";
import { getMarzPayTransaction } from "./marzpay";

const callbackSchema = z.object({
  event_type: z.enum([
    "collection.completed",
    "collection.failed",
    "collection.cancelled",
  ]),
  transaction: z.object({
    uuid: z.string().uuid(),
    reference: z.string().uuid(),
    status: z.string(),
    amount: z.object({
      raw: z.number().int(),
      currency: z.string(),
    }),
  }),
});

const finalStatuses = {
  completed: "SUCCEEDED",
  failed: "FAILED",
  cancelled: "CANCELLED",
};

function getCallbackPayload(body) {
  if (body && typeof body === "object" && body.data?.transaction) {
    return body.data;
  }

  return body;
}

function getExpectedStatus(eventType) {
  return eventType.split(".")[1];
}

export async function processMarzPayCallback(body) {
  const parsed = callbackSchema.safeParse(getCallbackPayload(body));

  if (!parsed.success) {
    throw new Error("MarzPay callback payload is invalid.");
  }

  const callback = parsed.data;
  const expectedStatus = getExpectedStatus(callback.event_type);
  const verified = await getMarzPayTransaction(callback.transaction.uuid);
  const verifiedStatus = verified.status.toLowerCase();

  if (
    verified.uuid !== callback.transaction.uuid ||
    verified.reference !== callback.transaction.reference ||
    verifiedStatus !== expectedStatus ||
    verified.amount.raw !== callback.transaction.amount.raw ||
    verified.amount.currency !== callback.transaction.amount.currency ||
    verified.amount.currency !== "UGX"
  ) {
    throw new Error("MarzPay callback did not match its server-verified transaction.");
  }

  const transaction = await prisma.paymentTransaction.findUnique({
    where: {
      provider_providerReference: {
        provider: "MARZPAY",
        providerReference: verified.reference,
      },
    },
    include: { purchase: true },
  });

  if (!transaction) {
    throw new Error("MarzPay callback does not match a Vistara purchase.");
  }

  if (
    verified.amount.raw !== transaction.amountUgx ||
    verified.amount.currency !== transaction.currency ||
    transaction.purchase.amountUgx !== verified.amount.raw ||
    transaction.purchase.currency !== verified.amount.currency
  ) {
    throw new Error("MarzPay transaction amount does not match the Vistara purchase.");
  }

  const paymentStatus = finalStatuses[verifiedStatus];

  if (!paymentStatus) {
    throw new Error("MarzPay transaction is not in a final payment state.");
  }

  const providerEventId = `${verified.uuid}:${verifiedStatus}`;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const paymentEvent = await tx.paymentEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: "MARZPAY",
          providerEventId,
        },
      },
      create: {
        provider: "MARZPAY",
        providerEventId,
        eventType: callback.event_type,
        transactionId: transaction.id,
      },
      update: {},
    });

    if (paymentEvent.processedAt) {
      return { status: "duplicate" };
    }

    const currentPurchase = await tx.purchase.findUniqueOrThrow({
      where: { id: transaction.purchaseId },
    });

    if (currentPurchase.status === "PAID" && paymentStatus !== "SUCCEEDED") {
      throw new Error("A final MarzPay failure conflicts with an already-paid purchase.");
    }

    await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        providerTransactionId: verified.uuid,
        status: paymentStatus,
        verifiedAt: now,
      },
    });

    if (paymentStatus === "SUCCEEDED" && currentPurchase.status !== "PAID") {
      await tx.financialSharePolicy.update({
        where: { id: "global" },
        data: { revision: { increment: 1 } },
      });
      const shareholders = await tx.adminShareholder.findMany({
        where: { isActive: true, percentageBps: { gt: 0 } },
        select: {
          userId: true,
          percentageBps: true,
          profile: { select: { email: true } },
        },
      });
      const allowedAdminEmails = new Set(
        `${process.env.ADMIN_EMAILS ?? ""},${process.env.SUPERADMIN_EMAILS ?? ""}`
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      );

      await tx.purchase.update({
        where: { id: currentPurchase.id },
        data: { status: "PAID" },
      });

      const allocations = shareholders
        .filter(
          (shareholder) =>
            shareholder.profile.email &&
            allowedAdminEmails.has(shareholder.profile.email.toLowerCase()),
        )
        .map((shareholder) => ({
          purchaseId: currentPurchase.id,
          shareholderUserId: shareholder.userId,
          percentageBps: shareholder.percentageBps,
          grossAmountUgx: currentPurchase.amountUgx,
          amountUgx: calculateShareAmount(
            currentPurchase.amountUgx,
            shareholder.percentageBps,
          ),
        }))
        .filter((allocation) => allocation.amountUgx > 0);

      if (allocations.length) {
        await tx.adminRevenueAllocation.createMany({ data: allocations });
      }

      const existingEntitlement = await tx.entitlement.findUnique({
        where: { purchaseId: currentPurchase.id },
        select: { id: true },
      });

      if (!existingEntitlement) {
        const activeEntitlement = await tx.entitlement.findFirst({
          where: {
            userId: currentPurchase.userId,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { expiresAt: "desc" },
          select: { expiresAt: true },
        });
        const { startsAt, expiresAt } = calculateEntitlementWindow(
          now,
          activeEntitlement?.expiresAt,
          currentPurchase.durationDays,
        );

        await tx.entitlement.create({
          data: {
            userId: currentPurchase.userId,
            purchaseId: currentPurchase.id,
            startsAt,
            expiresAt,
          },
        });
      }
    } else if (paymentStatus !== "SUCCEEDED") {
      await tx.purchase.update({
        where: { id: currentPurchase.id },
        data: {
          status: paymentStatus,
        },
      });
    }

    await tx.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { processedAt: now },
    });

    return { status: "processed" };
  });
}
