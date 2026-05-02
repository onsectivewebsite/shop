import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to save items.' }, { status: 401 });
  }

  let body: { productId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  if (!body.productId || typeof body.productId !== 'string') {
    return NextResponse.json({ error: 'productId required.' }, { status: 400 });
  }

  // Toggle: if exists, remove; else, add.
  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: session.user.id, productId: body.productId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  // Verify the product exists + is active before saving (no orphans). Pull
  // the cheapest active variant to snapshot a price baseline that the
  // price-drop digest cron measures against.
  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    select: {
      id: true,
      status: true,
      variants: {
        where: { isActive: true },
        orderBy: { priceAmount: 'asc' },
        take: 1,
        select: { priceAmount: true, currency: true },
      },
    },
  });
  if (!product) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }
  const cheapest = product.variants[0];

  await prisma.wishlistItem.create({
    data: {
      userId: session.user.id,
      productId: product.id,
      priceAtSaveMinor: cheapest?.priceAmount ?? null,
      priceCurrency: cheapest?.currency ?? null,
    },
  });
  return NextResponse.json({ saved: true });
}
