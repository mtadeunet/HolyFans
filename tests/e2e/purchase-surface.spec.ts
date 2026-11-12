/**
 * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated to
 * the PSP's Hosted Checkout." (interim purchase-surface gate, plan M0)
 *
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "the landing's entire chrome"
 * keeps working while every purchase link in the shell is suppressed by
 * the fail-closed gate.
 *
 * Verifies the fail-closed posture while `PURCHASE_SURFACE_ENABLED` is
 * unset: both Locale checkout pages render the not-found response, no
 * purchase CTA links to the checkout page anywhere in the Locale trees
 * (media slots unlinked, `nav-cart` and rail CTA absent), and the Feed
 * Surface itself still renders its Post Cards. Runs in the `storefront`
 * project (flag forced unset).
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

    // Implements ADR 03-002 - "the Feed Surface is the primary column at
    // every width": gating the purchase surface must not take the feed's
    // editorial content down with it.
    test(`${path} still renders the Feed Surface with at least three Post Cards while gated`, async ({
      page,
    }) => {
      await page.goto(path);
      const postCards = page.locator('article[id^="post-"]');
      await expect(postCards.first()).toBeVisible();
      expect(await postCards.count()).toBeGreaterThanOrEqual(3);
    });
  }
});
