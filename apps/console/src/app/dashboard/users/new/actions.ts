'use server';

import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { hashPassword, issueOtp } from '@onsective/auth';
import { prisma, type UserRole } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';
import { filterGrantableRoles } from '@/lib/role-policy';
import { sendWelcomeEmail } from '@/server/notifications';

const ALLOWED: UserRole[] = [
  'BUYER',
  'SELLER',
  'SUPPORT_AGENT',
  'PLATFORM_MANAGER',
  'CATALOG_MODERATOR',
  'FINANCE_OPS',
  'ADMIN',
  'OWNER',
];

export async function createUserAction(formData: FormData): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const countryCode = String(formData.get('countryCode') ?? 'US').toUpperCase();
  const rolesRaw = formData.getAll('roles').map(String);
  const submitted = rolesRaw.filter((r): r is UserRole => ALLOWED.includes(r as UserRole));

  // Privilege guard: an actor can only grant roles at or below their own ceiling.
  const roles = filterGrantableRoles(session.user.roles, submitted);
  if (roles.length !== submitted.length) {
    throw new Error('You cannot grant a role higher than your own.');
  }
  if (!email || !fullName || roles.length === 0) {
    throw new Error('Missing required fields.');
  }
  if (countryCode.length !== 2) throw new Error('Country must be a 2-letter ISO code.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already registered.');

  // Server-generated random password the user never sees. They go through the
  // welcome-email reset flow to set their own.
  const seedPassword = randomBytes(24).toString('base64url');

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(seedPassword),
      fullName,
      countryCode,
      roles,
      // Console-created users are pre-verified — admin vouches for the email.
      emailVerified: new Date(),
    },
  });

  // Issue a password_reset OTP and send the welcome email so the user can
  // set their own password instead of inheriting one the admin chose.
  const { code } = await issueOtp({
    destination: created.email,
    channel: 'email',
    purpose: 'password_reset',
    userId: created.id,
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';
  try {
    await sendWelcomeEmail(created.email, code, {
      invitedByName: session.user.fullName ?? undefined,
      appUrl,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] welcome send failed:', err);
  }

  await audit({
    actorId: session.user.id,
    action: 'user.create',
    targetType: 'user',
    targetId: created.id,
    metadata: { email, roles, countryCode },
  });

  redirect(`/dashboard/users/${created.id}`);
}
