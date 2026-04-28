import { prisma } from '@onsective/db';
import type { User } from '@onsective/db';
import { SESSION_TTL_MS } from './constants';
import { generateSessionToken, hashToken } from './tokens';

export type SessionMeta = {
  userAgent?: string;
  ipAddress?: string;
};

export type IssuedSession = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

export async function issueSession(userId: string, meta: SessionMeta = {}): Promise<IssuedSession> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { userId, tokenHash, expiresAt, ...meta } });
  return { token, tokenHash, expiresAt };
}

export async function lookupSessionByToken(
  token: string,
): Promise<{
  user: User;
  sessionId: string;
  impersonation: { sessionId: string; pmId: string } | null;
} | null> {
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true, impersonation: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.status !== 'ACTIVE') return null;

  // If impersonation has ended, kill this web session — PM revoked it.
  if (session.impersonation && session.impersonation.endedAt) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    user: session.user,
    sessionId: session.id,
    impersonation: session.impersonation
      ? { sessionId: session.impersonation.id, pmId: session.impersonation.pmId }
      : null,
  };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
}

export async function revokeAllSessionsFor(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
