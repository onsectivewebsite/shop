-- Wishlist price-drop tracking. Snapshot the price at save time so the
-- daily digest cron can detect drops without re-deriving baselines from
-- every product's price history.
ALTER TABLE "WishlistItem"
  ADD COLUMN "priceAtSaveMinor" INTEGER,
  ADD COLUMN "priceCurrency"    TEXT,
  ADD COLUMN "dropEmailedAt"    TIMESTAMP(3);

CREATE INDEX "WishlistItem_priceAtSaveMinor_dropEmailedAt_idx"
  ON "WishlistItem"("priceAtSaveMinor", "dropEmailedAt");
