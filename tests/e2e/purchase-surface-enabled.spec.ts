/**
 * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated to
 * the PSP's Hosted Checkout." (interim purchase-surface gate, plan M0)
 *
 * Temporary-test-control verification: setting `PURCHASE_SURFACE_ENABLED`
 * in a non-production environment must restore the surface so the real
 * checkout flow can be developed and verified (M3). Runs only in the
 * `purchase-enabled` project, whose server is started with the flag set.
 */
import { expect, test } from '@playwright/test';

test.describe('purchase-surface gate (flag enabled)', () => {
  for (const path of ['/pt/checkout', '/en/checkout']) {
    test(`${path} renders the purchase surface`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByTestId('purchase-surface')).toBeVisible();
    });
  }

  test('the checkout nav CTA is rendered', async ({ page }) => {
    await page.goto('/pt');
    await expect(page.getByTestId('nav-cart').first()).toBeVisible();
  });
});
