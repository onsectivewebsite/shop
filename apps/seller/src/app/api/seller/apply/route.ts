import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'seller';
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? root : `${root}-${Math.random().toString(36).slice(2, 6)}`;
    const exists = await prisma.seller.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
  }
  return `${root}-${Date.now().toString(36).slice(-6)}`;
}

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let body: {
    legalName?: string;
    displayName?: string;
    countryCode?: string;
    description?: string;
    taxId?: string;
    website?: string;
    categoryHints?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const legalName = (body.legalName ?? '').trim();
  const displayName = (body.displayName ?? '').trim();
  const countryCode = (body.countryCode ?? '').toUpperCase();

  if (legalName.length < 2 || displayName.length < 2 || countryCode.length !== 2) {
    return NextResponse.json({ error: 'Legal name, storefront name and country are required.' }, { status: 400 });
  }

  const existing = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (existing) {
    return NextResponse.json(
      { error: `You already applied — current status: ${existing.status}.` },
      { status: 409 },
    );
  }

  const slug = await uniqueSlug(displayName);
  await prisma.seller.create({
    data: {
      userId: session.user.id,
      legalName,
      displayName,
      slug,
      countryCode,
      description: body.description?.trim() || null,
      taxId: body.taxId?.trim() || null,
      status: 'PENDING_KYC',
    },
  });

  return NextResponse.json({ ok: true });
}
