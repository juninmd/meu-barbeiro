-- AlterTable
ALTER TABLE "Barbershop"
ADD COLUMN "cancellationWindowHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lateCancellationFeeBps" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AppointmentCancellation" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "cancelledById" TEXT NOT NULL,
    "cancelledByRole" TEXT NOT NULL,
    "reason" TEXT,
    "hoursBefore" INTEGER NOT NULL,
    "refundedCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentCancellation_appointmentId_key" ON "AppointmentCancellation"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentCancellation_barbershopId_createdAt_idx" ON "AppointmentCancellation"("barbershopId", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentCancellation_cancelledById_idx" ON "AppointmentCancellation"("cancelledById");

-- AddForeignKey
ALTER TABLE "AppointmentCancellation" ADD CONSTRAINT "AppointmentCancellation_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentCancellation" ADD CONSTRAINT "AppointmentCancellation_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentCancellation" ADD CONSTRAINT "AppointmentCancellation_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
