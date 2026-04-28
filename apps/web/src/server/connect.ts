import { prisma } from './db';
import { getStripe } from './stripe';
import type { Seller } from '@onsective/db';

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

/**
 * Ensure the seller has a Stripe Connect Express account. Persists the new
 * accountId on the Seller row. Idempotent — returns the existing accountId
 * if one is already present.
 */
export async function ensureStripeAccount(seller: Seller): Promise<string> {
  if (seller.stripeAccountId) return seller.stripeAccountId;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: 'express',
    country: seller.countryCode,
    email: undefined,
    business_type: 'individual',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { sellerId: seller.id },
  });

  await prisma.seller.update({
    where: { id: seller.id },
    data: { stripeAccountId: account.id },
  });

  return account.id;
}

export async function createOnboardingLink(args: {
  stripeAccountId: string;
  locale: string;
}): Promise<{ url: string; expiresAt: Date }> {
  const stripe = getStripe();
  const base = `${appBaseUrl()}/${args.locale}/seller/onboarding`;
  const link = await stripe.accountLinks.create({
    account: args.stripeAccountId,
    refresh_url: `${base}/refresh`,
    return_url: `${base}/return`,
    type: 'account_onboarding',
  });
  return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
}

/**
 * Pull the latest account status from Stripe and persist the derived flags.
 * Call this from the return-URL handler and from the periodic payouts worker.
 */
export async function refreshAccountStatus(
  sellerId: string,
): Promise<{
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  requirementsCurrentlyDue: string[];
}> {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller?.stripeAccountId) {
    throw new Error('Seller has no Stripe account.');
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(seller.stripeAccountId);

  const payoutsEnabled = account.payouts_enabled === true;
  const onboardedAt =
    payoutsEnabled && !seller.stripeOnboardedAt ? new Date() : seller.stripeOnboardedAt;

  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      stripePayoutsEnabled: payoutsEnabled,
      stripeOnboardedAt: onboardedAt ?? undefined,
    },
  });

  return {
    payoutsEnabled,
    detailsSubmitted: account.details_submitted === true,
    chargesEnabled: account.charges_enabled === true,
    requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
  };
}
