/**
 * Implements ADR 00-007: Quality Tooling and CI - "End-to-end tests run
 * against the production-built application and verify the public
 * contracts" (plan M3 checkout smoke).
 *
 * Implements ADR 00-004: Commerce and Checkout - the Cart is re-validated
 * server-side and checkout is refused on divergence ("sold-out item
 * blocked; over-cap quantity rejected").
 *
 * The spec runs in BOTH Playwright projects; each test skips unless its
 * project matches the flag state it exercises:
 * - `storefront` — `PURCHASE_SURFACE_ENABLED` unset: post-checkout pages
 *   must 404 like the checkout page itself (fail-closed gate).
 * - `purchase-enabled` — flag set: the API contract is exercised; the
 *   full Stripe handoff additionally requires `STRIPE_SECRET_KEY` in the
 *   environment (skipped gracefully without it).
 */
import { expect, test } from '@playwright/test';

const ENABLED_PROJECT = 'purchase-enabled';

test.describe('checkout gate (flag unset)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === ENABLED_PROJECT,
      'gate is open in the purchase-enabled project'
    );
  });

  for (const path of [
    '/pt/checkout/success',
    '/en/checkout/success',
    '/pt/checkout/cancel',
    '/en/checkout/cancel',
  ]) {
    test(`${path} renders the not-found response`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    });
  }
});

test.describe('checkout flow (flag enabled)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== ENABLED_PROJECT,
      'requires PURCHASE_SURFACE_ENABLED=true'
    );
  });

  test('sold-out variant is rejected with a cart_drift correction', async ({
    request,
  }) => {
    const response = await request.post('/api/checkout', {
      data: {
        items: [{ variantId: 'nsr-male-m', quantity: 1 }],
        locale: 'en',
        attemptId: `e2e-soldout-${Date.now()}`,
      },
    });
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('cart_drift');
    expect(body.corrections).toEqual([
      { variantId: 'nsr-male-m', reason: 'sold_out' },
    ]);
  });

  test('over-cap quantity is rejected with a clamp correction', async ({
    request,
  }) => {
    const response = await request.post('/api/checkout', {
      data: {
        items: [{ variantId: 'nsr-female-m', quantity: 99 }],
        locale: 'en',
        attemptId: `e2e-overcap-${Date.now()}`,
      },
    });
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('cart_drift');
    expect(body.corrections).toEqual([
      { variantId: 'nsr-female-m', reason: 'over_cap', maxQuantity: 5 },
    ]);
  });

  test('checkout degrades gracefully when Stripe is not configured', async ({
    request,
  }) => {
    test.skip(
      !!process.env.STRIPE_SECRET_KEY,
      'STRIPE_SECRET_KEY is set — Session creation would succeed'
    );
    const response = await request.post('/api/checkout', {
      data: {
        items: [{ variantId: 'nsr-female-m', quantity: 1 }],
        locale: 'en',
        attemptId: `e2e-nokey-${Date.now()}`,
      },
    });
    expect(response.status()).toBe(502);
    const body = await response.json();
    expect(body.error).toBe('checkout_unavailable');
  });

  test('post-checkout pages render without a Stripe key', async ({ page }) => {
    for (const path of ['/en/checkout/success', '/en/checkout/cancel']) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
    }
  });

  test('add to cart → submit → redirect to Stripe Hosted Checkout', async ({
    page,
  }) => {
    test.skip(
      !process.env.STRIPE_SECRET_KEY,
      'requires STRIPE_SECRET_KEY (test mode) in the environment'
    );

    await page.goto('/en');
    await page.getByRole('button', { name: /add to cart/i }).click();
    await page.goto('/en/checkout');
    await page
      .getByRole('button', { name: /continue to secure payment/i })
      .click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    expect(page.url()).toContain('checkout.stripe.com');
  });
});
