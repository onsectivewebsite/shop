import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';
import { notifyNewMessage } from '@/server/messaging';

const BODY_MAX = 2000;

const sendSchema = z.object({
  body: z.string().trim().min(1).max(BODY_MAX),
});

async function resolveContext(conversationId: string) {
  const session = await getSellerSession();
  if (!session) return null;
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!seller) return null;
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, sellerId: true },
  });
  if (!conv || conv.sellerId !== seller.id) return null;
  return { conversationId: conv.id, sellerUserId: session.user.id };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(params.id);
  if (!ctx) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }
  let payload: z.infer<typeof sendSchema>;
  try {
    payload = sendSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: ctx.conversationId,
        authorRole: 'SELLER',
        authorId: ctx.sellerUserId,
        body: payload.body,
      },
    }),
    prisma.conversation.update({
      where: { id: ctx.conversationId },
      data: { lastMessageAt: now, sellerLastReadAt: now },
    }),
  ]);

  // Fire-and-forget — never block the seller's response on SMTP. The
  // notify helper handles its own throttle + error swallow.
  void notifyNewMessage({
    conversationId: ctx.conversationId,
    fromRole: 'SELLER',
    bodyPreview: payload.body,
  });

  return NextResponse.json({ ok: true });
}
