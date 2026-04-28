'use server';

import { redirect } from 'next/navigation';
import { hashPassword } from '@onsective/auth';
import { prisma, type Prisma, type UserRole } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

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
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const countryCode = String(formData.get('countryCode') ?? 'US').toUpperCase();
  const rolesRaw = formData.getAll('roles').map(String);
  const roles = rolesRaw.filter((r): r is UserRole => ALLOWED.includes(r as UserRole));

  if (!email || !password || !fullName || roles.length === 0) {
    throw new Error('Missing required fields.');
  }
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (countryCode.length !== 2) throw new Error('Country must be a 2-letter ISO code.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already registered.');

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      fullName,
      countryCode,
      roles,
      // Console-created users are pre-verified — admin vouches for the email
      emailVerified: new Date(),
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'user.create',
    targetType: 'user',
    targetId: created.id,
    metadata: { email, roles, countryCode } as Prisma.InputJsonValue,
  });

  redirect(`/dashboard/users/${created.id}`);
}
