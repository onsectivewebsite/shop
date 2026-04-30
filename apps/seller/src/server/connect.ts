import { prisma } from './db';
import { getStripe } from './stripe';
import type { Seller } from '@onsective/db';

function sellerBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SELLER_URL ?? 'https://seller.itsnottechy.cloud';
}

export async function ensureStripeAccount(seller: Seller): Promise<string> {
  if (seller.stripeAccountId) return seller.stripeAccountId;
  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: 'express',
    country: seller.countryCode,
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

export async function createOnboardingLink(
  stripeAccountId: string,
): Promise<{ url: string; expiresAt: Date }> {
  const stripe = getStripe();
  const base = `${sellerBaseUrl()}/dashboard/onboarding`;
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${base}/refresh`,
    return_url: `${base}/return`,
    type: 'account_onboarding',
  });
  return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
}

export async function refreshAccountStatus(sellerId: string): Promise<{
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  requirementsCurrentlyDue: string[];
}> {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller?.stripeAccountId) throw new Error('Seller has no Stripe account.');

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
