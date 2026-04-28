import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  issueSession,
  lookupSessionByToken,
  revokeSessionByToken,
  revokeAllSessionsFor,
  type SessionMeta,
} from '@onsective/auth';
import type { User } from '@onsective/db';

export async function createSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<{ token: string; expiresAt: Date }> {
  const { token, expiresAt } = await issueSession(userId, meta);
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
  return { token, expiresAt };
}

export async function getSession(): Promise<{
  user: User;
  sessionId: string;
  impersonation: { sessionId: string; pmId: string } | null;
} | null> {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  return lookupSessionByToken(cookie);
}

export async function destroySession(): Promise<void> {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (cookie) await revokeSessionByToken(cookie);
  cookies().delete(SESSION_COOKIE_NAME);
}

export async function destroyAllSessionsFor(userId: string): Promise<void> {
  await revokeAllSessionsFor(userId);
}
