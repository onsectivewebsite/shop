import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });

  let body: {
    legalName?: string;
    displayName?: string;
    description?: string;
    countryCode?: string;
    taxId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const legalName = body.legalName?.trim();
  const displayName = body.displayName?.trim();
  const countryCode = body.countryCode?.toUpperCase();

  if (legalName && legalName.length < 2) {
    return NextResponse.json({ error: 'Legal name too short.' }, { status: 400 });
  }
  if (displayName && displayName.length < 2) {
    return NextResponse.json({ error: 'Storefront name too short.' }, { status: 400 });
  }
  if (countryCode && countryCode.length !== 2) {
    return NextResponse.json({ error: 'Country must be ISO-2.' }, { status: 400 });
  }

  // Country change is restricted post-approval — Stripe Connect ties to country.
  if (
    countryCode &&
    countryCode !== seller.countryCode &&
    seller.status === 'APPROVED'
  ) {
    return NextResponse.json(
      { error: 'Country cannot be changed after approval. Contact support.' },
      { status: 409 },
    );
  }

  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      legalName: legalName ?? seller.legalName,
      displayName: displayName ?? seller.displayName,
      description: body.description?.trim() ?? seller.description,
      countryCode: countryCode ?? seller.countryCode,
      taxId: body.taxId?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true });
}
