-- AlterTable
ALTER TABLE "Barbershop" ADD COLUMN     "reminderHoursBefore" INTEGER[] DEFAULT ARRAY[24, 2]::INTEGER[],
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "customerConfirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'telegram',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredOk" BOOLEAN NOT NULL,
    "error" TEXT,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentReminder_appointmentId_idx" ON "AppointmentReminder"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentReminder_appointmentId_kind_channel_key" ON "AppointmentReminder"("appointmentId", "kind", "channel");

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
