CREATE TYPE "EstablishmentRequestStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "platformAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "establishmentRequest" "EstablishmentRequestStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "establishmentRequestNote" TEXT,
  ADD COLUMN "establishmentRequestedAt" TIMESTAMP(3),
  ADD COLUMN "establishmentDecidedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Donos de barbearias já existentes mantêm a autorização concedida antes deste controle.
UPDATE "User" SET "establishmentRequest" = 'APPROVED'
WHERE "id" IN (SELECT "userId" FROM "Membership" WHERE "role" = 'OWNER');
