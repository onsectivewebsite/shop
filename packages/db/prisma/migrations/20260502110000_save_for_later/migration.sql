-- "Save for later" — distinct from wishlist by intent. Lives on the cart
-- page below active items, with a "Move to cart" button.

CREATE TABLE "SavedForLaterItem" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "variantId"     TEXT NOT NULL,
  "qty"           INTEGER NOT NULL,
  "priceSnapshot" INTEGER NOT NULL,
  "currency"      TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedForLaterItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedForLaterItem_userId_variantId_key"
  ON "SavedForLaterItem"("userId", "variantId");
CREATE INDEX "SavedForLaterItem_userId_createdAt_idx"
  ON "SavedForLaterItem"("userId", "createdAt");

ALTER TABLE "SavedForLaterItem"
  ADD CONSTRAINT "SavedForLaterItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SavedForLaterItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
