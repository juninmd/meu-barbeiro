-- AlterTable
ALTER TABLE "Appointment"
ADD COLUMN "customerSubscriptionId" TEXT,
ADD COLUMN "recurringBookingId" TEXT;

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "includedVisits" INTEGER NOT NULL,
    "serviceIds" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerSubscription" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "visitsUsed" INTEGER NOT NULL DEFAULT 0,
    "mercadoPagoSubscriptionId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringBooking" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "serviceIds" TEXT[],
    "weekday" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringBookingOccurrence" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "recurringBookingId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringBookingOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipPlan_barbershopId_name_key" ON "MembershipPlan"("barbershopId", "name");
CREATE INDEX "MembershipPlan_barbershopId_active_idx" ON "MembershipPlan"("barbershopId", "active");
CREATE UNIQUE INDEX "CustomerSubscription_mercadoPagoSubscriptionId_key" ON "CustomerSubscription"("mercadoPagoSubscriptionId");
CREATE INDEX "CustomerSubscription_barbershopId_status_idx" ON "CustomerSubscription"("barbershopId", "status");
CREATE INDEX "CustomerSubscription_userId_status_idx" ON "CustomerSubscription"("userId", "status");
CREATE INDEX "CustomerSubscription_planId_idx" ON "CustomerSubscription"("planId");
CREATE INDEX "RecurringBooking_barbershopId_active_idx" ON "RecurringBooking"("barbershopId", "active");
CREATE INDEX "RecurringBooking_subscriptionId_idx" ON "RecurringBooking"("subscriptionId");
CREATE INDEX "RecurringBooking_userId_idx" ON "RecurringBooking"("userId");
CREATE INDEX "RecurringBooking_barberId_idx" ON "RecurringBooking"("barberId");
CREATE UNIQUE INDEX "RecurringBookingOccurrence_appointmentId_key" ON "RecurringBookingOccurrence"("appointmentId");
CREATE UNIQUE INDEX "RecurringBookingOccurrence_recurringBookingId_scheduledAt_key" ON "RecurringBookingOccurrence"("recurringBookingId", "scheduledAt");
CREATE INDEX "RecurringBookingOccurrence_barbershopId_status_scheduledAt_idx" ON "RecurringBookingOccurrence"("barbershopId", "status", "scheduledAt");
CREATE INDEX "Appointment_customerSubscriptionId_idx" ON "Appointment"("customerSubscriptionId");
CREATE INDEX "Appointment_recurringBookingId_idx" ON "Appointment"("recurringBookingId");

ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSubscription" ADD CONSTRAINT "CustomerSubscription_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSubscription" ADD CONSTRAINT "CustomerSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSubscription" ADD CONSTRAINT "CustomerSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringBooking" ADD CONSTRAINT "RecurringBooking_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringBooking" ADD CONSTRAINT "RecurringBooking_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CustomerSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringBooking" ADD CONSTRAINT "RecurringBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringBooking" ADD CONSTRAINT "RecurringBooking_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringBookingOccurrence" ADD CONSTRAINT "RecurringBookingOccurrence_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringBookingOccurrence" ADD CONSTRAINT "RecurringBookingOccurrence_recurringBookingId_fkey" FOREIGN KEY ("recurringBookingId") REFERENCES "RecurringBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringBookingOccurrence" ADD CONSTRAINT "RecurringBookingOccurrence_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerSubscriptionId_fkey" FOREIGN KEY ("customerSubscriptionId") REFERENCES "CustomerSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_recurringBookingId_fkey" FOREIGN KEY ("recurringBookingId") REFERENCES "RecurringBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
