import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';

const bodySchema = z.object({
  // Sellers can pause/resume their own campaigns. Approval (DRAFT→ACTIVE)
  // is a console-only transition, so we don't accept ACTIVE here.
  action: z.enum(['pause', 'resume', 'end']),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const campaign = await prisma.adCampaign.findFirst({
    where: { id: params.id, sellerId: seller.id },
    select: { id: true, status: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

  // Each transition allowed from a small set of source states. Anything
  // outside the table is a no-op with a 409 so the UI can surface a clear
  // error rather than silently leaving the campaign in the wrong state.
  const transitions: Record<typeof body.action, { from: readonly string[]; to: string }> = {
    pause: { from: ['ACTIVE'], to: 'PAUSED' },
    resume: { from: ['PAUSED'], to: 'ACTIVE' },
    end: { from: ['ACTIVE', 'PAUSED', 'DRAFT'], to: 'ENDED' },
  };
  const t = transitions[body.action];
  if (!t.from.includes(campaign.status)) {
    return NextResponse.json(
      { error: `Cannot ${body.action} a ${campaign.status} campaign.` },
      { status: 409 },
    );
  }

  await prisma.adCampaign.update({
    where: { id: campaign.id },
    data: { status: t.to as 'ACTIVE' | 'PAUSED' | 'ENDED' },
  });

  return NextResponse.json({ ok: true });
}
