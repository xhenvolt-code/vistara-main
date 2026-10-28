"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  calculateAvailableShareBalance,
  calculatePayoutRequestAmount,
} from "@/domain/revenue-shares";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";

const balanceReducingPayoutStatuses = ["REQUESTED", "APPROVED", "PAID"];

function formString(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAuthorizedAdmin() {
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    throw new Error("Administrator access is required.");
  }

  return access;
}

async function lockShareholder(tx, userId) {
  const shareholder = await tx.adminShareholder.update({
    where: { userId },
    data: { revision: { increment: 1 } },
    select: { userId: true },
  });

  return shareholder;
}

async function getAvailableBalance(tx, userId) {
  const allocations = await tx.adminRevenueAllocation.findMany({
    where: { shareholderUserId: userId, status: "AVAILABLE" },
    select: { amountUgx: true },
  });
  const requests = await tx.sharePayoutRequest.findMany({
    where: {
      shareholderUserId: userId,
      status: { in: balanceReducingPayoutStatuses },
    },
    select: { amountUgx: true },
  });

  return calculateAvailableShareBalance(allocations, requests);
}

const shareSchema = z.object({
  userId: z.string().min(1).max(100),
  percentage: z
    .string()
    .regex(/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/)
    .transform(Number)
    .refine((value) => value <= 100),
});

export async function saveAdminShare(_previousState, formData) {
  const access = await requireAuthorizedAdmin();

  if (access.role !== "superadmin") {
    return { error: "Only a superadmin can change revenue shares." };
  }

  const parsed = shareSchema.safeParse({
    userId: formString(formData, "userId"),
    percentage: formString(formData, "percentage"),
  });

  if (!parsed.success) {
    return { error: "Enter a percentage from 0 to 100 with up to 2 decimals." };
  }

  const target = await prisma.userProfile.findUnique({
    where: { userId: parsed.data.userId },
    select: { email: true },
  });
  const allowedAdminEmails = new Set(
    `${process.env.ADMIN_EMAILS ?? ""},${process.env.SUPERADMIN_EMAILS ?? ""}`
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  if (!target) {
    return { error: "The selected administrator profile was not found." };
  }

  const percentageBps = Math.round(parsed.data.percentage * 100);
  if (
    percentageBps > 0 &&
    (!target.email || !allowedAdminEmails.has(target.email.toLowerCase()))
  ) {
    return { error: "Only configured administrators can receive an active share." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.financialSharePolicy.update({
        where: { id: "global" },
        data: { revision: { increment: 1 } },
      });

      const otherShares = await tx.adminShareholder.findMany({
        where: {
          isActive: true,
          userId: { not: parsed.data.userId },
        },
        select: { percentageBps: true },
      });
      const assignedBps = otherShares.reduce(
        (total, share) => total + share.percentageBps,
        0,
      );

      if (assignedBps + percentageBps > 10_000) {
        throw new Error("The combined active shares cannot exceed 100%.");
      }

      await tx.adminShareholder.upsert({
        where: { userId: parsed.data.userId },
        create: {
          userId: parsed.data.userId,
          percentageBps,
          isActive: percentageBps > 0,
        },
        update: {
          percentageBps,
          isActive: percentageBps > 0,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "finance.share.updated",
          entityType: "AdminShareholder",
          entityId: parsed.data.userId,
          metadata: {
            percentageBps,
            isActive: percentageBps > 0,
          },
        },
      });
    });

    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: "Administrator revenue share updated." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("combined active shares")) {
      return { error: error.message };
    }

    console.error("Administrator revenue share update failed.", {
      actorId: access.userId,
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    return { error: "Unable to update this revenue share." };
  }
}

const allocationSchema = z.object({
  allocationId: z.string().min(1).max(100),
  status: z.enum(["AVAILABLE", "REINVESTED"]),
});

export async function updateAllocationDecision(_previousState, formData) {
  const access = await requireAuthorizedAdmin();
  const parsed = allocationSchema.safeParse({
    allocationId: formString(formData, "allocationId"),
    status: formString(formData, "status"),
  });

  if (!parsed.success) {
    return { error: "Choose a valid allocation decision." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockShareholder(tx, access.userId);
      const allocation = await tx.adminRevenueAllocation.findFirst({
        where: {
          id: parsed.data.allocationId,
          shareholderUserId: access.userId,
        },
        select: { id: true, amountUgx: true, status: true },
      });

      if (!allocation) {
        throw new Error("This revenue allocation is not assigned to your account.");
      }

      if (allocation.status !== parsed.data.status) {
        const availableAfter = await getAvailableBalance(tx, access.userId);
        const adjustedFreeBalance =
          parsed.data.status === "REINVESTED"
            ? availableAfter - allocation.amountUgx
            : availableAfter + allocation.amountUgx;

        if (adjustedFreeBalance < 0) {
          throw new Error(
            "This allocation is reserved for an outstanding payout request.",
          );
        }

        await tx.adminRevenueAllocation.update({
          where: { id: allocation.id },
          data: { status: parsed.data.status },
        });
        await tx.auditLog.create({
          data: {
            actorId: access.userId,
            action: "finance.allocation.decision.updated",
            entityType: "AdminRevenueAllocation",
            entityId: allocation.id,
            metadata: {
              amountUgx: allocation.amountUgx,
              status: parsed.data.status,
            },
          },
        });
      }
    });

    revalidatePath("/admin/finance");
    return { success: "Revenue allocation preference updated." };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("not assigned") ||
        error.message.includes("reserved for"))
    ) {
      return { error: error.message };
    }

    console.error("Revenue allocation decision update failed.", {
      actorId: access.userId,
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    return { error: "Unable to update this allocation decision." };
  }
}

