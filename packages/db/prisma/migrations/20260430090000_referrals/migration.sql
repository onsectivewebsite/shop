-- Phase 10: affiliate / referral program scaffolding.

CREATE TABLE "ReferralCode" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "code"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

ALTER TABLE "ReferralCode"
  ADD CONSTRAINT "ReferralCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReferralAttribution" (
  "id"              TEXT NOT NULL,
  "codeId"          TEXT NOT NULL,
  "referredUserId"  TEXT NOT NULL,
  "signedUpAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstOrderId"    TEXT,
  "payoutMinor"     INTEGER,
  "payoutCurrency"  TEXT,
  "paidAt"          TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key"
  ON "ReferralAttribution"("referredUserId");
CREATE INDEX "ReferralAttribution_codeId_idx" ON "ReferralAttribution"("codeId");
CREATE INDEX "ReferralAttribution_signedUpAt_idx" ON "ReferralAttribution"("signedUpAt");

ALTER TABLE "ReferralAttribution"
  ADD CONSTRAINT "ReferralAttribution_codeId_fkey"
  FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralAttribution"
  ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey"
  FOREIGN KEY ("referredUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
