-- Throttle stamps for new-message email notifications. One per side; the
-- send path stamps the recipient's column atomically before the SMTP call,
-- so concurrent sends from a chatty back-and-forth collapse to one email
-- per 30-minute window per side.
ALTER TABLE "Conversation"
  ADD COLUMN "buyerLastNotifiedAt"  TIMESTAMP(3),
  ADD COLUMN "sellerLastNotifiedAt" TIMESTAMP(3);
