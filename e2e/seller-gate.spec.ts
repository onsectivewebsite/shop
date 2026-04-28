import { test, expect } from '@playwright/test';

test.describe('auth-gated routes', () => {
  test('unauthenticated /seller redirects to login', async ({ page }) => {
    await page.goto('/en/seller');
    await page.waitForURL(/\/login/);
    await expect(page.getByRole('heading')).toContainText(/sign in|log in/i);
  });

  test('unauthenticated /seller/products bounces to login too', async ({ page }) => {
    await page.goto('/en/seller/products');
    await page.waitForURL(/\/login/);
  });

  test('unauthenticated /account/passkeys redirects to login', async ({ page }) => {
    await page.goto('/en/account/passkeys');
    await page.waitForURL(/\/login/);
  });

  test('unauthenticated /checkout/address bounces to login', async ({ page }) => {
    await page.goto('/en/checkout/address');
    await page.waitForURL(/\/login/);
  });
});
