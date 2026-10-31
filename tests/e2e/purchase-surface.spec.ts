/**
 * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated to
 * the PSP's Hosted Checkout." (interim purchase-surface gate, plan M0)
 *
 * Verifies the fail-closed posture while `PURCHASE_SURFACE_ENABLED` is
 * unset: both Locale checkout pages render the not-found response and no
 * purchase CTA links to the checkout page anywhere in the Locale trees.
 * Runs in the `storefront` project (flag unset).
 */
import { expect, test } from '@playwright/test';

test.describe('purchase-surface gate (flag unset)', () => {
  for (const path of ['/pt/checkout', '/en/checkout']) {
    test(`${path} renders the not-found response`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByTestId('purchase-surface')).toHaveCount(0);
    });
  }

  for (const path of ['/pt', '/en']) {
    test(`no purchase CTA to /checkout is rendered on ${path}`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.getByTestId('nav-cart')).toHaveCount(0);
      await expect(page.locator('a[href*="/checkout"]')).toHaveCount(0);
    });
  }
});
