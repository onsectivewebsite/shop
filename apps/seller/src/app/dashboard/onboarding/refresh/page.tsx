import { redirect } from 'next/navigation';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { ensureStripeAccount, createOnboardingLink } from '@/server/connect';

// Stripe redirects here when the account link expired or was already used.
// Mint a fresh one and bounce the user straight back to Stripe.
export default async function OnboardingRefreshPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');

  const accountId = await ensureStripeAccount(seller);
  const link = await createOnboardingLink(accountId);
  redirect(link.url);
}
