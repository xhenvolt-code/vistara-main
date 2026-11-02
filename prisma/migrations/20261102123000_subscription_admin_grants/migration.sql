ALTER TABLE "Entitlement"
  ALTER COLUMN "purchaseId" DROP NOT NULL,
  ADD COLUMN "grantedBy" TEXT,
  ADD COLUMN "grantReason" TEXT;

CREATE INDEX "Entitlement_grantedBy_createdAt_idx"
  ON "Entitlement"("grantedBy", "createdAt");
