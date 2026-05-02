import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';

const bodySchema = z.object({
  vacationMode: z.boolean(),
  vacationMessage: z.string().trim().max(500).optional(),
  // Accept ISO date string from <input type="datetime-local"> or empty
  // string for "no end date".
  vacationUntil: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  let until: Date | null = null;
  if (payload.vacationUntil && payload.vacationUntil.length > 0) {
    const parsed = new Date(payload.vacationUntil);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
    }
    until = parsed;
  }

  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      vacationMode: payload.vacationMode,
      vacationMessage:
        payload.vacationMessage && payload.vacationMessage.length > 0
          ? payload.vacationMessage
          : null,
      vacationUntil: until,
    },
  });

  return NextResponse.json({ ok: true });
}
