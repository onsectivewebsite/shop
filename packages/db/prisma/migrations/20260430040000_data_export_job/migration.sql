-- Phase 6 step 3: GDPR Article 20 data export job (audit + worker handoff).
CREATE TYPE "DataExportStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED');

CREATE TABLE "DataExportJob" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "status"      "DataExportStatus" NOT NULL DEFAULT 'QUEUED',
  "s3Key"       TEXT,
  "emailedTo"   TEXT NOT NULL,
  "bytes"       INTEGER,
  "error"       TEXT,
  "expiresAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt"   TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "DataExportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataExportJob_userId_createdAt_idx" ON "DataExportJob"("userId", "createdAt");

ALTER TABLE "DataExportJob"
  ADD CONSTRAINT "DataExportJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
