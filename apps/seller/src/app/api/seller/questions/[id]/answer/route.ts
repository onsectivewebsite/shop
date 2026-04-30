import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';

const ANSWER_MAX = 2000;

const bodySchema = z.object({
  answer: z.string().trim().min(1).max(ANSWER_MAX),
});

async function resolveContext(questionId: string) {
  const session = await getSellerSession();
  if (!session) return null;
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!seller) return null;
  const question = await prisma.productQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, product: { select: { sellerId: true } } },
  });
  if (!question || question.product.sellerId !== seller.id) return null;
  return { questionId, sellerUserId: session.user.id };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(params.id);
  if (!ctx) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  await prisma.productQuestion.update({
    where: { id: ctx.questionId },
    data: {
      answer: body.answer,
      answeredAt: new Date(),
      answeredBy: ctx.sellerUserId,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(params.id);
  if (!ctx) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }
  await prisma.productQuestion.update({
    where: { id: ctx.questionId },
    data: { answer: null, answeredAt: null, answeredBy: null },
  });
  return NextResponse.json({ ok: true });
}
