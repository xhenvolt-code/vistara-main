"use server";

import { z } from "zod";
import { getAdminAccess } from "@/server/auth/admin";
import { prisma } from "@/server/db/prisma";
import {
  getNeonStorageInventory,
} from "@/server/storage/neon-object-storage";

const limitSchema = z.coerce.number().int().min(1_000_000).max(5_000_000_000_000);

export async function updateStorageLimit(_previousState, formData) {
  const access = await getAdminAccess();

  if (access.status !== "authorized") {
    return { error: "Administrator access is required to change this setting." };
  }

  const parsed = limitSchema.safeParse(formData.get("limitBytes"));

  if (!parsed.success) {
    return { error: "Enter a storage limit of at least 1 MB in bytes." };
  }

  const inventory = await getNeonStorageInventory();

  if (parsed.data < inventory.branchBytes) {
    return {
      error: "The limit cannot be lower than the current object storage usage.",
    };
  }

  await prisma.$transaction([
    prisma.platformSetting.upsert({
      where: { key: "storage.hardLimitBytes" },
      create: {
        key: "storage.hardLimitBytes",
        value: parsed.data,
        updatedBy: access.userId,
      },
      update: {
        value: parsed.data,
        updatedBy: access.userId,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: access.userId,
        action: "storage.limit.updated",
        entityType: "PlatformSetting",
        entityId: "storage.hardLimitBytes",
        metadata: { limitBytes: parsed.data },
      },
    }),
  ]);

  return { success: "Storage limit updated." };
}
