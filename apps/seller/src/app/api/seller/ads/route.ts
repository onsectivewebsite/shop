import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  productId: z.string().min(1),
  placement: z.enum(['SEARCH_RESULTS', 'PDP_RELATED', 'HOME_FEATURED']),
  // Bid + budget come in major units (dollars/rupees) for the form; we
  // convert to minor units before persisting so the schema's Int contract
  // holds.
  bidCpc: z.number().positive().max(1000),
  dailyBudget: z.number().positive().max(100_000),
  totalBudget: z.number().positive().max(10_000_000).nullable(),
  currency: z.string().length(3).toUpperCase(),
  keywords: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
});

function toMinor(amount: number): number {
  // Two-decimal currencies only for v1 (USD/INR/EUR/GBP). The seller form
  // limits input to 2 decimals, so rounding here only catches float cruft.
  return Math.round(amount * 100);
}

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });
  if (seller.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'Your seller account must be approved before running ads.' },
      { status: 403 },
    );
  }

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.errors[0]?.message ?? 'Bad input' : 'Bad request' },
      { status: 400 },
    );
  }

  // Defence-in-depth: verify the product belongs to this seller. The form
  // populates a dropdown from prisma.product.findMany({ sellerId }), but
  // the request body could be tampered.
  const product = await prisma.product.findFirst({
    where: { id: body.productId, sellerId: seller.id },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }
  if (body.endsAt && body.endsAt <= body.startsAt) {
    return NextResponse.json(
      { error: 'End date must be after start date.' },
      { status: 400 },
    );
  }

  const created = await prisma.adCampaign.create({
    data: {
      sellerId: seller.id,
      productId: product.id,
      name: body.name,
      placement: body.placement,
      bidCpcMinor: toMinor(body.bidCpc),
      dailyBudgetMinor: toMinor(body.dailyBudget),
      totalBudgetMinor: body.totalBudget !== null ? toMinor(body.totalBudget) : null,
      currency: body.currency,
      keywords: body.keywords,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      status: 'DRAFT',
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id });
}
