-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "dailySummaryTime" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN     "notificationTypes" TEXT[] NOT NULL DEFAULT ARRAY['NEW_APPOINTMENT', 'CANCELLATION', 'RESCHEDULE', 'NO_SHOW', 'DAILY_SUMMARY']::TEXT[];

-- Generalize the existing delivery record and preserve customer reminder history.
ALTER TABLE "AppointmentReminder" ADD COLUMN     "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "barbershopId" TEXT,
ADD COLUMN     "deduplicationKey" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "recipientId" TEXT,
ALTER COLUMN "appointmentId" DROP NOT NULL,
ALTER COLUMN "deliveredOk" SET DEFAULT false;

UPDATE "AppointmentReminder" AS reminder
SET "barbershopId" = appointment."barbershopId",
    "recipientId" = appointment."userId",
    "deduplicationKey" = 'customer:' || reminder."appointmentId" || ':' || reminder."kind" || ':' || reminder."channel",
    "availableAt" = reminder."sentAt",
    "processedAt" = reminder."sentAt"
FROM "Appointment" AS appointment
WHERE appointment."id" = reminder."appointmentId";

ALTER TABLE "AppointmentReminder" ALTER COLUMN "barbershopId" SET NOT NULL,
ALTER COLUMN "deduplicationKey" SET NOT NULL,
ALTER COLUMN "recipientId" SET NOT NULL;

-- Replace appointment-only uniqueness so one appointment can notify multiple recipients.
DROP INDEX "AppointmentReminder_appointmentId_kind_channel_key";

CREATE UNIQUE INDEX "AppointmentReminder_deduplicationKey_key" ON "AppointmentReminder"("deduplicationKey");
CREATE INDEX "AppointmentReminder_recipientId_processedAt_availableAt_idx" ON "AppointmentReminder"("recipientId", "processedAt", "availableAt");
CREATE INDEX "AppointmentReminder_barbershopId_idx" ON "AppointmentReminder"("barbershopId");

ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
