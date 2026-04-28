-- Migration: Passkeys, impersonation linkage, Postgres full-text search
-- Hand-written because the project DB wasn't running when the schema changes
-- landed. Mirrors `pnpm db:migrate dev` output. Apply with:
--   pnpm --filter @onsective/db deploy
-- after Postgres is up.

-- =========================================================================
-- 1. Passkeys / WebAuthn
-- =========================================================================

CREATE TYPE "WebAuthnChallengeType" AS ENUM ('REGISTER', 'AUTHENTICATE');

CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");
CREATE INDEX "Passkey_userId_idx" ON "Passkey"("userId");

ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WebAuthnChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "type" "WebAuthnChallengeType" NOT NULL,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebAuthnChallenge_userId_type_idx" ON "WebAuthnChallenge"("userId", "type");
CREATE INDEX "WebAuthnChallenge_email_type_idx" ON "WebAuthnChallenge"("email", "type");
CREATE INDEX "WebAuthnChallenge_expiresAt_idx" ON "WebAuthnChallenge"("expiresAt");

ALTER TABLE "WebAuthnChallenge" ADD CONSTRAINT "WebAuthnChallenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- 2. Impersonation linkage on Session + magic-link consume marker
-- =========================================================================

ALTER TABLE "Session" ADD COLUMN "impersonationSessionId" TEXT;
ALTER TABLE "ImpersonationSession" ADD COLUMN "tokenConsumedAt" TIMESTAMP(3);

CREATE INDEX "Session_impersonationSessionId_idx" ON "Session"("impersonationSessionId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_impersonationSessionId_fkey"
    FOREIGN KEY ("impersonationSessionId") REFERENCES "ImpersonationSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- 3. Product full-text search (replaces ILIKE in catalog.search)
-- =========================================================================

ALTER TABLE "Product"
    ADD COLUMN "searchVector" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A')
        || setweight(to_tsvector('english', coalesce("brand", '')), 'B')
        || setweight(to_tsvector('english', coalesce("description", '')), 'C')
    ) STORED;

CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");
