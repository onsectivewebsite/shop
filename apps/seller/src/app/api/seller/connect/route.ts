import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';
import { ensureStripeAccount, createOnboardingLink, refreshAccountStatus } from '@/server/connect';

export async function POST() {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });
  if (seller.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'Stripe Connect unlocks after KYC approval.' },
      { status: 403 },
    );
  }

  try {
    const accountId = await ensureStripeAccount(seller);
    const link = await createOnboardingLink(accountId);
    return NextResponse.json({ url: link.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  // Used by the return page to refresh status after Stripe redirects back.
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });
  if (!seller.stripeAccountId) {
    return NextResponse.json({ payoutsEnabled: false, requirementsCurrentlyDue: [] });
  }

  try {
    const status = await refreshAccountStatus(seller.id);
    return NextResponse.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
