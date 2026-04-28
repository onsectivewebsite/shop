import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';
import { E2E_USERS } from './fixtures';

/**
 * Buyer checkout happy path against the e2e fixture data.
 *
 * Stripe payment leg is `test.fixme` by default — completing it needs:
 *   - STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY in the env Playwright runs in
 *   - the Stripe Elements iframe (frameLocator-based interaction)
 * Set RUN_STRIPE_E2E=1 to opt in.
 */

test('buyer can browse → add to cart → reach checkout', async ({ page }) => {
  await loginAs(page, E2E_USERS.buyer);

  await page.goto('/en/product/e2e-headphones');
  await expect(page.getByRole('heading', { name: /E2E Wireless Headphones/i })).toBeVisible();

  await page.getByRole('button', { name: /^add to cart$/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible();

  await page.goto('/en/cart');
  await expect(page.getByText(/E2E Wireless Headphones/i)).toBeVisible();
});

test('buyer can complete address step in checkout', async ({ page }) => {
  await loginAs(page, E2E_USERS.buyer);

  // Seed a cart by adding directly via PDP first.
  await page.goto('/en/product/e2e-headphones');
  await page.getByRole('button', { name: /^add to cart$/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible();

  await page.goto('/en/checkout/address');
  // The fixtures created a default address ("e2e-buyer-shipping") so the
  // form should present it pre-selected. Just continue.
  await page.getByRole('button', { name: /continue|next/i }).click();
  await page.waitForURL(/\/checkout\/(shipping|pay)/);
});

test.fixme('buyer pays with Stripe test card and lands on success', async ({ page }) => {
  test.skip(process.env.RUN_STRIPE_E2E !== '1', 'set RUN_STRIPE_E2E=1 to opt in');

  await loginAs(page, E2E_USERS.buyer);
  await page.goto('/en/product/e2e-headphones');
  await page.getByRole('button', { name: /^add to cart$/i }).click();
  await page.goto('/en/checkout/address');
  await page.getByRole('button', { name: /continue|next/i }).click();

  // Shipping step (if it exists in this flow).
  if (/\/checkout\/shipping/.test(page.url())) {
    await page.getByRole('button', { name: /continue|next/i }).click();
  }

  // Stripe Elements is rendered inside an iframe.
  const cardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  await cardFrame.locator('input[name="cardnumber"]').fill('4242 4242 4242 4242');
  await cardFrame.locator('input[name="exp-date"]').fill('12 / 34');
  await cardFrame.locator('input[name="cvc"]').fill('123');
  await cardFrame.locator('input[name="postal"]').fill('94016');

  await page.getByRole('button', { name: /pay|place order/i }).click();
  await page.waitForURL(/\/checkout\/success/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /thank you|order placed/i })).toBeVisible();
});
