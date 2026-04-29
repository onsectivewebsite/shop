'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma, type UserRole } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';
import { issueOtp } from '@/server/otp';
import { sendOtpEmail } from '@/server/notifications';
import { filterGrantableRoles, canTargetUser } from '@/lib/role-policy';

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

export async function reactivateUserAction(userId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');
  await prisma.user.update({
    where: { id: userId },
    data: { status: 'ACTIVE', lockedUntil: null, failedLoginAttempts: 0 },
  });
  await audit({
    actorId: session.user.id,
    action: 'user.reactivate',
    targetType: 'user',
    targetId: userId,
  });
  revalidatePath(`/dashboard/users/${userId}`);
}

export async function unlockUserAction(userId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');
  await prisma.user.update({
    where: { id: userId },
    data: { lockedUntil: null, failedLoginAttempts: 0 },
  });
  await audit({
    actorId: session.user.id,
    action: 'user.unlock',
    targetType: 'user',
    targetId: userId,
  });
  revalidatePath(`/dashboard/users/${userId}`);
}

export async function updateUserRolesAction(
  userId: string,
  rolesCsv: string,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');
  const allowed: UserRole[] = [
    'BUYER',
    'SELLER',
    'SUPPORT_AGENT',
    'PLATFORM_MANAGER',
    'CATALOG_MODERATOR',
    'FINANCE_OPS',
    'ADMIN',
    'OWNER',
  ];
  const submitted = rolesCsv
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter((r): r is UserRole => allowed.includes(r as UserRole));
  if (submitted.length === 0) throw new Error('At least one valid role required.');

  // Block an actor from acting on a user whose privilege exceeds theirs.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  if (!target) throw new Error('User not found.');
  if (!canTargetUser(session.user.roles, target.roles)) {
    throw new Error('You cannot edit a user whose privilege exceeds yours.');
  }
  // Block an actor from granting roles above their own ceiling.
  const roles = filterGrantableRoles(session.user.roles, submitted);
  if (roles.length !== submitted.length) {
    throw new Error('You cannot grant a role higher than your own.');
  }
  await prisma.user.update({ where: { id: userId }, data: { roles } });
  await audit({
    actorId: session.user.id,
    action: 'user.roles.update',
    targetType: 'user',
    targetId: userId,
    metadata: { roles },
  });
  revalidatePath(`/dashboard/users/${userId}`);
}

export async function deleteUserAction(userId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');
  if (session.user.id === userId) {
    throw new Error('You cannot delete your own account.');
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  if (!target) throw new Error('User not found.');
  if (!canTargetUser(session.user.roles, target.roles)) {
    throw new Error('You cannot delete a user whose privilege exceeds yours.');
  }
  // Soft-delete: mark deletedAt + suspend + revoke sessions; preserve audit trail.
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'SUSPENDED',
      deletedAt: new Date(),
      email: `deleted_${userId}@onsective.invalid`,
    },
  });
  await prisma.session.deleteMany({ where: { userId } });
  await audit({
    actorId: session.user.id,
    action: 'user.delete',
    targetType: 'user',
    targetId: userId,
  });
  redirect('/dashboard/users');
}
