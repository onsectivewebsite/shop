import { test, expect } from '@playwright/test';
import { loginAsConsole } from './helpers';
import { E2E_USERS } from './fixtures';

const CONSOLE = process.env.E2E_CONSOLE_URL ?? 'http://localhost:3001';

/**
 * 4-eyes refund flow: PM #1 requests a refund > $500 (the direct-authority
 * threshold), an ApprovalRequest is created, PM #2 approves, the order moves
 * to REFUNDED.
 *
 * Uses fixtures' ONS-E2E-PAID-001 order. The headphones cost 14999 cents = $149.99
 * which is BELOW the $500 threshold, so this flow doesn't actually trigger
 * 4-eyes. Marked `test.fixme` until fixtures include a high-value order.
 */

test.fixme('refund > $500 triggers 4-eyes and PM #2 approves', async ({ page }) => {
  // PM #1 finds the order
  await loginAsConsole(page, CONSOLE, E2E_USERS.pm);
  await page.goto(`${CONSOLE}/dashboard/orders`);
  await page.getByRole('link', { name: /ONS-E2E-PAID-001/i }).click();

  await page.getByRole('button', { name: /refund/i }).click();
  await page.getByLabel(/reason/i).fill('Buyer reports defective unit. Refunding full amount.');
  await page.getByRole('button', { name: /confirm refund/i }).click();

  // Above threshold → goes to approval queue, not direct
  await expect(page.getByText(/awaiting approval/i)).toBeVisible();

  // Sign out PM #1
  await page.goto(`${CONSOLE}/api/auth/logout`);

  // PM #2 approves
  await loginAsConsole(page, CONSOLE, E2E_USERS.pm2);
  await page.goto(`${CONSOLE}/dashboard/approvals`);
  await page.getByRole('button', { name: /approve/i }).first().click();

  // Verify order is now refunded
  await page.goto(`${CONSOLE}/dashboard/orders`);
  await page.getByRole('link', { name: /ONS-E2E-PAID-001/i }).click();
  await expect(page.getByText(/refunded/i)).toBeVisible();
});

test('PM cannot self-approve their own refund request', async ({ page }) => {
  test.skip(
    process.env.RUN_4_EYES_E2E !== '1',
    'requires a pending approval request seeded by PM-1; set RUN_4_EYES_E2E=1 once fixtures support it',
  );
  // Placeholder — the 4-eyes self-approval guard is unit-tested in the
  // approval action itself; this E2E waits on the high-value-order fixture.
});
