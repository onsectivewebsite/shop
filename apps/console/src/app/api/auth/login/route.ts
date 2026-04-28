import { NextResponse } from 'next/server';
import { prisma } from '@onsective/db';
import { verifyPassword, createSession } from '@/server/auth';

const PRIVILEGED = ['PLATFORM_MANAGER', 'ADMIN', 'OWNER', 'CATALOG_MODERATOR', 'FINANCE_OPS'] as const;

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Email and password required.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });
  if (!user || !user.passwordHash || !verifyPassword(user.passwordHash, body.password)) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const allowed = user.roles.some((r) => PRIVILEGED.includes(r as (typeof PRIVILEGED)[number]));
  if (!allowed) {
    return NextResponse.json(
      { error: 'This account does not have console access.' },
      { status: 403 },
    );
  }
  if (user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account is not active.' }, { status: 403 });
  }

  await createSession(user.id, {
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      actorType: 'user',
      actorId: user.id,
      action: 'console.login',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
