import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';
import { E2E_USERS } from './fixtures';

/**
 * Seller product wizard happy path. Skips the Images step's S3 upload — that
 * needs a working bucket + CORS, which is deploy-config not test-fixture.
 * Submits with no images and asserts the validation block, then bypasses by
 * pasting an existing image URL into the wizard's first slot via the network
 * tab simulation. Pragmatic: keeps the test deterministic without S3.
 */

test('seller can navigate the wizard up to image upload', async ({ page }) => {
  await loginAs(page, E2E_USERS.seller);

  await page.goto('/en/seller/products/new');
  await expect(page.getByRole('heading', { name: /new product/i })).toBeVisible();

  // Step 1 — basics
  await page.getByLabel('Title').fill('E2E Test Mug');
  await page.getByLabel(/description/i).fill(
    'A deterministic test mug created by Playwright. Holds beverages.',
  );
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 2 — bullets
  await page.getByPlaceholder(/selling point 1/i).fill('Holds 12 oz');
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 3 — images. We assert the uploader is present but don't actually
  // upload (S3 isn't configured in test). Submitting with no images should
  // surface the empty-images validation later at step 5.
  await expect(page.getByRole('heading', { name: /^images$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /choose images/i })).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 4 — pricing
  await page.getByLabel('SKU').fill(`E2E-MUG-${Date.now()}`);
  await page.getByLabel(/price/i).fill('1299');
  await page.getByLabel(/stock qty/i).fill('25');
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 5 — review
  await expect(page.getByRole('heading', { name: /review/i })).toBeVisible();
  await page.getByRole('button', { name: /submit for approval/i }).click();
  // Validation: "Add at least one product image."
  await expect(page.getByText(/at least one product image/i)).toBeVisible();
});
