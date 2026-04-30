-- Phase 8: index audit. Static review of the codebase's hot queries against
-- existing index coverage. Adds composite indexes for queries that today fall
-- back to seq scans or heap-then-filter, plus one Postgres partial index that
-- Prisma's schema can't express.

-- /best-sellers (when rewritten to order by salesCount instead of orderItems._count)
CREATE INDEX IF NOT EXISTS "Product_status_salesCount_idx"
  ON "Product"("status", "salesCount" DESC);

-- /category/[slug] sorted by createdAt — supersedes (categoryId, status) for
-- this access pattern but the existing two-column index stays useful for
-- bare counts that don't need ordering.
CREATE INDEX IF NOT EXISTS "Product_categoryId_status_createdAt_idx"
  ON "Product"("categoryId", "status", "createdAt" DESC);

-- Ops queues + the new review-prompt cron sweep.
CREATE INDEX IF NOT EXISTS "OrderItem_status_updatedAt_idx"
  ON "OrderItem"("status", "updatedAt");

-- The cron filters on "reviewPromptSentAt IS NULL". A plain index over the
-- column would have to scan every row regardless of value; a partial index
-- only stores rows where the predicate matches, keeping it small in steady
-- state since most delivered items get prompted within a week.
CREATE INDEX IF NOT EXISTS "OrderItem_reviewPromptPending_idx"
  ON "OrderItem"("status", "updatedAt")
  WHERE "reviewPromptSentAt" IS NULL;

-- /dashboard/audit — last-24h count + action-filtered timeline.
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx"
  ON "AuditLog"("action", "createdAt");

-- PDP review aggregate filters out hidden reviews — pair the productId with
-- isHidden so the visible-rows-per-product lookup is direct.
CREATE INDEX IF NOT EXISTS "Review_productId_isHidden_idx"
  ON "Review"("productId", "isHidden");
