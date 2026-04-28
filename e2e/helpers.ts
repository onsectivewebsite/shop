import type { Page } from '@playwright/test';
import { E2E_PASSWORD } from './fixtures';

/**
 * Browser-side login helper. Hits the password sign-in path; the OTP and
 * passkey flows are exercised by their own dedicated specs.
 *
 * Stays on /en throughout so the next-intl middleware doesn't bounce to a
 * different locale mid-test.
 */
export async function loginAs(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto('/en/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  // Login redirects to '/' which middleware rewrites to '/en'.
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
}

/**
 * Console login helper. Same idea but on :3001 with the role gate.
 */
export async function loginAsConsole(
  page: Page,
  consoleUrl: string,
  email: string,
  password = E2E_PASSWORD,
) {
  await page.goto(`${consoleUrl}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 10_000 });
}
