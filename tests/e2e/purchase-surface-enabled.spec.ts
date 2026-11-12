/**
 * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated to
 * the PSP's Hosted Checkout." (interim purchase-surface gate, plan M0)
 *
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "Every Media Slot is a link to
 * the Simplified Purchase Surface within the same Locale — seeing a
 * product image and tapping it is the primary path to purchase."
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

  for (const locale of ['pt', 'en']) {
    // Implements ADR 03-002 - every Media Slot links to the Simplified
    // Purchase Surface within the same Locale.
    test(`/${locale} renders at least three Media Slot links to the same-Locale checkout`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      const mediaLinks = page.locator(
        'article[id^="post-"] a[href$="/checkout"]'
      );
      expect(await mediaLinks.count()).toBeGreaterThanOrEqual(3);
      // Locale prefix preserved on every media link (ADR 00-005).
      const hrefs = await mediaLinks.evaluateAll((anchors) =>
        anchors.map((a) => a.getAttribute('href'))
      );
      for (const href of hrefs) {
        expect(href).toBe(`/${locale}/checkout`);
      }
    });
  }
});
