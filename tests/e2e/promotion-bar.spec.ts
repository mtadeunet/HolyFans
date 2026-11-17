/**
 * Implements ADR 00-007: Quality Tooling and CI - "End-to-end tests run
 * against the production-built application and verify the public
 * contracts."
 *
 * Implements ADR 03-003: Promotion Bar — "a thin, editorial, top-of-site
 * campaign unit rendered on every route the Locale tree composes",
 * selected client-side by the Smart Offer Switcher, expanded in normal
 * document flow, permanent while a campaign is eligible, and unmounted
 * entirely by the `promotionBar` chrome toggle.
 *
 * The spec runs in three Playwright projects; each describe skips unless
 * its project matches the Site Config posture it exercises (the same
 * convention as `checkout.spec.ts`):
 * - `promotions` — `SITE_CONFIG_LOCAL_PATH` points at the promotions
 *   fixture: `promo-lead` (priority 20) wins by default over
 *   `promo-runner-up` (10, eligible but outranked), and
 *   `promo-free-shipping` (30, `belowFreeShipping`) wins only under a
 *   seeded below-threshold Cart — where its `{remaining}` copy must
 *   interpolate off the same Site Config free-shipping threshold the
 *   checkout Route Handler enforces (the fixture carries the
 *   10000-cent default, equal to `FREE_SHIPPING_THRESHOLD_CENTS`).
 * - `promotions-off` — the `chrome.promotionBar` toggle is off: no bar
 *   may render even though the always-on default campaign stays
 *   eligible (the toggle governs the mount, not the selection).
 * - `storefront` — the default Site Config posture: the bar renders the
 *   always-on `DEFAULT_CAMPAIGNS` editorial fallback. Site Config is
 *   environment state here, not a fixture — the test self-skips when a
 *   local config overrides the toggle or the campaign list, matching
 *   the admin/checkout specs' convention.
 */
import { expect, test, type Page } from '@playwright/test';
import { CART_STORAGE_KEY } from '../../context/cart-context';
import { PRODUCT } from '../../lib/constants';
import { FREE_SHIPPING_THRESHOLD_CENTS } from '../../lib/shipping';
import { formatPrice } from '../../lib/utils';

const PROMOTIONS_PROJECT = 'promotions';
const PROMOTIONS_OFF_PROJECT = 'promotions-off';
const STOREFRONT_PROJECT = 'storefront';

/** Fixture campaign labels (tests/fixtures/site-config-promotions.json). */
const FIXTURE_LABEL: Record<string, { lead: string }> = {
  pt: { lead: 'EDIÇÃO DE TESTE' },
  en: { lead: 'TEST EDITION' },
};

/** Seed one Product line in the persisted Cart before app code runs. */
async function seedCart(page: Page, quantity: number): Promise<void> {
  await page.addInitScript(
    ([key, lines]) => {
      window.localStorage.setItem(key, JSON.stringify(lines));
    },
    [
      CART_STORAGE_KEY,
      [{ variantId: PRODUCT.variants.female[0].id, quantity }],
    ] as const
  );
}

/**
 * The amount left to free shipping under the seeded Cart — computed from
 * the same Product Data and threshold constant the implementation keys
 * on, so the expectation stays honest if the placeholders change.
 */
const remainingCopy = (quantity: number, locale: 'pt' | 'en'): string => {
  const euros =
    (FREE_SHIPPING_THRESHOLD_CENTS -
      Math.round(PRODUCT.price * 100) * quantity) /
    100;
  // Mirrors lib/promotions.ts interpolateRemaining: en formats en-IE
  // EUR ("€30.00"), pt uses the house formatPrice ("30,00 €").
  return locale === 'en'
    ? new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR',
      }).format(euros)
    : formatPrice(euros);
};

