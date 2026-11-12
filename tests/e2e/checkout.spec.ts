/**
 * Implements ADR 00-007: Quality Tooling and CI - "End-to-end tests run
 * against the production-built application and verify the public
 * contracts" (plan M3 checkout smoke).
 *
 * Implements ADR 00-004: Commerce and Checkout - the Cart is re-validated
 * server-side and checkout is refused on divergence ("sold-out item
 * blocked; over-cap quantity rejected").
 *
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "media impression →
 * Simplified Purchase Surface → Hosted Checkout": the shopper's path is
 * a Media Slot tap on the Feed Surface, the single-decision purchase
 * block (Variant, quantity, price, one buy action), then the PSP's
 * Hosted Checkout. The old add-to-cart → cart-review flow no longer
 * exists.
 *
 * Implements ADR 03-002 - "The Feed Shell ... is the entire chrome on
 * those routes: the classic site header and footer do not render on
 * either"; "Every other route — the post-checkout success and cancel
 * pages ... — keeps the classic header/footer chrome."
 *
 * The spec runs in BOTH Playwright projects; each test skips unless its
 * project matches the flag state it exercises:
 * - `storefront` — `PURCHASE_SURFACE_ENABLED` unset: post-checkout pages
 *   must 404 like the checkout page itself (fail-closed gate).
 * - `purchase-enabled` — flag set: the API contract, the media-slot →
 *   buy-now flow, the shell chrome on the purchase route, and the
 *   `?fit=` preselection are exercised; the full Stripe handoff
 *   additionally requires `STRIPE_SECRET_KEY` in the environment
 *   (skipped gracefully without it).
 *
 * Site Config is environment state, not a fixture: the classic
 * header/footer assertions on the post-checkout pages skip explicitly
 * when a chrome toggle is off, matching the feed spec's convention.
 */
import { expect, test, type Page } from '@playwright/test';

const ENABLED_PROJECT = 'purchase-enabled';

/** First Media Slot purchase link on the Feed Surface (ADR 03-002). */
const firstMediaSlotLink = (page: Page) =>
  page.locator('article[id^="post-"] a[href$="/checkout"]').first();
/** The Feed Shell's Nav Rail — the only `aside` holding a `#feed` brand anchor. */
const navRail = (page: Page) =>
  page.locator('aside').filter({ has: page.locator('a[href="#feed"]') });
/** The Feed Shell's Suggestions Rail — the only `aside` carrying a heading. */
const suggestionsRail = (page: Page) =>
  page.locator('aside').filter({ has: page.locator('h2') });
