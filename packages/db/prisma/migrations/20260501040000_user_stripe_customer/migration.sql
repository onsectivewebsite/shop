-- Per-user Stripe Customer id, shared across saved payment methods + Prime
-- + future subscription products. Lazy-minted on first surface that needs it.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key"
  ON "User"("stripeCustomerId");
