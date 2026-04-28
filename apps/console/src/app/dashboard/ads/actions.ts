'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

export async function approveAdAction(campaignId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  await prisma.adCampaign.updateMany({
    where: { id: campaignId, status: 'DRAFT' },
    data: { status: 'ACTIVE' },
  });

  await audit({
    actorId: session.user.id,
    action: 'ads.campaign.approve',
    targetType: 'adCampaign',
    targetId: campaignId,
  });

  revalidatePath('/dashboard/ads');
}

export async function rejectAdAction(
  campaignId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const reason = (formData.get('reason') ?? '').toString().trim();
  if (!reason) throw new Error('Reason required');

  await prisma.adCampaign.updateMany({
    where: { id: campaignId, status: 'DRAFT' },
    data: { status: 'ENDED' },
  });

  await audit({
    actorId: session.user.id,
    action: 'ads.campaign.reject',
    targetType: 'adCampaign',
    targetId: campaignId,
    metadata: { reason: reason.slice(0, 500) },
  });

  revalidatePath('/dashboard/ads');
}
