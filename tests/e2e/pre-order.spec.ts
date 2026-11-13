/**
 * Implements ADR 00-007: Quality Tooling and CI - "End-to-end tests run
 * against the production-built application and verify the public
 * contracts."
 *
 * Implements ADR 00-010: Pre-order and Stock Notification — "When the
 * visitor's selected Variant is not purchasable, the Simplified
 * Purchase Surface keeps rendering in place: a localized sold-out
 * message, and the purchase action replaced by a notify-me control
 * that asks for the visitor's email." and "when the managed store is
 * unconfigured or unreachable it answers a graceful 'unavailable'
 * state and never reports a success it did not persist."
 *
 * Covers the Stock-Flag-forced Pre-order state in both Locales: under
 * the flagged-M fixture the surface's default selection lands on the
 * fit's first purchasable Variant (the unflagged sibling), while the
 * flagged Variant stays selectable and resolves the localized
 * sold-out message plus the consented email capture on explicit
 * selection or `?fit=` scoping (consent statement rendered at the
 * capture point, the purchase action absent). The capture submit
 * resolves to either the in-page confirmation (store provisioned) or
 * the graceful unavailable alert (store unconfigured/failing); both
 * are honest, so the spec asserts one of the two explicit states like
 * the likes spec's live/degraded branches. Also covers the Suggestions
 * Rail's fit-level rule — the card links the fit's first purchasable
 * Variant rather than badging the whole fit — and the endpoint's
 * hardening contract: malformed bodies are rejected and captures
 * against a real Variant succeed or answer unavailable — never a fake
 * success.
 *
 * Runs only in the `pre-order` project, whose `next start` server is
 * launched with `PURCHASE_SURFACE_ENABLED=true` and
 * `SITE_CONFIG_LOCAL_PATH` pointing at the out-of-stock fixture — the
 * default Variant's Stock Flag is on while its sibling's stays off
 * (per-Variant granularity), a request-time Site Config read isolated
 * from the other servers' postures. The flag-off counterpart (every
 * Stock Flag off leaves the surface fully purchasable) is covered by
 * `stock-scope.spec.ts` in the `purchase-enabled` project.
 */
import { expect, test } from '@playwright/test';

const PRE_ORDER_COPY: Record<
  string,
  { title: string; cta: string; email: string; badge: string }
> = {
  '/pt/checkout': {
    title: 'Esgotado',
    cta: 'Avise-me quando estiver disponível',
    email: 'shopper@example.com',
    badge: 'Esgotado',
  },
  '/en/checkout': {
    title: 'Out of stock',
    cta: "Notify me when it's back",
    email: 'shopper@example.com',
    badge: 'Sold out',
  },
};

