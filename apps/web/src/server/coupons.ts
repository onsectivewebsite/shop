import { prisma } from './db';

/**
 * Coupon evaluation. Same call site for the checkout-summary preview and
 * the placeOrder commit — keeps the validation rules in one place. The
 * returned discount is in minor units of the cart currency.
 *
 * Returns null when the coupon is invalid for any reason; the caller
 * surfaces a generic "Coupon not applicable" message rather than enumerating
 * why (security through ambiguity — don't leak whether a code exists at all
 * to brute-forcers).
 */
export type CouponEvaluation = {
  couponId: string;
  code: string;
  discountMinor: number;
};

export async function evaluateCoupon(args: {
  code: string;
  cartCurrency: string;
  cartSubtotalMinor: number;
}): Promise<CouponEvaluation | null> {
  if (!args.code) return null;
  const code = args.code.trim().toUpperCase();
  if (code.length === 0 || code.length > 64) return null;

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      type: true,
      value: true,
      currency: true,
      maxDiscountMinor: true,
      minOrderMinor: true,
      maxUses: true,
      usedCount: true,
      validFrom: true,
      validUntil: true,
      isActive: true,
    },
  });
  if (!coupon || !coupon.isActive) return null;

  const now = new Date();
  if (coupon.validFrom > now) return null;
  if (coupon.validUntil && coupon.validUntil < now) return null;
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return null;
  if (coupon.minOrderMinor !== null && args.cartSubtotalMinor < coupon.minOrderMinor) {
    return null;
  }

  let discount = 0;
  if (coupon.type === 'PERCENT') {
    // value is basis points (1000 = 10%). Round half-down so the platform
    // never grants the buyer a fractional-cent extra discount.
    discount = Math.floor((args.cartSubtotalMinor * coupon.value) / 10_000);
    if (coupon.maxDiscountMinor !== null) {
      discount = Math.min(discount, coupon.maxDiscountMinor);
    }
  } else if (coupon.type === 'FIXED_AMOUNT') {
    // Fixed-amount coupons are currency-strict — no auto-FX.
    if (coupon.currency !== args.cartCurrency) return null;
    discount = coupon.value;
  }

  // Cap at subtotal so a $50 coupon on a $30 cart only takes $30 off.
  discount = Math.min(discount, args.cartSubtotalMinor);
  if (discount <= 0) return null;

  return {
    couponId: coupon.id,
    code: coupon.code,
    discountMinor: discount,
  };
}
