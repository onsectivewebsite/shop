import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { ensureStripeAccount, createOnboardingLink } from '@/server/connect';

export const dynamic = 'force-dynamic';

export default async function OnboardingRefreshPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect(`/${params.locale}/seller`);

  const stripeAccountId = await ensureStripeAccount(seller);
  const link = await createOnboardingLink({ stripeAccountId, locale: params.locale });
  redirect(link.url);
}
