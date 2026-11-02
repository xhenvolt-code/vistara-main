CREATE TABLE "MobileAuthHandoff" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "proofHash" TEXT NOT NULL,
    "encryptedSessionCookie" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAuthHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileAuthHandoff_tokenHash_key"
    ON "MobileAuthHandoff"("tokenHash");

CREATE INDEX "MobileAuthHandoff_expiresAt_idx"
    ON "MobileAuthHandoff"("expiresAt");
