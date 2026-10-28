CREATE TYPE "RevenueAllocationStatus" AS ENUM ('AVAILABLE', 'REINVESTED');

CREATE TYPE "SharePayoutStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'PAID'
);

CREATE TABLE "FinancialSharePolicy" (
  "id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinancialSharePolicy_pkey" PRIMARY KEY ("id")
);

INSERT INTO "FinancialSharePolicy" ("id", "updatedAt")
VALUES ('global', CURRENT_TIMESTAMP);

CREATE TABLE "AdminShareholder" (
  "userId" TEXT NOT NULL,
  "percentageBps" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminShareholder_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "AdminShareholder_percentageBps_check"
    CHECK ("percentageBps" BETWEEN 0 AND 10000)
);

CREATE INDEX "AdminShareholder_isActive_percentageBps_idx"
  ON "AdminShareholder"("isActive", "percentageBps");

CREATE TABLE "AdminRevenueAllocation" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "shareholderUserId" TEXT NOT NULL,
  "percentageBps" INTEGER NOT NULL,
  "grossAmountUgx" INTEGER NOT NULL,
  "amountUgx" INTEGER NOT NULL,
  "status" "RevenueAllocationStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminRevenueAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminRevenueAllocation_percentageBps_check"
    CHECK ("percentageBps" BETWEEN 0 AND 10000),
  CONSTRAINT "AdminRevenueAllocation_amounts_check"
    CHECK ("grossAmountUgx" >= 0 AND "amountUgx" >= 0 AND "amountUgx" <= "grossAmountUgx"),
  CONSTRAINT "AdminRevenueAllocation_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdminRevenueAllocation_shareholderUserId_fkey"
    FOREIGN KEY ("shareholderUserId") REFERENCES "AdminShareholder"("userId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AdminRevenueAllocation_purchaseId_shareholderUserId_key"
  ON "AdminRevenueAllocation"("purchaseId", "shareholderUserId");

CREATE INDEX "AdminRevenueAllocation_shareholderUserId_status_createdAt_idx"
  ON "AdminRevenueAllocation"("shareholderUserId", "status", "createdAt");

CREATE TABLE "SharePayoutRequest" (
  "id" TEXT NOT NULL,
  "shareholderUserId" TEXT NOT NULL,
  "amountUgx" INTEGER NOT NULL,
  "status" "SharePayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedBy" TEXT NOT NULL,
  "reviewedBy" TEXT,
  "externalReference" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SharePayoutRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SharePayoutRequest_amountUgx_check" CHECK ("amountUgx" > 0),
  CONSTRAINT "SharePayoutRequest_shareholderUserId_fkey"
    FOREIGN KEY ("shareholderUserId") REFERENCES "AdminShareholder"("userId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "SharePayoutRequest_shareholderUserId_status_createdAt_idx"
  ON "SharePayoutRequest"("shareholderUserId", "status", "createdAt");

CREATE INDEX "SharePayoutRequest_status_createdAt_idx"
  ON "SharePayoutRequest"("status", "createdAt");
