-- Server-only gift-card marker. When true, paying for an OrderItem with
-- this product mints UserCreditTransaction AWARD against the buyer for the
-- line subtotal at PAID transition.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "isGiftCard" BOOLEAN NOT NULL DEFAULT false;
