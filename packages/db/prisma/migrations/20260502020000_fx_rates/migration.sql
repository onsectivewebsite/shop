-- Daily FX-rate snapshots. Keep history so refunds can unwind at the same
-- rate the redemption used, and a stale-rate guard can refuse to apply
-- anything older than the freshness threshold.

-- Add FX columns to UserCreditTransaction so a cross-currency REDEEM can
-- be replayed exactly at REFUND time without re-querying historical rates.
ALTER TABLE "UserCreditTransaction"
  ADD COLUMN IF NOT EXISTS "fxRate" DECIMAL(18, 8),
  ADD COLUMN IF NOT EXISTS "fxFromCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "fxFromAmountMinor" INTEGER;
CREATE TABLE "FxRate" (
  "id"        TEXT NOT NULL,
  "base"      TEXT NOT NULL,
  "quote"     TEXT NOT NULL,
  "rate"      DECIMAL(18, 8) NOT NULL,
  "source"    TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FxRate_base_quote_fetchedAt_key"
  ON "FxRate"("base", "quote", "fetchedAt");
CREATE INDEX "FxRate_base_quote_fetchedAt_idx"
  ON "FxRate"("base", "quote", "fetchedAt" DESC);
