-- Phase 10: marketing-email consent infrastructure.
-- Transactional emails (OTP / order updates / security alerts) ignore this
-- flag; marketing emails must honour it.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailMarketingOptIn" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "UnsubscribeToken" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "scope"      TEXT NOT NULL DEFAULT 'marketing',
  "tokenHash"  TEXT NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnsubscribeToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnsubscribeToken_tokenHash_key"
  ON "UnsubscribeToken"("tokenHash");
CREATE INDEX "UnsubscribeToken_userId_scope_idx"
  ON "UnsubscribeToken"("userId", "scope");

ALTER TABLE "UnsubscribeToken"
  ADD CONSTRAINT "UnsubscribeToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
