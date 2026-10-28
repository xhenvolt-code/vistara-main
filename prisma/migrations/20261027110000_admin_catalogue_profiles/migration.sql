ALTER TABLE "UserProfile"
ADD COLUMN "email" TEXT;

CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

ALTER TABLE "Movie"
ADD COLUMN "posterUrl" TEXT,
ADD COLUMN "backdropUrl" TEXT;
