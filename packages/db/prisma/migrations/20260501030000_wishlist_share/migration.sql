-- Public share link for a user's wishlist.
CREATE TABLE "WishlistShare" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "isPublic"    BOOLEAN NOT NULL DEFAULT true,
  "viewCount"   INTEGER NOT NULL DEFAULT 0,
  "displayName" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WishlistShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WishlistShare_userId_key" ON "WishlistShare"("userId");
CREATE UNIQUE INDEX "WishlistShare_slug_key" ON "WishlistShare"("slug");

ALTER TABLE "WishlistShare"
  ADD CONSTRAINT "WishlistShare_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
