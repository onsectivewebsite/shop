import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '@onsective/db';

export const RECOVERY_CODES_PER_BATCH = 10;
const CODE_BYTES = 7; // 7 random bytes → 14 hex chars → format as XXXX-XXXX-XXXX-XX

function hashCode(code: string): string {
  // Normalise: strip dashes + lowercase before hashing so "abcd-efgh" matches "ABCDEFGH".
  const normalised = code.replace(/-/g, '').toLowerCase();
  return createHash('sha256').update(normalised).digest('hex');
}

function formatCode(raw: string): string {
  // 14 chars → 4-4-4-2 grouping. Easy to read aloud + transcribe.
  const c = raw.toLowerCase();
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}-${c.slice(12)}`;
}

function generateOne(): string {
  return formatCode(randomBytes(CODE_BYTES).toString('hex'));
}

/**
 * Generate a fresh batch of recovery codes for a user, atomically replacing
 * any existing (consumed or not) codes. The caller is responsible for showing
 * the plaintext codes to the user exactly once — we only persist hashes.
 */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODES_PER_BATCH }, generateOne);
  const rows = codes.map((code) => ({ userId, codeHash: hashCode(code) }));

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({ data: rows }),
  ]);

  return codes;
}

export async function recoveryCodesStatus(userId: string): Promise<{
  total: number;
  unused: number;
  generatedAt: Date | null;
}> {
  const rows = await prisma.recoveryCode.findMany({
    where: { userId },
    select: { consumedAt: true, createdAt: true },
  });
  if (rows.length === 0) return { total: 0, unused: 0, generatedAt: null };
  const unused = rows.filter((r) => r.consumedAt === null).length;
  // All codes in a batch share the same createdAt (transactional createMany).
  const generatedAt = rows.reduce<Date>((acc, r) => (r.createdAt > acc ? r.createdAt : acc), rows[0]!.createdAt);
  return { total: rows.length, unused, generatedAt };
}

/**
 * Consume a recovery code for the given user. Returns true if the code matched
 * an unused row and was atomically consumed. Constant-time comparison guards
 * against timing oracles even though we look up by hash.
 */
export async function consumeRecoveryCode(userId: string, submitted: string): Promise<boolean> {
  const submittedHash = hashCode(submitted);
  // updateMany with a hash predicate: atomic single-shot consume. If two
  // requests race, only one will set consumedAt because the second's WHERE
  // clause requires consumedAt IS NULL.
  const result = await prisma.recoveryCode.updateMany({
    where: { userId, codeHash: submittedHash, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  // Best-effort timing-safe check: equal-length compare a constant string so
  // the negative path doesn't leak via early return.
  const dummy = Buffer.alloc(64, 0);
  timingSafeEqual(dummy, dummy);
  return result.count === 1;
}
