-- Message moderation: hide flag + reports table.

ALTER TABLE "Message"
  ADD COLUMN "isHidden"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hiddenReason" TEXT;

CREATE INDEX "Message_isHidden_createdAt_idx" ON "Message"("isHidden", "createdAt");

CREATE TYPE "MessageReportReason" AS ENUM ('SPAM', 'OFFENSIVE', 'HARASSMENT', 'SCAM', 'OTHER');

CREATE TABLE "MessageReport" (
  "id"           TEXT NOT NULL,
  "messageId"    TEXT NOT NULL,
  "reporterId"   TEXT NOT NULL,
  "reporterRole" "MessageAuthorRole" NOT NULL,
  "reason"       "MessageReportReason" NOT NULL,
  "note"         TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageReport_messageId_reporterId_key"
  ON "MessageReport"("messageId", "reporterId");
CREATE INDEX "MessageReport_messageId_idx"      ON "MessageReport"("messageId");
CREATE INDEX "MessageReport_createdAt_idx"      ON "MessageReport"("createdAt");

ALTER TABLE "MessageReport"
  ADD CONSTRAINT "MessageReport_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
