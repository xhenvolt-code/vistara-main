ALTER TABLE "AdminShareholder"
ADD CONSTRAINT "AdminShareholder_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId")
ON DELETE RESTRICT ON UPDATE CASCADE;
