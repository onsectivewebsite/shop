import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { hashPassword, createSession } from '@/server/auth';

export async function POST(req: Request) {
  let body: { email?: string; password?: string; fullName?: string; countryCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const email = (body.email ?? '').toLowerCase().trim();
  const password = body.password ?? '';
  const fullName = (body.fullName ?? '').trim();
  const countryCode = (body.countryCode ?? 'US').toUpperCase();

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'Email, password, and name are required.' }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ error: 'Password must be at least 10 characters.' }, { status: 400 });
  }
  if (countryCode.length !== 2) {
    return NextResponse.json({ error: 'Country must be a 2-letter ISO code.' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: 'Email already registered. Sign in instead.' },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      fullName,
      countryCode,
      // Seller-side signup: skip the email-verify gate. KYC is the real verification step.
      emailVerified: new Date(),
      roles: ['BUYER', 'SELLER'],
    },
  });

  await createSession(user.id, {
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
