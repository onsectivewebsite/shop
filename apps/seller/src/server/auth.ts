import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  issueSession,
  lookupSessionByToken,
  revokeSessionByToken,
  type SessionMeta,
} from '@onsective/auth';
import type { User } from '@onsective/db';

export { verifyPassword, hashPassword } from '@onsective/auth';

export async function createSession(userId: string, meta: SessionMeta = {}) {
  const { token, expiresAt } = await issueSession(userId, meta);
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export async function destroySession() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (cookie) await revokeSessionByToken(cookie);
  cookies().delete(SESSION_COOKIE_NAME);
}

export async function getSellerSession(): Promise<{ user: User } | null> {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  const session = await lookupSessionByToken(cookie);
  if (!session) return null;
  return { user: session.user };
}
