-- Phase 4: mark seeded demo sellers so payouts worker can skip them.
ALTER TABLE "Seller"
  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Seller_isDemo_idx" ON "Seller"("isDemo");
