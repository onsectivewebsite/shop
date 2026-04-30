-- Phase 7 step 4: buyer flag → moderation queue.
CREATE TYPE "ReviewReportReason" AS ENUM ('SPAM', 'OFFENSIVE', 'OFF_TOPIC', 'FAKE', 'OTHER');

CREATE TABLE "ReviewReport" (
  "id"         TEXT NOT NULL,
  "reviewId"   TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason"     "ReviewReportReason" NOT NULL,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewReport_reviewId_reporterId_key"
  ON "ReviewReport"("reviewId", "reporterId");
CREATE INDEX "ReviewReport_reviewId_idx" ON "ReviewReport"("reviewId");
CREATE INDEX "ReviewReport_createdAt_idx" ON "ReviewReport"("createdAt");

ALTER TABLE "ReviewReport"
  ADD CONSTRAINT "ReviewReport_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "Review"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
