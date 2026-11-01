-- Plano, teste grátis e onboarding por barbearia.
ALTER TABLE "Barbershop"
  ADD COLUMN "plan" "SaasPlan" NOT NULL DEFAULT 'STARTER',
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "canceledAt" TIMESTAMP(3);

ALTER TABLE "Barbershop" ALTER COLUMN "monthlyFeeCents" SET DEFAULT 4990;
ALTER TABLE "Barbershop" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'TRIALING';

-- Barbearias criadas antes do teste grátis ganham 14 dias para regularizar,
-- em vez de acordarem bloqueadas depois do deploy.
UPDATE "Barbershop"
SET "trialEndsAt" = CURRENT_TIMESTAMP + INTERVAL '14 days',
    "subscriptionStatus" = 'TRIALING'
WHERE "subscriptionStatus" <> 'ACTIVE'
  AND "trialEndsAt" IS NULL;

CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'BARBER',
  "tokenHash" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_barbershopId_acceptedAt_revokedAt_idx" ON "Invitation"("barbershopId", "acceptedAt", "revokedAt");
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_barbershopId_fkey"
  FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "barbershopId" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_barbershopId_createdAt_idx" ON "AuditLog"("barbershopId", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