const payoutRequestSchema = z.object({
  requestType: z.enum(["ALL", "AMOUNT", "PERCENTAGE"]),
  amount: z
    .string()
    .regex(/^\d*$/)
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isSafeInteger(value) && value > 0)),
  percentage: z
    .string()
    .regex(/^(?:|(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?)$/)
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (value > 0 && value <= 100)),
});

const payoutRequestSchemaWithAmount = payoutRequestSchema.refine(
  (value) =>
    (value.requestType !== "AMOUNT" || value.amount !== null) &&
    (value.requestType !== "PERCENTAGE" || value.percentage !== null),
);

export async function requestSharePayout(_previousState, formData) {
  const access = await requireAuthorizedAdmin();
  const parsed = payoutRequestSchemaWithAmount.safeParse({
    requestType: formString(formData, "requestType"),
    amount: formString(formData, "amount"),
    percentage: formString(formData, "percentage"),
  });

  if (!parsed.success) {
    return { error: "Choose all, a positive whole UGX amount, or a percentage from 0.01 to 100." };
  }

  try {
    const requestId = await prisma.$transaction(async (tx) => {
      await lockShareholder(tx, access.userId);
      const availableBalance = await getAvailableBalance(tx, access.userId);
      const amountUgx = calculatePayoutRequestAmount(
        availableBalance,
        parsed.data,
      );

      const request = await tx.sharePayoutRequest.create({
        data: {
          shareholderUserId: access.userId,
          amountUgx,
          requestedBy: access.userId,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "finance.payout.requested",
          entityType: "SharePayoutRequest",
          entityId: request.id,
          metadata: { amountUgx },
        },
      });

      return request.id;
    });

    revalidatePath("/admin/finance");
    return { success: "Payout request submitted for independent review.", requestId };
  } catch (error) {
    if (error instanceof Error && error.message.includes("available share balance")) {
      return { error: error.message };
    }

    console.error("Share payout request failed.", {
      actorId: access.userId,
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    return { error: "Unable to submit this payout request." };
  }
}

const payoutReviewSchema = z.object({
  requestId: z.string().min(1).max(100),
  decision: z.enum(["APPROVED", "REJECTED", "PAID"]),
  externalReference: z.string().max(200),
  reviewNote: z.string().max(500),
});

export async function reviewSharePayout(_previousState, formData) {
  const access = await requireAuthorizedAdmin();

  if (access.role !== "superadmin") {
    return { error: "Only a superadmin can review payout requests." };
  }

  const parsed = payoutReviewSchema.safeParse({
    requestId: formString(formData, "requestId"),
    decision: formString(formData, "decision"),
    externalReference: formString(formData, "externalReference"),
    reviewNote: formString(formData, "reviewNote"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid payout decision." };
  }

  if (
    parsed.data.decision === "PAID" &&
    parsed.data.externalReference.length < 3
  ) {
    return { error: "Record the external transfer reference before marking a payout paid." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const payoutBeforeLock = await tx.sharePayoutRequest.findUnique({
        where: { id: parsed.data.requestId },
      });

      if (!payoutBeforeLock) {
        throw new Error("Payout request not found.");
      }

      await lockShareholder(tx, payoutBeforeLock.shareholderUserId);
      const payout = await tx.sharePayoutRequest.findUniqueOrThrow({
        where: { id: parsed.data.requestId },
      });

      if (payout.requestedBy === access.userId) {
        throw new Error("A different superadmin must review your own payout request.");
      }

      const allowedTransition =
        (parsed.data.decision === "APPROVED" &&
          payout.status === "REQUESTED") ||
        (parsed.data.decision === "REJECTED" &&
          ["REQUESTED", "APPROVED"].includes(payout.status));
      const paidTransition =
        parsed.data.decision === "PAID" && payout.status === "APPROVED";

      if (!allowedTransition && !paidTransition) {
        throw new Error("This payout request is not in a state for that decision.");
      }

      await tx.sharePayoutRequest.update({
        where: { id: payout.id },
        data: {
          status: parsed.data.decision,
          reviewedBy: access.userId,
          externalReference:
            parsed.data.decision === "PAID"
              ? parsed.data.externalReference
              : undefined,
          reviewNote: parsed.data.reviewNote || null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: `finance.payout.${parsed.data.decision.toLowerCase()}`,
          entityType: "SharePayoutRequest",
          entityId: payout.id,
          metadata: {
            amountUgx: payout.amountUgx,
            decision: parsed.data.decision,
            externalReference:
              parsed.data.decision === "PAID"
                ? parsed.data.externalReference
                : null,
          },
        },
      });
    });

    revalidatePath("/admin/finance");
    return { success: "Payout request updated." };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("not found") ||
        error.message.includes("different superadmin") ||
        error.message.includes("not in a state"))
    ) {
      return { error: error.message };
    }

    console.error("Share payout review failed.", {
      actorId: access.userId,
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    return { error: "Unable to review this payout request." };
  }
}
