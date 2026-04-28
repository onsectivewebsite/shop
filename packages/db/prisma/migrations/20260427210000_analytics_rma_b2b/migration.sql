-- Migration: RMA + B2B accounts (no schema changes for analytics — it queries
-- existing OrderItem + Review tables).
-- Apply with `pnpm --filter @onsective/db deploy`.

-- =========================================================================
-- 1. Returns / RMA
-- =========================================================================

CREATE TYPE "ReturnStatus" AS ENUM (
  'REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'CANCELLED'
);
CREATE TYPE "ReturnReason" AS ENUM (
  'DAMAGED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'NO_LONGER_NEEDED',
  'ARRIVED_LATE', 'OTHER'
);

CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" "ReturnReason" NOT NULL,
    "buyerNote" TEXT,
    "qty" INTEGER NOT NULL,
    "refundAmount" INTEGER,
    "currency" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decisionNote" TEXT,
    "receivedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Return_rmaNumber_key" ON "Return"("rmaNumber");
CREATE UNIQUE INDEX "Return_refundId_key" ON "Return"("refundId");
CREATE INDEX "Return_buyerId_status_idx" ON "Return"("buyerId", "status");
CREATE INDEX "Return_sellerId_status_idx" ON "Return"("sellerId", "status");
CREATE INDEX "Return_orderItemId_idx" ON "Return"("orderItemId");
CREATE INDEX "Return_status_createdAt_idx" ON "Return"("status", "createdAt");

ALTER TABLE "Return" ADD CONSTRAINT "Return_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Return" ADD CONSTRAINT "Return_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Return" ADD CONSTRAINT "Return_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Return" ADD CONSTRAINT "Return_refundId_fkey"
    FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================================================
-- 2. B2B Accounts
-- =========================================================================

CREATE TYPE "OrgMemberRole" AS ENUM ('OWNER', 'ADMIN', 'BUYER');
CREATE TYPE "OrgPaymentTerms" AS ENUM ('STRIPE_IMMEDIATE', 'NET_30');
CREATE TYPE "B2BInvoiceStatus" AS ENUM (
  'DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOIDED', 'WRITTEN_OFF'
);

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "taxId" TEXT,
    "countryCode" TEXT NOT NULL,
    "paymentTerms" "OrgPaymentTerms" NOT NULL DEFAULT 'STRIPE_IMMEDIATE',
    "stripeCustomerId" TEXT,
    "creditLimitMinor" INTEGER,
    "discountPctBps" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");
CREATE INDEX "Organization_countryCode_idx" ON "Organization"("countryCode");

CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'BUYER',
    "monthlyCapMinor" INTEGER,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key"
    ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TaxExemption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "certificateKey" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxExemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxExemption_organizationId_status_idx"
    ON "TaxExemption"("organizationId", "status");
CREATE INDEX "TaxExemption_validUntil_idx" ON "TaxExemption"("validUntil");

ALTER TABLE "TaxExemption" ADD CONSTRAINT "TaxExemption_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "B2BInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "B2BInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2BInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "B2BInvoice_invoiceNumber_key" ON "B2BInvoice"("invoiceNumber");
CREATE UNIQUE INDEX "B2BInvoice_stripeInvoiceId_key" ON "B2BInvoice"("stripeInvoiceId");
CREATE INDEX "B2BInvoice_organizationId_status_idx"
    ON "B2BInvoice"("organizationId", "status");
CREATE INDEX "B2BInvoice_dueAt_status_idx" ON "B2BInvoice"("dueAt", "status");

ALTER TABLE "B2BInvoice" ADD CONSTRAINT "B2BInvoice_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- =========================================================================
-- 3. Order ↔ Organization / B2BInvoice link
-- =========================================================================

ALTER TABLE "Order"
    ADD COLUMN "organizationId" TEXT,
    ADD COLUMN "b2bInvoiceId" TEXT,
    ADD COLUMN "taxExempt" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_b2bInvoiceId_fkey"
    FOREIGN KEY ("b2bInvoiceId") REFERENCES "B2BInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