test.describe('Pre-order state (Stock Flag on)', () => {
  for (const [path, copy] of Object.entries(PRE_ORDER_COPY)) {
    // Implements ADR 00-010 - "Fit-level surfaces present the fit's
    // first purchasable Variant": the default selection lands on the
    // unflagged sibling — the purchase action, no Pre-order state —
    // and explicitly selecting the flagged Variant resolves its
    // capture instead.
    test(`${path} defaults to the first purchasable Variant and resolves the flagged one into the Pre-order state on selection`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByTestId('purchase-surface')).toBeVisible();
      // The flagged Variant is not the default: the unflagged sibling
      // is selected and the buy action renders.
      await expect(
        page.getByRole('button', { name: /Comprar Agora|Buy Now/ })
      ).toBeVisible();
      await expect(page.getByTestId('pre-order-state')).toHaveCount(0);
      // Explicit scoping: "Non-purchasable Variants remain visible and
      // selectable so the visitor can scope the capture to the
      // specific Variant they want restocked" — the flagged option
      // carries its sold-out badge and selecting it presents the
      // capture, never the buy action.
      await page
        .getByRole('button', { name: new RegExp(`M ${copy.badge}`) })
        .click();
      await expect(page.getByTestId('pre-order-state')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: copy.title })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: copy.cta })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Comprar Agora|Buy Now/ })
      ).toHaveCount(0);
    });

    // Implements ADR 00-010 - "the `?fit=<variantId>` preselection
    // parameter ... naming a non-purchasable Variant select[s] it and
    // present[s] its Pre-order state": explicit scoping resolves the
    // flagged Variant's capture directly.
    test(`${path}?fit=nsr-female-m scopes the flagged Variant's Pre-order state directly`, async ({
      page,
    }) => {
      await page.goto(`${path}?fit=nsr-female-m`);
      await expect(page.getByTestId('purchase-surface')).toBeVisible();
      await expect(page.getByTestId('pre-order-state')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: copy.title })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: copy.cta })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Comprar Agora|Buy Now/ })
      ).toHaveCount(0);
    });

    // Implements ADR 00-010 - "a Stock Flag **per Variant** in Site
    // Config ... forces that Variant into the Pre-order state while
    // sibling Variants stay purchasable": selecting the flagged size
    // presents the capture, and switching back to the unflagged
    // sibling restores the purchase action — per-Variant independence
    // on the same surface.
    test(`${path} keeps the unflagged sibling Variant purchasable`, async ({
      page,
    }) => {
      await page.goto(path);
      // The flagged option stays visible and selectable with its
      // sold-out badge.
      await expect(
        page.getByRole('button', { name: new RegExp(`M ${copy.badge}`) })
      ).toBeVisible();
      await page
        .getByRole('button', { name: new RegExp(`M ${copy.badge}`) })
        .click();
      await expect(page.getByTestId('pre-order-state')).toBeVisible();
      await page.getByRole('button', { name: 'L', exact: true }).click();
      await expect(page.getByTestId('pre-order-state')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /Comprar Agora|Buy Now/ })
      ).toBeVisible();
    });

    // Implements ADR 00-010 - "Submitting stores the email and shows
    // an in-page confirmation" or, when the managed store is
    // unconfigured/unreachable, "answers a graceful 'unavailable'
    // state" — either the confirmation or the alert must appear. The
    // capture is still reachable for the flagged Variant: selecting
    // it scopes the capture before submitting.
    test(`${path} submits the consented capture to an explicit outcome`, async ({
      page,
    }) => {
      await page.goto(path);
      await page
        .getByRole('button', { name: new RegExp(`M ${copy.badge}`) })
        .click();
      await page.getByRole('textbox', { name: /email/i }).fill(copy.email);
      await page.getByRole('button', { name: copy.cta }).click();
      await expect(
        page.getByRole('status').or(page.getByRole('alert')).first()
      ).toBeVisible();
    });
  }

  // Implements ADR 00-010 - "Fit-level surfaces present the fit's
  // first purchasable Variant" and "a fit's card surfaces the sold-out
  // badge only ... when no Variant of the fit is purchasable": under
  // the flagged-M fixture the card keeps linking the unflagged
  // sibling rather than badging the whole fit sold-out (desktop
  // viewport — the rail renders at `lg` only).
  for (const locale of ['pt', 'en']) {
    test(`/${locale} Suggestions Rail card links the fit's first purchasable Variant under a flagged sibling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}`);
      const rail = page.locator('aside').filter({ has: page.locator('h2') });
      await expect(
        rail.locator(`a[href="/${locale}/checkout?fit=nsr-female-l"]`)
      ).toBeVisible();
      // The flagged Variant is never offered as a purchasable path,
      // and the card badges sold-out only on a whole-fit sold-out —
      // not under a single flagged sibling.
      await expect(rail.locator('a[href*="nsr-female-m"]')).toHaveCount(0);
      await expect(rail.getByText(/Coming Soon|Em Breve/)).toHaveCount(0);
    });
  }

  // Implements ADR 00-010 - "input caps on body size and field
  // lengths, strict validation": malformed bodies are refused, a
  // well-formed capture against a real Variant is persisted (200) or
  // gracefully unavailable when no store is configured (503) — never
  // a fake success.
  test('the stock-notification endpoint validates and answers explicitly', async ({
    request,
  }) => {
    const bad = await request.post('/api/stock-notification', {
      data: { email: 'not-an-email', locale: 'pt', variantId: 'nsr-female-m' },
    });
    // The in-memory per-IP rate limit (10 captures/min) is checked
    // before body validation; a reused dev server may already have
    // spent this window on an earlier run, making the validation
    // contract unobservable. The throttle is itself an explicit
    // answer, so the test skips rather than fake an assertion.
    test.skip(
      bad.status() === 429,
      'rate-limit window already spent on this server'
    );
    expect(bad.status()).toBe(400);

    const unknownVariant = await request.post('/api/stock-notification', {
      data: {
        email: 'shopper@example.com',
        locale: 'pt',
        variantId: 'not-a-variant',
      },
    });
    expect(unknownVariant.status()).toBe(400);

    const ok = await request.post('/api/stock-notification', {
      data: {
        email: 'shopper@example.com',
        locale: 'pt',
        variantId: 'nsr-female-m',
      },
    });
    expect([200, 429, 503]).toContain(ok.status());
    if (ok.status() === 200) {
      expect(await ok.json()).toEqual({ ok: true });
      // Dedup is natural: a repeat submission of the same email for
      // the same Variant succeeds again — or the window is spent
      // mid-test and the throttle answers 429 instead.
      const again = await request.post('/api/stock-notification', {
        data: {
          email: 'shopper@example.com',
          locale: 'pt',
          variantId: 'nsr-female-m',
        },
      });
      expect([200, 429]).toContain(again.status());
    } else if (ok.status() === 503) {
      expect(await ok.json()).toEqual({
        error: 'stock_notification_unavailable',
      });
    }
  });
});
