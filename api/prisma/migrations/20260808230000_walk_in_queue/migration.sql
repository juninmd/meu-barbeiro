CREATE TABLE "WalkInQueue" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "serviceIds" TEXT[],
    "barberId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalkInQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WalkInQueue_barbershopId_arrivedAt_idx" ON "WalkInQueue"("barbershopId", "arrivedAt");
CREATE INDEX "WalkInQueue_barbershopId_status_arrivedAt_idx" ON "WalkInQueue"("barbershopId", "status", "arrivedAt");
CREATE INDEX "WalkInQueue_userId_status_idx" ON "WalkInQueue"("userId", "status");
ALTER TABLE "Appointment" ADD COLUMN "walkInQueueId" TEXT;
CREATE INDEX "Appointment_walkInQueueId_idx" ON "Appointment"("walkInQueueId");

ALTER TABLE "WalkInQueue" ADD CONSTRAINT "WalkInQueue_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalkInQueue" ADD CONSTRAINT "WalkInQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalkInQueue" ADD CONSTRAINT "WalkInQueue_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_walkInQueueId_fkey" FOREIGN KEY ("walkInQueueId") REFERENCES "WalkInQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
