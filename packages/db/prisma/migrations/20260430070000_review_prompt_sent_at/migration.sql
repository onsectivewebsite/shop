-- Phase 7 step 6: idempotency stamp for the review-prompt cron.
ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "reviewPromptSentAt" TIMESTAMP(3);
