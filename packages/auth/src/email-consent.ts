import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '@onsective/db';

const UNSUBSCRIBE_TTL_DAYS = 365;
const UNSUBSCRIBE_TTL_MS = UNSUBSCRIBE_TTL_DAYS * 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a one-click unsubscribe token for a user. Long-lived (1 year) so
 * the link in an email the user opens months later still works. The
 * plaintext is returned exactly once; we persist only its sha256.
 *
 * Marketing-email rendering should always include a fresh token rather than
 * reusing one — Gmail and Outlook both prefetch URLs in the inbox preview
 * pane, which would silently consume a single-use token. We sidestep that
 * by making consume() idempotent: a second call after the first just sees
 * the user already opted-out.
 */
export async function issueUnsubscribeToken(args: {
  userId: string;
  scope?: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + UNSUBSCRIBE_TTL_MS);
  await prisma.unsubscribeToken.create({
    data: {
      userId: args.userId,
      scope: args.scope ?? 'marketing',
      tokenHash: hash(token),
      expiresAt,
    },
  });
  return { token, expiresAt };
}

/**
 * Consume an unsubscribe token: stamps `consumedAt` on the token and flips
 * `User.emailMarketingOptIn` off in the same transaction. Idempotent — a
 * replayed click on an already-consumed token still flips the user's flag
 * off (it's already off, but the SQL is harmless), so a prefetched URL
 * doesn't create user-visible failures on the second human click.
 *
 * Returns the userId on success, null on missing/expired token.
 */
export async function consumeUnsubscribeToken(token: string): Promise<string | null> {
  const tokenHash = hash(token);
  const row = await prisma.unsubscribeToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, scope: true, expiresAt: true },
  });
  if (!row) return null;
  if (row.expiresAt < new Date()) return null;

  await prisma.$transaction([
    prisma.unsubscribeToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { emailMarketingOptIn: false },
    }),
  ]);
  return row.userId;
}

/** Read-only — the toggle on /account/notifications uses this to seed state. */
export async function getEmailMarketingOptIn(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailMarketingOptIn: true },
  });
  return u?.emailMarketingOptIn ?? false;
}

export async function setEmailMarketingOptIn(userId: string, optIn: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailMarketingOptIn: optIn },
  });
}
