-- Idempotency stamp for the weekly low-stock alert cron.
ALTER TABLE "Variant" ADD COLUMN "lowStockEmailedAt" TIMESTAMP(3);
