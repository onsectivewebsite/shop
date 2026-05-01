-- Phase 10 polish: per-user credit balance + append-only ledger. The
-- referral system already records accrued payout on ReferralAttribution;
-- this is the surface that turns it into spendable credit at checkout.

CREATE TABLE "UserCreditBalance" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "currency"    TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL DEFAULT 0,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserCreditBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCreditBalance_userId_currency_key"
  ON "UserCreditBalance"("userId", "currency");
CREATE INDEX "UserCreditBalance_userId_idx" ON "UserCreditBalance"("userId");

ALTER TABLE "UserCreditBalance"
  ADD CONSTRAINT "UserCreditBalance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "UserCreditTxType" AS ENUM ('AWARD', 'REDEEM', 'REFUND', 'ADJUST');

CREATE TABLE "UserCreditTransaction" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "type"        "UserCreditTxType" NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency"    TEXT NOT NULL,
  "sourceType"  TEXT NOT NULL,
  "sourceId"    TEXT NOT NULL,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCreditTransaction_sourceType_sourceId_type_key"
  ON "UserCreditTransaction"("sourceType", "sourceId", "type");
CREATE INDEX "UserCreditTransaction_userId_createdAt_idx"
  ON "UserCreditTransaction"("userId", "createdAt");

ALTER TABLE "UserCreditTransaction"
  ADD CONSTRAINT "UserCreditTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