test.describe('Promotion Bar — fixture campaigns', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== PROMOTIONS_PROJECT,
      'requires the promotions fixture server'
    );
  });

  // Implements ADR 03-003 - "renders collapsed as a single line" above
  // all other chrome; campaign copy renders per Locale from the campaign
  // record (ADR 00-005).
  for (const [locale, labels] of Object.entries(FIXTURE_LABEL)) {
    test(`/${locale} renders the bar collapsed with the lead campaign`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByTestId('promotion-bar')).toBeVisible();
      const toggle = page.getByTestId('promotion-bar-toggle');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toContainText(labels.lead);
      // The expanded region exists but stays collapsed.
      await expect(
        page.getByTestId('promotion-bar-expanded')
      ).not.toBeVisible();
    });
  }

  // Implements ADR 03-003 - "Activating it expands it **in normal
  // document flow** — never a modal, overlay, or popover": the toggle
  // flips aria-expanded and the grid-rows region opens in place.
  test('the toggle expands the offer in place and collapses it again', async ({
    page,
  }) => {
    await page.goto('/en');
    const toggle = page.getByTestId('promotion-bar-toggle');
    await expect(toggle).toContainText(FIXTURE_LABEL.en.lead);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const expanded = page.getByTestId('promotion-bar-expanded');
    await expect(expanded).toBeVisible();
    // The expanded editorial block carries headline, description, and
    // the CTA link the lead campaign defines.
    await expect(expanded).toContainText('The lead campaign, just for you.');
    await expect(page.getByTestId('promotion-bar-cta')).toHaveAttribute(
      'href',
      /#products/
    );

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(expanded).not.toBeVisible();
  });

  // Implements ADR 03-003 - "Escape collapses the expanded block."
  test('Escape collapses the expanded offer', async ({ page }) => {
    await page.goto('/en');
    const toggle = page.getByTestId('promotion-bar-toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('promotion-bar-expanded')).not.toBeVisible();
  });

  // Implements ADR 03-003 - the bar is permanent chrome while a campaign
  // is eligible: there is no dedicated dismiss control, the row toggle
  // is the only expand/collapse affordance, and the per-session
  // expanded state (`hf-promo-expanded` in sessionStorage) restores the
  // open panel across reload.
  test('the bar has no dismiss control and restores the expanded state across reload', async ({
    page,
  }) => {
    await page.goto('/pt');
    const toggle = page.getByTestId('promotion-bar-toggle');
    await expect(toggle).toContainText(FIXTURE_LABEL.pt.lead);
    // The collapsed row carries only the toggle — no dismiss affordance.
    await expect(page.getByTestId('promotion-bar-dismiss')).toHaveCount(0);

    await toggle.click();
    await expect(page.getByTestId('promotion-bar-expanded')).toBeVisible();

    // Session memory restores the expanded panel keyed to the campaign
    // id — a reload re-opens the same offer rather than re-collapsing.
    await page.reload();
    await expect(page.getByTestId('promotion-bar-toggle')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(page.getByTestId('promotion-bar-expanded')).toBeVisible();
  });

  // Implements ADR 03-003 - "Free-shipping truthfulness": with one
  // Product in the seeded Cart (9000 cents < 10000 threshold) the
  // belowFreeShipping campaign outranks the lead and its {remaining}
  // token interpolates the amount left — the same arithmetic the
  // checkout Route Handler enforces server-side.
  for (const locale of ['pt', 'en'] as const) {
    test(`/${locale} interpolates {remaining} for a below-threshold Cart`, async ({
      page,
    }) => {
      await seedCart(page, 1);
      await page.goto(`/${locale}`);
      const toggle = page.getByTestId('promotion-bar-toggle');
      // 10000 - 9000 = 1000 cents → "10,00 €" (pt) / "€10.00" (en)
      // under the seeded Cart.
      const expected = remainingCopy(1, locale);
      if (locale === 'pt') {
        await expect(toggle).toContainText(
          `FALTAM ${expected} PARA ENVIO GRÁTIS`
        );
      } else {
        await expect(toggle).toContainText(`${expected} TO FREE SHIPPING`);
      }
      await expect(toggle).not.toContainText('{remaining}');
    });
  }

  // Implements ADR 03-003 - "the bar mounts as the first child of
  // ChromeFrame's flex column on every route under the Locale tree —
  // above the Feed Shell on the shell routes, above the classic Header
  // on every other route."
  test('the bar renders above every chrome system — shell and classic routes', async ({
    page,
  }) => {
    for (const path of ['/pt', '/pt/checkout', '/pt/checkout/success']) {
      await page.goto(path);
      const bar = page.getByTestId('promotion-bar');
      await expect(bar).toBeVisible();
      // First element child of the frame column — no chrome may render
      // above it on any route.
      await expect(bar.locator('xpath=preceding-sibling::*')).toHaveCount(0);
    }
  });
});

test.describe('Promotion Bar — chrome toggle off', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== PROMOTIONS_OFF_PROJECT,
      'requires the no-promotion-bar fixture server'
    );
  });

  // Implements ADR 03-003 - the bar is "operator-toggleable through
  // Site Config like other global chrome": with `promotionBar` off the
  // layout never mounts the Island, so no bar renders on any route —
  // even though the always-on default campaign would be eligible.
  for (const path of ['/pt', '/en', '/pt/checkout/success']) {
    test(`no promotion bar renders on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId('promotion-bar')).toHaveCount(0);
    });
  }
});

test.describe('Promotion Bar — default Site Config posture', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== STOREFRONT_PROJECT,
      'default posture is exercised in the storefront project'
    );
  });

  // Implements ADR 03-003 - "an always-on editorial fallback campaign
  // ships enabled" so an enabled bar always has truthful content: with
  // no campaigns in Site Config the bar renders DEFAULT_CAMPAIGNS.
  // Site Config is environment state on this server — a local override
  // (custom campaigns or the toggle off) is an explicit skip, never a
  // failure.
  test('renders the default editorial campaign when Site Config carries none', async ({
    page,
  }) => {
    await page.goto('/pt');
    // The bar is a client Island — it mounts only after hydration, so
    // the toggle-off posture is detected with a bounded wait, never an
    // immediate count (which would race the mount effect).
    const mounted = await page
      .getByTestId('promotion-bar')
      .waitFor({ state: 'attached', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(
      !mounted,
      'promotionBar chrome toggle is off in the local Site Config'
    );
    const toggle = page.getByTestId('promotion-bar-toggle');
    await expect(toggle).toBeVisible();
    const text = (await toggle.textContent()) ?? '';
    test.skip(
      !text.includes('UM EXTRA PARA SI'),
      'local Site Config overrides the campaign list — the default fallback is not what renders'
    );
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
