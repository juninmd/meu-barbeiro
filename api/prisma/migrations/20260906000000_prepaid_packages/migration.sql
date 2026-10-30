CREATE TABLE "ServicePackage" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "serviceId" TEXT,
  "sessions" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "validityDays" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServicePackage_sessions_check" CHECK ("sessions" > 0),
  CONSTRAINT "ServicePackage_price_check" CHECK ("priceCents" > 0)
);

CREATE TABLE "CustomerPackage" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "soldById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "serviceId" TEXT,
  "sessionsTotal" INTEGER NOT NULL,
  "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
  "priceCents" INTEGER NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerPackage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerPackage_used_check" CHECK ("sessionsUsed" >= 0 AND "sessionsUsed" <= "sessionsTotal")
);

CREATE TABLE "PackageRedemption" (
  "id" TEXT NOT NULL,
  "customerPackageId" TEXT NOT NULL,
  "redeemedById" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackageRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServicePackage_barbershopId_active_idx" ON "ServicePackage"("barbershopId", "active");
CREATE INDEX "CustomerPackage_barbershopId_userId_idx" ON "CustomerPackage"("barbershopId", "userId");
CREATE INDEX "PackageRedemption_customerPackageId_idx" ON "PackageRedemption"("customerPackageId");

ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_customerPackageId_fkey" FOREIGN KEY ("customerPackageId") REFERENCES "CustomerPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
