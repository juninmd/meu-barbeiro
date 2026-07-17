CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'BARBER');
CREATE TYPE "DepositType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED', 'FULL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

CREATE TABLE "Barbershop" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#d99b32',
  "address" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "depositType" "DepositType" NOT NULL DEFAULT 'FULL',
  "depositValue" INTEGER NOT NULL DEFAULT 0,
  "monthlyFeeCents" INTEGER NOT NULL DEFAULT 2000,
  "commissionBps" INTEGER NOT NULL DEFAULT 100,
  "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
  "mercadoPagoSubscriptionId" TEXT,
  "mercadoPagoSellerId" TEXT,
  "mercadoPagoAccessTokenEncrypted" TEXT,
  "mercadoPagoRefreshTokenEncrypted" TEXT,
  "mercadoPagoTokenExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Barbershop_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Barbershop" ("id", "slug", "name", "address", "subscriptionStatus")
VALUES ('00000000-0000-4000-8000-000000000001', 'barbearia-central', 'Barbearia Central', 'Rua das Navalhas, 27 · Centro', 'ACTIVE');

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Membership" ("id", "barbershopId", "userId", "role")
SELECT gen_random_uuid()::text, '00000000-0000-4000-8000-000000000001', "id",
  CASE WHEN "role" = 'ADMIN' THEN 'OWNER'::"MembershipRole" ELSE 'BARBER'::"MembershipRole" END
FROM "User" WHERE "role" IN ('ADMIN', 'BARBER');

CREATE TABLE "BusinessHour" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "opensAt" TEXT NOT NULL,
  "closesAt" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "BusinessHour_pkey" PRIMARY KEY ("id")
);

INSERT INTO "BusinessHour" ("id", "barbershopId", "weekday", "opensAt", "closesAt", "enabled")
SELECT gen_random_uuid()::text, '00000000-0000-4000-8000-000000000001', day, '09:00', '20:00', day BETWEEN 2 AND 6
FROM generate_series(0, 6) AS day;

ALTER TABLE "Service" ADD COLUMN "barbershopId" TEXT;
ALTER TABLE "Service" ADD COLUMN "priceCents" INTEGER;
UPDATE "Service" SET "barbershopId" = '00000000-0000-4000-8000-000000000001', "priceCents" = ROUND("price" * 100)::integer;
ALTER TABLE "Service" ALTER COLUMN "barbershopId" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "priceCents" SET NOT NULL;
ALTER TABLE "Service" DROP COLUMN "price";

ALTER TABLE "Appointment" ADD COLUMN "barbershopId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "Appointment" ADD COLUMN "paymentAmountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN "commissionCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "mercadoPagoPreferenceId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "mercadoPagoPaymentId" TEXT;
UPDATE "Appointment" SET "barbershopId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Appointment" ALTER COLUMN "barbershopId" SET NOT NULL;

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Barbershop_slug_key" ON "Barbershop"("slug");
CREATE UNIQUE INDEX "Barbershop_mercadoPagoSubscriptionId_key" ON "Barbershop"("mercadoPagoSubscriptionId");
CREATE UNIQUE INDEX "Barbershop_mercadoPagoSellerId_key" ON "Barbershop"("mercadoPagoSellerId");
CREATE UNIQUE INDEX "Membership_barbershopId_userId_key" ON "Membership"("barbershopId", "userId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "BusinessHour_barbershopId_weekday_key" ON "BusinessHour"("barbershopId", "weekday");
CREATE UNIQUE INDEX "Service_barbershopId_name_key" ON "Service"("barbershopId", "name");
CREATE UNIQUE INDEX "Service_barbershopId_id_key" ON "Service"("barbershopId", "id");
CREATE INDEX "Service_barbershopId_idx" ON "Service"("barbershopId");
CREATE UNIQUE INDEX "Appointment_mercadoPagoPreferenceId_key" ON "Appointment"("mercadoPagoPreferenceId");
CREATE UNIQUE INDEX "Appointment_mercadoPagoPaymentId_key" ON "Appointment"("mercadoPagoPaymentId");
CREATE INDEX "Appointment_barbershopId_barberId_scheduledAt_idx" ON "Appointment"("barbershopId", "barberId", "scheduledAt");
CREATE INDEX "Appointment_barbershopId_userId_idx" ON "Appointment"("barbershopId", "userId");
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_service_tenant_fkey" FOREIGN KEY ("barbershopId", "serviceId") REFERENCES "Service"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
