import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Stored format: `scrypt:N:r:p:salt(hex):key(hex)`. Default cost tuned for ~100ms on a modern server.
// Migrate to argon2id when ready — see ADRs.

const N = 1 << 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
// 128 * N * r ≈ 32 MiB at these params, which sits right at Node's default maxmem.
// Bump explicitly so verification can't randomly fail near the boundary.
const MAX_MEM = 64 * 1024 * 1024;

export function hashPassword(password: string): string {
  if (password.length < 10) throw new Error('Password must be ≥ 10 characters.');
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: MAX_MEM });
  return `scrypt:${N}:${R}:${P}:${salt.toString('hex')}:${key.toString('hex')}`;
}

export function verifyPassword(stored: string, password: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltHex, keyHex] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');
  const key = scryptSync(password, salt, expected.length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
    maxmem: MAX_MEM,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
