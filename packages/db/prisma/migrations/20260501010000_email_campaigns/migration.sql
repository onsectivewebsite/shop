-- Phase 10: marketing campaign authoring + per-recipient event log.

CREATE TYPE "EmailCampaignStatus" AS ENUM (
  'DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED'
);

CREATE TABLE "EmailCampaign" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "subject"       TEXT NOT NULL,
  "templateKey"   TEXT NOT NULL,
  "audienceQuery" JSONB NOT NULL,
  "status"        "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledFor"  TIMESTAMP(3),
  "sentAt"        TIMESTAMP(3),
  "sentCount"     INTEGER NOT NULL DEFAULT 0,
  "createdById"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailCampaign_status_scheduledFor_idx"
  ON "EmailCampaign"("status", "scheduledFor");

CREATE TYPE "EmailEventType" AS ENUM (
  'SENT', 'OPENED', 'CLICKED', 'BOUNCED', 'UNSUBSCRIBED'
);

CREATE TABLE "EmailEvent" (
  "id"          TEXT NOT NULL,
  "campaignId"  TEXT,
  "userId"      TEXT NOT NULL,
  "type"        "EmailEventType" NOT NULL,
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailEvent_campaignId_type_idx" ON "EmailEvent"("campaignId", "type");
CREATE INDEX "EmailEvent_userId_createdAt_idx" ON "EmailEvent"("userId", "createdAt");

ALTER TABLE "EmailEvent"
  ADD CONSTRAINT "EmailEvent_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
