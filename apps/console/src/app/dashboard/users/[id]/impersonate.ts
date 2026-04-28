'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

export async function startImpersonationAction(
  targetUserId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const reason = (formData.get('reason') ?? '').toString().trim();
  if (!reason) throw new Error('Reason required.');
  if (reason.length > 500) throw new Error('Reason too long.');

  const ticketContextId = (formData.get('ticketContextId') ?? '').toString().trim() || null;

  // Close any prior active session this PM has on this user — only one at a time.
  await prisma.impersonationSession.updateMany({
    where: { pmId: session.user.id, targetUserId, endedAt: null },
    data: { endedAt: new Date() },
  });

  const created = await prisma.impersonationSession.create({
    data: {
      pmId: session.user.id,
      targetUserId,
      mode: 'READ_ONLY',
      ticketContextId,
      reason: reason.slice(0, 500),
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'user.impersonate.start',
    targetType: 'user',
    targetId: targetUserId,
    metadata: { sessionId: created.id, ticketContextId, reason: reason.slice(0, 500) },
  });

  revalidatePath(`/dashboard/users/${targetUserId}`);
}

export async function endImpersonationAction(
  targetUserId: string,
  sessionId: string,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  await prisma.impersonationSession.updateMany({
    where: { id: sessionId, pmId: session.user.id, endedAt: null },
    data: { endedAt: new Date() },
  });

  await audit({
    actorId: session.user.id,
    action: 'user.impersonate.end',
    targetType: 'user',
    targetId: targetUserId,
    metadata: { sessionId },
  });

  revalidatePath(`/dashboard/users/${targetUserId}`);
}
