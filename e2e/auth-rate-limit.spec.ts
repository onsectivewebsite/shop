import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Hammers the auth.requestEmailOtp tRPC endpoint from a single source. The
 * authRateLimit middleware caps to 5/min keyed on ip+email — the 6th call
 * within the same window must return TOO_MANY_REQUESTS (HTTP 429).
 *
 * Skipped in non-CI runs unless RUN_RATE_LIMIT=1 is set, because it leaves
 * five useless OTP rows behind for the test email.
 */

const RATE_LIMITED = 429;

async function callOtp(api: APIRequestContext, email: string) {
  return api.post('/api/trpc/auth.requestEmailOtp', {
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.42' },
    data: { json: { email } },
  });
}

test('auth requestEmailOtp returns 429 after 5 calls in a minute', async ({ request }) => {
  test.skip(
    !process.env.CI && process.env.RUN_RATE_LIMIT !== '1',
    'set RUN_RATE_LIMIT=1 to opt in locally',
  );

  const email = `rl-${Date.now()}@onsective.test`;

  for (let i = 0; i < 5; i++) {
    const r = await callOtp(request, email);
    expect(r.status(), `call ${i + 1} should not be rate-limited`).not.toBe(RATE_LIMITED);
  }

  const sixth = await callOtp(request, email);
  expect(sixth.status()).toBe(RATE_LIMITED);
});
