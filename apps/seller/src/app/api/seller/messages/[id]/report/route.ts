import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';

const bodySchema = z.object({
  reason: z.enum(['SPAM', 'OFFENSIVE', 'HARASSMENT', 'SCAM', 'OTHER']),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!seller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Confirm the seller is a participant in this message's conversation.
  const message = await prisma.message.findFirst({
    where: { id: params.id, conversation: { sellerId: seller.id } },
    select: { id: true },
  });
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  try {
    await prisma.messageReport.create({
      data: {
        messageId: message.id,
        reporterId: session.user.id,
        reporterRole: 'SELLER',
        reason: payload.reason,
        note: payload.note,
      },
    });
  } catch (err: unknown) {
    // P2002 = idempotent re-report; treat as success.
    if ((err as { code?: string }).code !== 'P2002') throw err;
  }

  return NextResponse.json({ ok: true });
}
