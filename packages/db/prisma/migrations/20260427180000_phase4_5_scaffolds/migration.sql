-- Migration: Phase 4/5 scaffolds — cross-border, Onsective Fulfilled, Prime, Ads
-- Hand-written; apply with `pnpm --filter @onsective/db deploy`.

-- =========================================================================
-- 1. Cross-border shipping (Phase 4)
-- =========================================================================

ALTER TABLE "Product"
    ADD COLUMN "hsCode" TEXT,
    ADD COLUMN "originCountryCode" TEXT;

ALTER TABLE "Seller"
    ADD COLUMN "allowedDestinationCountries" TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN "defaultIncoterm" TEXT;

ALTER TABLE "Shipment"
    ADD COLUMN "originCountryCode" TEXT,
    ADD COLUMN "destinationCountryCode" TEXT,
    ADD COLUMN "incoterm" TEXT,
    ADD COLUMN "customsDeclaration" JSONB;

-- =========================================================================
-- 2. Onsective Fulfilled (Phase 5) — warehouses + per-warehouse inventory
-- =========================================================================

CREATE TYPE "FulfillmentMethod" AS ENUM ('SELF', 'ONSECTIVE');

ALTER TABLE "Variant"
    ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'SELF';

CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE INDEX "Warehouse_countryCode_isActive_idx" ON "Warehouse"("countryCode", "isActive");

CREATE TABLE "WarehouseInventory" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "lastInboundAt" TIMESTAMP(3),
    "reorderPoint" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseInventory_warehouseId_variantId_key"
    ON "WarehouseInventory"("warehouseId", "variantId");
CREATE INDEX "WarehouseInventory_variantId_idx" ON "WarehouseInventory"("variantId");

ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- 3. Onsective Prime (Phase 5)
-- =========================================================================

CREATE TYPE "PrimeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'PAYMENT_FAILED');
CREATE TYPE "PrimePlan" AS ENUM ('MONTHLY', 'ANNUAL');

CREATE TABLE "PrimeMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PrimePlan" NOT NULL,
    "status" "PrimeStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrimeMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrimeMembership_userId_key" ON "PrimeMembership"("userId");
CREATE UNIQUE INDEX "PrimeMembership_stripeSubscriptionId_key"
    ON "PrimeMembership"("stripeSubscriptionId");
CREATE INDEX "PrimeMembership_status_currentPeriodEnd_idx"
    ON "PrimeMembership"("status", "currentPeriodEnd");

ALTER TABLE "PrimeMembership" ADD CONSTRAINT "PrimeMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- 4. Onsective Ads (Phase 5)
-- =========================================================================

CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'ENDED');
CREATE TYPE "AdPlacement" AS ENUM ('SEARCH_RESULTS', 'PDP_RELATED', 'HOME_FEATURED');

CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "bidCpcMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "keywords" TEXT[],
    "dailyBudgetMinor" INTEGER NOT NULL,
    "totalBudgetMinor" INTEGER,
    "spentTodayMinor" INTEGER NOT NULL DEFAULT 0,
    "spentTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "spentTodayResetAt" TIMESTAMP(3),
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdCampaign_status_placement_idx" ON "AdCampaign"("status", "placement");
CREATE INDEX "AdCampaign_sellerId_idx" ON "AdCampaign"("sellerId");
CREATE INDEX "AdCampaign_productId_idx" ON "AdCampaign"("productId");

ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdImpression" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sessionId" TEXT,
    "query" TEXT,
    "placement" "AdPlacement" NOT NULL,
    "ipAddressHash" TEXT,
    "userAgentHash" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdImpression_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdImpression_campaignId_occurredAt_idx"
    ON "AdImpression"("campaignId", "occurredAt");

ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdClick" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "impressionId" TEXT,
    "sessionId" TEXT,
    "chargedMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "filtered" BOOLEAN NOT NULL DEFAULT false,
    "filterReason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdClick_campaignId_occurredAt_idx" ON "AdClick"("campaignId", "occurredAt");

ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_impressionId_fkey"
    FOREIGN KEY ("impressionId") REFERENCES "AdImpression"("id") ON DELETE SET NULL ON UPDATE CASCADE;
