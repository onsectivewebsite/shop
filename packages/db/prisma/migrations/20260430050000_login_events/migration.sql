-- Phase 6 step 7: suspicious-login detection — login event audit + one-shot
-- revocation tokens for the "It wasn't me" link in alert emails.

CREATE TABLE "LoginEvent" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "ip"          TEXT,
  "countryCode" TEXT,
  "userAgent"   TEXT,
  "method"      TEXT NOT NULL,
  "success"     BOOLEAN NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");
CREATE INDEX "LoginEvent_userId_success_countryCode_idx"
  ON "LoginEvent"("userId", "success", "countryCode");

ALTER TABLE "LoginEvent"
  ADD CONSTRAINT "LoginEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SuspiciousLoginToken" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "tokenHash"  TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuspiciousLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuspiciousLoginToken_tokenHash_key" ON "SuspiciousLoginToken"("tokenHash");
CREATE INDEX "SuspiciousLoginToken_userId_idx" ON "SuspiciousLoginToken"("userId");

ALTER TABLE "SuspiciousLoginToken"
  ADD CONSTRAINT "SuspiciousLoginToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
