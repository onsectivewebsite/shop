import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';

const REPLY_MAX = 2000;

const bodySchema = z.object({
  reply: z.string().trim().min(1).max(REPLY_MAX),
});

/**
 * Look up the review and confirm the signed-in seller actually owns the
 * product it's attached to. Returns null when the seller has no Seller row,
 * the review doesn't exist, or the seller doesn't own the product. Caller
 * just needs `if (!ctx)` to render a 404.
 */
async function resolveContext(reviewId: string) {
  const session = await getSellerSession();
  if (!session) return null;
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!seller) return null;
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, product: { select: { sellerId: true } } },
  });
  if (!review || review.product.sellerId !== seller.id) return null;
  return { reviewId };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(params.id);
  if (!ctx) {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  await prisma.review.update({
    where: { id: ctx.reviewId },
    data: { sellerReply: body.reply, sellerRepliedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(params.id);
  if (!ctx) {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  }

  await prisma.review.update({
    where: { id: ctx.reviewId },
    data: { sellerReply: null, sellerRepliedAt: null },
  });

  return NextResponse.json({ ok: true });
}
