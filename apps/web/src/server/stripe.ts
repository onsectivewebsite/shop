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
