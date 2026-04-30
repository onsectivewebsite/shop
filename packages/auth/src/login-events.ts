import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '@onsective/db';
import { lookupCountry } from './geo';

export type LoginMethod =
  | 'password'
  | 'passkey'
  | 'passwordless'
  | 'recovery_code'
  | 'sms';

export type LoginContext = {
  userId: string;
  ip: string | null;
  userAgent: string | null;
  method: LoginMethod;
  success: boolean;
};

const REVOCATION_TOKEN_TTL_DAYS = 7;
const REVOCATION_TOKEN_BYTES = 32;
// Need at least this many prior successful sign-ins before "new country" is
// a useful signal — without history every first sign-in fires the alarm.
const MIN_HISTORY_FOR_SUSPICION = 2;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Persist a login event and return the resolved country code. */
export async function recordLoginEvent(ctx: LoginContext): Promise<string | null> {
  const countryCode = lookupCountry(ctx.ip);
  await prisma.loginEvent.create({
    data: {
      userId: ctx.userId,
      ip: ctx.ip,
      countryCode,
      userAgent: ctx.userAgent,
      method: ctx.method,
      success: ctx.success,
    },
  });
  return countryCode;
}

/**
 * Returns true when this country has never appeared on a successful login
 * for the user before AND the user has enough prior history that a new
 * country is meaningful. Callers must pass the country derived from the
 * *current* sign-in event — typically the return value of recordLoginEvent.
 *
 * Note: we count the *new* event in history (it was just inserted), so the
 * threshold check is `>= MIN_HISTORY_FOR_SUSPICION + 1`. If the new country
 * is the only one we've ever seen, it's not suspicious — it's the first.
 */
export async function isSuspiciousLogin(args: {
  userId: string;
  countryCode: string | null;
}): Promise<boolean> {
  if (!args.countryCode) return false;

  const priorInCountry = await prisma.loginEvent.count({
    where: {
      userId: args.userId,
      success: true,
      countryCode: args.countryCode,
    },
  });
  // The just-recorded event is included in the count above, so > 1 means we
  // had a prior success in this country and nothing's new.
  if (priorInCountry > 1) return false;

  const totalSuccessful = await prisma.loginEvent.count({
    where: { userId: args.userId, success: true },
  });
  // > MIN_HISTORY_FOR_SUSPICION because the current event is in the count.
  return totalSuccessful > MIN_HISTORY_FOR_SUSPICION;
}

/**
 * Mint a one-shot revocation token and persist its hash. The plaintext is
 * returned exactly once so the caller can bake it into the alert email.
 */
export async function issueRevocationToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(REVOCATION_TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + REVOCATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.suspiciousLoginToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

/**
 * Atomically consume a revocation token. Returns the userId on success so
 * the caller can run the actual session purge + force-reset in the same
 * request. Atomic via updateMany so two clicks of the same link can't both
 * win.
 */
export async function consumeRevocationToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const row = await prisma.suspiciousLoginToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true },
  });
  if (!row) return null;
  if (row.consumedAt) return null;
  if (row.expiresAt < new Date()) return null;

  const result = await prisma.suspiciousLoginToken.updateMany({
    where: { tokenHash, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (result.count !== 1) return null;
  return row.userId;
}
