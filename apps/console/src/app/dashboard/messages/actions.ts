'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

export async function hideMessageAction(messageId: string, formData: FormData): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const reason = (formData.get('reason') ?? '').toString().trim();
  if (!reason) throw new Error('Reason required');

  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, isHidden: true },
  });
  if (!existing) throw new Error('Message not found');

  await prisma.$transaction([
    prisma.message.update({
      where: { id: messageId },
      data: { isHidden: true, hiddenReason: reason.slice(0, 500) },
    }),
    prisma.messageReport.deleteMany({ where: { messageId } }),
  ]);

  await audit({
    actorId: session.user.id,
    action: 'message.hide',
    targetType: 'message',
    targetId: messageId,
    metadata: { reason: reason.slice(0, 500) },
  });

  revalidatePath('/dashboard/messages');
}

export async function dismissMessageReportsAction(messageId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const result = await prisma.messageReport.deleteMany({ where: { messageId } });

  await audit({
    actorId: session.user.id,
    action: 'message.report.dismiss',
    targetType: 'message',
    targetId: messageId,
    metadata: { dismissedCount: result.count },
  });

  revalidatePath('/dashboard/messages');
}

export async function unhideMessageAction(messageId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, isHidden: true },
  });
  if (!message || !message.isHidden) return;

  await prisma.message.update({
    where: { id: messageId },
    data: { isHidden: false, hiddenReason: null },
  });

  await audit({
    actorId: session.user.id,
    action: 'message.unhide',
    targetType: 'message',
    targetId: messageId,
  });

  revalidatePath('/dashboard/messages');
}
