-- Seller vacation mode: pause fulfillment without touching Product.status.
ALTER TABLE "Seller"
  ADD COLUMN "vacationMode"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vacationMessage" TEXT,
  ADD COLUMN "vacationUntil"   TIMESTAMP(3);
