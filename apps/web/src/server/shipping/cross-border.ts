import { prisma } from '../db';

/**
 * Cross-border shipping helpers — Phase 4. The legal/tax-counsel gate is
 * outside this module: a route is only `allowed` if ops has whitelisted it
 * on the Seller, AND the destination is in the seller's allowedDestinations,
 * AND every item has a valid HS code.
 *
 * **Hard-blocked legal items** (unblock these before turning on a region):
 *   - Tax registration in destination (VAT/GST) — DDP requires it
 *   - Restricted goods list per destination (lithium batteries, alcohol, ...)
 *   - Prohibited destinations under sanctions (OFAC SDN, EU sanctions list)
 *   - Carrier-specific country support
 */

export type CrossBorderEligibility =
  | { ok: true; incoterm: 'DDP' | 'DAP' }
  | { ok: false; reason: string };

export async function checkSellerCanShipTo(args: {
  sellerId: string;
  destinationCountryCode: string;
  productIds: string[];
}): Promise<CrossBorderEligibility> {
  const seller = await prisma.seller.findUnique({
    where: { id: args.sellerId },
    select: {
      countryCode: true,
      allowedDestinationCountries: true,
      defaultIncoterm: true,
      status: true,
    },
  });
  if (!seller) return { ok: false, reason: 'Seller not found' };
  if (seller.status !== 'APPROVED') return { ok: false, reason: 'Seller not approved' };

  const dest = args.destinationCountryCode.toUpperCase();
  const origin = seller.countryCode.toUpperCase();

  if (origin === dest) return { ok: true, incoterm: 'DDP' };

  if (!seller.allowedDestinationCountries.includes(dest)) {
    return { ok: false, reason: `Seller is not cleared to ship to ${dest}` };
  }

  // Every shipped item must have an HS code; carrier filings reject without it.
  const products = await prisma.product.findMany({
    where: { id: { in: args.productIds } },
    select: { id: true, hsCode: true, title: true },
  });
  const missing = products.filter((p) => !p.hsCode);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Missing HS code: ${missing.map((p) => p.title).join(', ')}`,
    };
  }

  const incoterm = (seller.defaultIncoterm as 'DDP' | 'DAP' | null) ?? 'DDP';
  if (incoterm !== 'DDP') {
    // DAP requires carrier integration we don't have yet.
    return { ok: false, reason: 'Only DDP shipping supported in v1' };
  }
  return { ok: true, incoterm };
}

export type CustomsDeclaration = {
  totalDeclaredValueMinor: number;
  currency: string;
  incoterm: 'DDP' | 'DAP';
  contents: 'merchandise' | 'gift' | 'sample' | 'documents' | 'returned_goods';
  items: Array<{
    productId: string;
    title: string;
    hsCode: string;
    originCountryCode: string;
    qty: number;
    unitValueMinor: number;
    weightGrams: number;
  }>;
};

/**
 * Build a customs declaration from order items. Caller is responsible for
 * having already verified eligibility via `checkSellerCanShipTo`.
 */
export async function buildCustomsDeclaration(args: {
  orderId: string;
  incoterm: 'DDP' | 'DAP';
}): Promise<CustomsDeclaration> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, title: true, hsCode: true, originCountryCode: true } },
            },
          },
        },
      },
    },
  });
  if (!order) throw new Error('Order not found');

  const items = order.items.map((it) => {
    const product = it.variant.product;
    if (!product.hsCode) {
      throw new Error(`Missing HS code on ${product.title}`);
    }
    return {
      productId: product.id,
      title: it.productTitle,
      hsCode: product.hsCode,
      originCountryCode: product.originCountryCode ?? 'US',
      qty: it.qty,
      unitValueMinor: it.unitPrice,
      weightGrams: it.variant.weightGrams,
    };
  });

  const totalDeclaredValueMinor = items.reduce(
    (acc, i) => acc + i.unitValueMinor * i.qty,
    0,
  );

  return {
    totalDeclaredValueMinor,
    currency: order.currency,
    incoterm: args.incoterm,
    contents: 'merchandise',
    items,
  };
}
