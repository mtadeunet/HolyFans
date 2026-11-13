/**
 * Implements ADR 00-007: Quality Tooling and CI - "End-to-end tests run
 * against the production-built application and verify the public
 * contracts."
 *
 * Implements ADR 00-010: Pre-order and Stock Notification — "a Stock
 * Flag **per Variant** in Site Config ... each defaulting off" and "a
 * Variant is purchasable exactly when every Availability Flag applying
 * to it in Product Data is on AND its own Stock Flag in Site Config
 * is off".
 *
 * The flag-off counterpart of `pre-order.spec.ts`, running in the
 * `purchase-enabled` project: that server carries the default Site
 * Config posture — every Stock Flag off — so the surface stays fully
 * purchasable and the Suggestions Rail card keeps its `?fit=` purchase
 * link.
 */
import { expect, test } from '@playwright/test';

const BUY_COPY: Record<string, { cta: RegExp }> = {
  '/pt/checkout': { cta: /Comprar Agora/i },
  '/en/checkout': { cta: /Buy Now/i },
};

test.describe('Stock Flags off — the purchasable default', () => {
  for (const [path, copy] of Object.entries(BUY_COPY)) {
    // Implements ADR 00-010 - every Stock Flag defaults off, so the
    // conjunctive composition leaves the surface purchasable:
    // purchase action rendered, no Pre-order state.
    test(`${path} renders the purchase action with every Stock Flag off`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByTestId('purchase-surface')).toBeVisible();
      await expect(page.getByRole('button', { name: copy.cta })).toBeVisible();
      await expect(page.getByTestId('pre-order-state')).toHaveCount(0);
    });
  }

  // The Suggestions Rail's badge gating composes the same way: with no
  // Stock Flag on, the card keeps its `?fit=` purchase link instead of
  // the sold-out badge (desktop viewport — the rail renders at `lg`
  // only).
  test('the Suggestions Rail card keeps its purchase link', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en');
    await expect(
      page.locator('a[href="/en/checkout?fit=nsr-female-m"]')
    ).toBeVisible();
  });
});