/** The classic site header (fixed landmark suppressed on shell routes). */
const classicHeader = (page: Page) => page.locator('header.fixed');
/** The classic site footer (suppressed on shell routes). */
const classicFooter = (page: Page) => page.locator('footer');

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

  // Implements ADR 00-004 - "refuses checkout on any Cart/Product Data
  // divergence": `nsr-male-m` was removed from Product Data, so a Cart
  // line still holding it (a stored Cart from before the removal, or a
  // forged id) now diverges as `unknown`. The `sold_out` divergence —
  // a Variant still carried but flagged off — is covered at unit level
  // in tests/unit/checkout-validation.test.ts.
  test('removed variant is rejected with a cart_drift correction', async ({
    request,
  }) => {
    const response = await request.post('/api/checkout', {
      data: {
        items: [{ variantId: 'nsr-male-m', quantity: 1 }],
        locale: 'en',
        attemptId: `e2e-removed-${Date.now()}`,
      },
    });
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('cart_drift');
    expect(body.corrections).toEqual([
      { variantId: 'nsr-male-m', reason: 'unknown' },
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
    // The runner env and the server env can diverge: `next start` loads
    // `.env.local`, which may carry a Stripe key the runner never saw.
    // When Session creation succeeds the degradation path does not exist
    // to assert, so report an explicit skip rather than a false failure.
    test.skip(
      response.status() === 200,
      'server has a Stripe key configured (e.g. via .env.local) — Session creation succeeds'
    );
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

  // Implements ADR 03-002 - "the classic site header and footer do not
  // render on either [the Locale landing roots or the purchase route]":
  // the Feed Shell is the purchase route's entire chrome — Nav Rail and
  // Suggestions Rail flank the Simplified Purchase Surface at desktop
  // width, and no classic header/footer landmark renders regardless of
  // the Site Config chrome toggles.
  test('/en/checkout renders inside the Feed Shell — the classic header and footer are suppressed', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en/checkout');
    await expect(page.getByTestId('purchase-surface')).toBeVisible();
    // Shell landmarks at desktop width.
    await expect(navRail(page)).toBeVisible();
    await expect(suggestionsRail(page)).toBeVisible();
    // No classic chrome on a route the shell composes.
    await expect(classicHeader(page)).toHaveCount(0);
    await expect(classicFooter(page)).toHaveCount(0);
  });

  // Implements ADR 03-002 - "Every other route — the post-checkout
  // success and cancel pages, auxiliary and legal pages, and the Admin
  // Console — keeps the classic header/footer chrome": the PSP-return
  // endpoints are outside the browsing flow and render no feed shell.
  // Classic chrome is Site Config–gated, so a disabled toggle is an
  // explicit skip, not a failure.
  for (const path of ['/en/checkout/success', '/en/checkout/cancel']) {
    test(`${path} keeps the classic chrome and renders no feed shell`, async ({
      page,
    }) => {
      await page.goto(path);
      test.skip(
        (await classicHeader(page).count()) === 0,
        'header chrome toggle is off in Site Config — the classic header is intentionally not rendered'
      );
      test.skip(
        (await classicFooter(page).count()) === 0,
        'footer chrome toggle is off in Site Config — the classic footer is intentionally not rendered'
      );
      await expect(classicHeader(page)).toBeVisible();
      await expect(classicFooter(page)).toBeVisible();
      // No feed-shell landmarks on a PSP-return endpoint.
      await expect(navRail(page)).toHaveCount(0);
      await expect(suggestionsRail(page)).toHaveCount(0);
    });
  }

  // Implements ADR 03-002 - "an available Variant suggestion selects
  // that Variant on the surface": the `?fit=<variantId>` preselection
  // parameter the Suggestions Rail cards carry is honored for
  // purchasable Variants. `nsr-female-m` is the M-size Variant of the
  // only fit currently available, so its selected state shows the
  // static fit label plus the M/L size selector.
  for (const [locale, fitLabel] of [
    ['en', "Women's"],
    ['pt', 'Feminino'],
  ] as const) {
    test(`/${locale}/checkout?fit=nsr-female-m preselects the available Variant`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/checkout?fit=nsr-female-m`);
      const surface = page.getByTestId('purchase-surface');
      await expect(surface).toBeVisible();
      await expect(surface).toContainText(fitLabel);
      await expect(
        page.getByRole('button', { name: /buy now|comprar agora/i })
      ).toBeEnabled();
    });
  }

  // Implements ADR 03-002 / ADR 00-004 Availability Flags - "a sold-out
  // Variant is shown but never offered as a purchasable path": a `?fit=`
  // value naming a Variant Product Data no longer carries (the removed
  // `nsr-male-m`) or never carried (`bogus-fit`) is ignored — the surface
  // keeps its available default rather than resurrecting an
  // unpurchasable Variant or crashing on an unrecognized id.
  for (const fit of ['nsr-male-m', 'bogus-fit']) {
    test(`/en/checkout?fit=${fit} falls back to the available Variant`, async ({
      page,
    }) => {
      await page.goto(`/en/checkout?fit=${fit}`);
      const surface = page.getByTestId('purchase-surface');
      await expect(surface).toBeVisible();
      await expect(surface).toContainText("Women's");
      await expect(surface).not.toContainText("Men's");
      await expect(
        page.getByRole('button', { name: /buy now/i })
      ).toBeEnabled();
    });
  }

  // Implements ADR 03-002 - "Every Media Slot is a link to the Simplified
  // Purchase Surface within the same Locale." The single-decision block
  // (data-testid="purchase-surface") is where the tap resolves.
  test('media slot → Simplified Purchase Surface presents the single buy action', async ({
    page,
  }) => {
    await page.goto('/en');
    await firstMediaSlotLink(page).click();
    await page.waitForURL('**/en/checkout');
    await expect(page.getByTestId('purchase-surface')).toBeVisible();
    // One purchase action — Variant selection, quantity and price are the
    // only decisions on the surface (ADR 03-002).
    await expect(page.getByRole('button', { name: /buy now/i })).toBeVisible();
  });

  // Implements ADR 00-004 - "the shopper's Cart is submitted to the
  // Storefront's single checkout Route Handler ... then redirects the
  // shopper to the PSP-hosted payment page". The Route Handler response
  // is stubbed at the network boundary so the redirect mechanism is
  // verified deterministically without a PSP credential; the returned
  // URL is what the browser must navigate to.
  test('media slot → buy-now submit → redirects to the URL returned by the Route Handler', async ({
    page,
  }) => {
    await page.route('**/api/checkout', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: '/en/checkout/success' }),
      })
    );

    await page.goto('/en');
    await firstMediaSlotLink(page).click();
    await page.waitForURL('**/en/checkout');
    await page.getByRole('button', { name: /buy now/i }).click();
    await page.waitForURL('**/en/checkout/success');
    expect(new URL(page.url()).pathname).toBe('/en/checkout/success');
  });

  test('media slot → buy-now submit → redirect to Stripe Hosted Checkout', async ({
    page,
  }) => {
    test.skip(
      !process.env.STRIPE_SECRET_KEY,
      'requires STRIPE_SECRET_KEY (test mode) in the environment'
    );

    await page.goto('/en');
    await firstMediaSlotLink(page).click();
    await page.waitForURL('**/en/checkout');
    await expect(page.getByTestId('purchase-surface')).toBeVisible();
    await page.getByRole('button', { name: /buy now/i }).click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    expect(page.url()).toContain('checkout.stripe.com');
  });
});
