-- Optional buyer-supplied note attached to the order — gift message,
-- delivery instructions, anything seller-relevant.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "buyerNote" TEXT;
