import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;

/**
 * Lazy-initialized Stripe client.
 * Throws on first use if STRIPE_SECRET_KEY is missing — never on import,
 * so the dev server still boots without Stripe configured.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!apiKey) {
      throw new Error(
        'STRIPE_SECRET_KEY missing. Set it in .env to use payment endpoints.',
      );
    }
    _stripe = new Stripe(apiKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
      maxNetworkRetries: 2,
    });
  }
  return _stripe;
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

import { prisma } from './db';

/**
 * Returns the Stripe Customer id for a user, lazy-creating + persisting it on
 * first call. Shared across saved-card management, Prime checkout, and any
 * future subscription product so a user has exactly one Customer on Stripe.
 *
 * Idempotent: a concurrent caller that wins the race finds the row already
 * populated on its read, so we don't create duplicate Customers. The unique
 * index on User.stripeCustomerId catches anything we miss in code.
 */
export async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, stripeCustomerId: true },
  });
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName ?? undefined,
    metadata: { userId: user.id },
  });

  // Race window: if another caller persisted first, the unique constraint
  // throws — read the now-populated value and orphan the duplicate Customer
  // (Stripe is fine with extra Customers; we just won't reference this one).
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      const winner = await prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true },
      });
      if (winner?.stripeCustomerId) return winner.stripeCustomerId;
    }
    throw err;
  }
}
