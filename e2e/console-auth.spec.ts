import { test, expect } from '@playwright/test';

const CONSOLE = process.env.E2E_CONSOLE_URL ?? 'http://localhost:3001';

test('unauthenticated console redirects to /login', async ({ page }) => {
  await page.goto(`${CONSOLE}/dashboard`);
  await page.waitForURL(/\/login/);
  await expect(page.getByRole('heading', { name: /Onsective Console/i })).toBeVisible();
});

test('non-admin user cannot enter console', async ({ page }) => {
  await page.goto(`${CONSOLE}/login`);
  await page.getByLabel('Email').fill('regular-buyer@onsective.test');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: /sign in/i }).click();

  // Either an error appears, or we stay on /login (depending on whether the buyer exists).
  await expect(page).toHaveURL(/\/login/);
});
