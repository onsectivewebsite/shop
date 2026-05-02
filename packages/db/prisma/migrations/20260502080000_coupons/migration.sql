-- Promotional coupon codes. Platform-wide in v1; per-seller scoping is a
-- v2 add. Order columns track the snapshot + discount slice so refunds and
-- audits can attribute the right amount to the coupon vs credit redemption.

CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED_AMOUNT');

CREATE TABLE "Coupon" (
  "id"                TEXT NOT NULL,
  "code"              TEXT NOT NULL,
  "type"              "CouponType" NOT NULL,
  "value"             INTEGER NOT NULL,
  "currency"          TEXT,
  "maxDiscountMinor"  INTEGER,
  "minOrderMinor"     INTEGER,
  "maxUses"           INTEGER,
  "usedCount"         INTEGER NOT NULL DEFAULT 0,
  "validFrom"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil"        TIMESTAMP(3),
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "description"       TEXT,
  "createdById"       TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");
CREATE INDEX "Coupon_isActive_validFrom_validUntil_idx"
  ON "Coupon"("isActive", "validFrom", "validUntil");

ALTER TABLE "Order"
  ADD COLUMN "couponCode"           TEXT,
  ADD COLUMN "couponDiscountAmount" INTEGER NOT NULL DEFAULT 0;
