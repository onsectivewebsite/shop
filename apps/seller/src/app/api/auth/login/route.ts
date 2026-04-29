import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifyPassword, createSession } from '@/server/auth';

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

  const email = body.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: `Account temporarily locked. Try again after ${user.lockedUntil.toUTCString()}.` },
      { status: 429 },
    );
  }

  if (!user || !user.passwordHash || !verifyPassword(user.passwordHash, body.password)) {
    if (user) {
      const fails = user.failedLoginAttempts + 1;
      const shouldLock = fails >= 5;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: fails,
          lockedUntil: shouldLock ? new Date(Date.now() + 30 * 60 * 1000) : user.lockedUntil,
        },
      });
    }
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  if (user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account is not active.' }, { status: 403 });
  }

  await createSession(user.id, {
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });

  return NextResponse.json({ ok: true });
}
