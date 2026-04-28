'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';
import { issueOtp } from '@/server/otp';
import { sendOtpEmail } from '@/server/notifications';

export async function sendPasswordResetAction(userId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const { code } = await issueOtp({
    destination: user.email,
    channel: 'email',
    purpose: 'password_reset',
    userId: user.id,
  });
  await sendOtpEmail(user.email, code);

  await audit({
    actorId: session.user.id,
    action: 'user.password_reset.send',
    targetType: 'user',
    targetId: userId,
  });

  revalidatePath(`/dashboard/users/${userId}`);
}

export async function suspendUserAction(userId: string, reason: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  await prisma.user.update({
    where: { id: userId },
    data: { status: 'SUSPENDED' },
  });
  await prisma.session.deleteMany({ where: { userId } });

  await audit({
    actorId: session.user.id,
    action: 'user.suspend',
    targetType: 'user',
    targetId: userId,
    metadata: { reason },
  });

  revalidatePath(`/dashboard/users/${userId}`);
}
