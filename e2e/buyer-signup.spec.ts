import { test, expect } from '@playwright/test';

test('buyer can sign up and reach the home page', async ({ page }) => {
  const email = `e2e-${Date.now()}@onsective.test`;

  await page.goto('/en/signup');
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();

  await page.getByLabel('Full name').fill('E2E Buyer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: /create account/i }).click();

  // Signup redirects to /verify
  await page.waitForURL(/\/verify/);
  await expect(page.getByRole('heading', { name: /sign in with a code/i })).toBeVisible();
});

test('home page renders categories from DB', async ({ page }) => {
  await page.goto('/en');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /electronics/i })).toBeVisible();
});

test('locale routing works for hi', async ({ page }) => {
  await page.goto('/hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
});
