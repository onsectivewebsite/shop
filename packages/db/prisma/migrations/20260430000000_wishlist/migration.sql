-- Wishlist: per-user saved products
CREATE TABLE IF NOT EXISTS "WishlistItem" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WishlistItem_userId_productId_key"
  ON "WishlistItem"("userId", "productId");

CREATE INDEX IF NOT EXISTS "WishlistItem_userId_createdAt_idx"
  ON "WishlistItem"("userId", "createdAt");
