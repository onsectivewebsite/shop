import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('round-trips a strong password', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword(hash, 'correct horse battery staple')).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword(hash, 'incorrect horse battery staple')).toBe(false);
  });

  it('refuses short passwords', () => {
    expect(() => hashPassword('short')).toThrow(/10 character/);
  });

  it('returns false on a malformed hash', () => {
    expect(verifyPassword('not-a-real-hash', 'whatever-password')).toBe(false);
  });
});
