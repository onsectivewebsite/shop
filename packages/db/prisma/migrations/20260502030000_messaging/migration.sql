-- Buyer↔seller messaging. One Conversation per OrderItem (anchored to a real
-- purchase so messaging can't be used for unsolicited outreach). Per-side
-- read cursors drive unread badges without a per-message read-receipt table.

CREATE TYPE "MessageAuthorRole" AS ENUM ('BUYER', 'SELLER');

CREATE TABLE "Conversation" (
  "id"               TEXT NOT NULL,
  "orderItemId"      TEXT NOT NULL,
  "buyerId"          TEXT NOT NULL,
  "sellerId"         TEXT NOT NULL,
  "lastMessageAt"    TIMESTAMP(3),
  "buyerLastReadAt"  TIMESTAMP(3),
  "sellerLastReadAt" TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_orderItemId_key" ON "Conversation"("orderItemId");
CREATE INDEX "Conversation_buyerId_lastMessageAt_idx"
  ON "Conversation"("buyerId", "lastMessageAt" DESC);
CREATE INDEX "Conversation_sellerId_lastMessageAt_idx"
  ON "Conversation"("sellerId", "lastMessageAt" DESC);

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Conversation_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Conversation_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Message" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "authorRole"     "MessageAuthorRole" NOT NULL,
  "authorId"       TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Message_conversationId_createdAt_idx"
  ON "Message"("conversationId", "createdAt");

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Message_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
