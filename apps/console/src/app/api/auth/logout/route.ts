import { NextResponse } from 'next/server';
import { destroySession } from '@/server/auth';

export async function POST() {
  await destroySession();
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3001'));
}
