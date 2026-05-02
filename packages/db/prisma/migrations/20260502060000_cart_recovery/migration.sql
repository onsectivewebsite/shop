-- Idempotency stamp for the daily cart-abandonment recovery cron.
ALTER TABLE "Cart" ADD COLUMN "recoveryEmailSentAt" TIMESTAMP(3);

CREATE INDEX "Cart_updatedAt_recoveryEmailSentAt_idx"
  ON "Cart"("updatedAt", "recoveryEmailSentAt");
