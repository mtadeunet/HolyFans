/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "The landing page of each
 * Locale is composed as a Feed Shell — a three-column layout consisting
 * of a Nav Rail (left), a Feed Surface (center), and a Suggestions Rail
 * (right)", "the Suggestions Rail is the first element to drop below
 * desktop widths, the Nav Rail narrows to an icon strip on medium
 * viewports and collapses to a compact bottom navigation band on small
 * viewports ... while a minimal top band retains brand and language
 * switching", and "Small-viewport bottom chrome is a single consolidated
 * band: the Inbound Contact Surface floats above it and must never
 * occlude navigation or purchase actions."
 *
 * Implements ADR 03-002 - "Any state is ephemeral and client-local —
 * never persisted, never transmitted" (the Decorative Interaction Row's
 * like toggle resets on reload).
 *
 * Implements ADR 03-002 - "on the purchase route, entries that target
 * landing feed units return the shopper to that unit on the landing
 * within the same Locale" (Nav Rail and bottom-band entries resolve to
 * `/{locale}#<anchor>` on `/checkout`), "the collapse is identical on
 * every route the shell composes — the purchase route gets the same
 * bands", and "an available Variant suggestion selects that Variant on
 * the surface" (the Suggestions Rail cards carry `?fit=<variantId>`).
 *
 * Runs in BOTH Playwright projects — the shell's composition is identical
 * under either gate state; only the purchase-route and media-slot
 * navigation tests skip in the gated `storefront` project (`/checkout`
 * 404s and Media Slots render unlinked there per the fail-closed
 * purchase-surface gate, ADR 00-004 / plan M0).
 *
 * Site Config is environment state, not a fixture: a local
 * `.site-config.local.json` may disable the `mobileStickyCta` chrome key
 * (the bottom band) or content sections. Assertions that depend on a
 * toggle report an explicit skip rather than assuming the unit renders.
 * The Inbound Contact Surface likewise fails closed when
 * `NEXT_PUBLIC_WHATSAPP_NUMBER` is unconfigured (ADR 00-009).
 */
import { expect, test, type Page } from '@playwright/test';

const ENABLED_PROJECT = 'purchase-enabled';

/** Every Post Card carries the stable anchor `id="post-<id>"`. */
const postCards = (page: Page) => page.locator('article[id^="post-"]');
/** The left rail is the only `aside` holding a `#feed` brand anchor. */
const navRail = (page: Page) =>
  page.locator('aside').filter({ has: page.locator('a[href="#feed"]') });
/** The Suggestions Rail is the only `aside` carrying a heading. */
const suggestionsRail = (page: Page) =>
  page.locator('aside').filter({ has: page.locator('h2') });
/** The minimal mobile top band is the landing's only sticky header. */
const mobileTopBar = (page: Page) => page.locator('header.sticky');
/** The consolidated bottom navigation band (fixed, viewport-bottom). */
const bottomNavBand = (page: Page) => page.locator('nav.fixed.bottom-0');
/** The floating Inbound Contact Surface (ADR 00-009), when configured. */
const whatsAppBubble = (page: Page) => page.locator('a.fixed[href*="wa.me"]');

test.describe('Feed Shell — Post Cards', () => {
  for (const locale of ['pt', 'en']) {
    // Implements ADR 03-002 - "a vertical scroll of Post Cards — the
    // landing's primary content" in both Locales (ADR 00-005).
    test(`/${locale} renders the Feed Surface with at least three Post Cards`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await expect(postCards(page).first()).toBeVisible();
      expect(await postCards(page).count()).toBeGreaterThanOrEqual(3);
    });
  }

  test('a Post Card carries the brand header, a non-link decorative handle, a Media Slot, and the Decorative Interaction Row', async ({
    page,
  }) => {
    await page.goto('/en');
    const card = postCards(page).first();
    await expect(card).toBeVisible();

    // Card header: brand name and the own-brand decorative handle as
    // plain text — never a link, never a third-party account reference
    // (ADR 03-002, identifier hygiene ADR 00-007).
    await expect(card.locator('header p').first()).toHaveText('HolyFans');
    await expect(card.locator('header p').nth(1)).toHaveText(/^@/);
    expect(await card.locator('header a').count()).toBe(0);

    // Media Slot (linked to checkout only when the purchase surface is
    // enabled — the link itself is asserted in the enabled project).
    await expect(card.locator('div.aspect-square').first()).toBeVisible();

    // Decorative Interaction Row: the like toggle carries `aria-pressed`;
    // comment/bookmark marks are aria-hidden decoration.
    await expect(card.locator('button[aria-pressed]')).toBeVisible();
  });

  // Implements ADR 03-002 - the like affordance is "ephemeral and
  // client-local — never persisted, never transmitted": toggling
  // updates only this mount's state, and a reload restores the
  // authored count.
  test('the Decorative Interaction Row like toggles locally and resets on reload', async ({
    page,
  }) => {
    await page.goto('/en');
    const card = postCards(page).first();
    const likeButton = card.locator('button[aria-pressed]');
    const likeCount = card.locator('button[aria-pressed] + span');

    await expect(likeButton).toHaveAttribute('aria-pressed', 'false');
    const before = Number((await likeCount.textContent())?.match(/\d+/)?.[0]);
    expect(Number.isNaN(before)).toBe(false);

    await likeButton.click();
    await expect(likeButton).toHaveAttribute('aria-pressed', 'true');
    const after = Number((await likeCount.textContent())?.match(/\d+/)?.[0]);
    expect(after).toBe(before + 1);

    // Ephemeral: nothing is persisted — a fresh mount shows the authored
    // count and the un-pressed state again.
    await page.reload();
    const remountedCard = postCards(page).first();
    await expect(remountedCard.locator('button[aria-pressed]')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    const remounted = Number(
      (
        await remountedCard.locator('button[aria-pressed] + span').textContent()
      )?.match(/\d+/)?.[0]
    );
    expect(remounted).toBe(before);
  });
});

test.describe('Feed Shell — navigation entries', () => {
  // Implements ADR 03-002 - Nav Rail entries are "store-purpose only —
  // landing sections, the purchase surface, and the contact channel".
  // On the landing itself the feed-unit entries are same-page `#anchor`
  // links; the home/shop/faq entries are never purchase-gated, so this
  // holds under both flag states.
  test('on the landing the Nav Rail feed entries use same-page #anchors', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en');
    const rail = navRail(page);
    // `#feed` matches both the brand mark and the home entry.
    await expect(rail.locator('a[href="#feed"]').first()).toBeVisible();
    await expect(rail.locator('a[href="#products"]')).toBeVisible();
    await expect(rail.locator('a[href="#post-faq"]')).toBeVisible();
  });
});

test.describe('Feed Shell — responsive collapse', () => {
  // Implements ADR 03-002 - the three-column shell at desktop widths.
  test('at desktop width the Nav Rail and Suggestions Rail flank the Feed Surface', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en');
    await expect(navRail(page)).toBeVisible();
    await expect(suggestionsRail(page)).toBeVisible();
    await expect(postCards(page).first()).toBeVisible();
  });

  // Implements ADR 03-002 - "the Suggestions Rail is the first element
  // to drop below desktop widths, the Nav Rail narrows to an icon strip
  // on medium viewports".
  test('at medium width the Nav Rail stays as an icon strip and the Suggestions Rail drops', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/en');
    await expect(navRail(page)).toBeVisible();
    await expect(suggestionsRail(page)).toBeHidden();
    // Mobile chrome is confined below `md` regardless of toggles.
    await expect(mobileTopBar(page)).toBeHidden();
    await expect(bottomNavBand(page)).toBeHidden();
    await expect(postCards(page).first()).toBeVisible();
  });

  // Implements ADR 03-002 - on small viewports "a minimal top band
  // retains brand and language switching" and "the Feed Surface is the
  // primary column at every width".
  test('on small viewports the minimal top band renders and both rails drop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en');
    await expect(mobileTopBar(page)).toBeVisible();
    await expect(navRail(page)).toBeHidden();
    await expect(suggestionsRail(page)).toBeHidden();
    await expect(postCards(page).first()).toBeVisible();
  });

  // Implements ADR 03-002 - the Nav Rail "collapses to a compact bottom
  // navigation band" governed by the `mobileStickyCta` chrome key. The
  // key is operator-controlled Site Config: when it is off the band is
  // intentionally absent, so an absent band is reported as a skip, not a
  // failure.
  test('the consolidated bottom navigation band pins to the small-viewport bottom', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en');
    const band = bottomNavBand(page);
    test.skip(
      (await band.count()) === 0,
      'mobileStickyCta chrome toggle is off in Site Config — the bottom band is intentionally not rendered'
    );
    await expect(band).toBeVisible();
    expect(await band.count()).toBe(1);
    const box = await band.boundingBox();
    expect(box).not.toBeNull();
    // Pinned to the viewport bottom edge.
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(840);
  });

  // Implements ADR 03-002 - "the Inbound Contact Surface floats above
  // [the bottom band] and must never occlude navigation or purchase
  // actions" (the ADR 00-009 presentation constraint). Both surfaces are
  // configuration-dependent: the band follows `mobileStickyCta`, and the
  // bubble fails closed without `NEXT_PUBLIC_WHATSAPP_NUMBER` — either
  // absence is reported as an explicit skip.
  test('the WhatsApp bubble never occludes the bottom navigation band', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en');
    const band = bottomNavBand(page);
    const bubble = whatsAppBubble(page);
    test.skip(
      (await band.count()) === 0,
      'mobileStickyCta chrome toggle is off in Site Config — no bottom band to occlude'
    );
    test.skip(
      (await bubble.count()) === 0,
      'NEXT_PUBLIC_WHATSAPP_NUMBER unconfigured — the Inbound Contact Surface fails closed (ADR 00-009)'
    );
    const bandBox = await band.boundingBox();
    const bubbleBox = await bubble.boundingBox();
    expect(bandBox).not.toBeNull();
    expect(bubbleBox).not.toBeNull();
    // The bubble's bottom edge must sit at or above the band's top edge.
    expect(bubbleBox!.y + bubbleBox!.height).toBeLessThanOrEqual(
      bandBox!.y + 1
    );
  });
});

test.describe('Feed Shell — purchase path (flag enabled)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== ENABLED_PROJECT,
      'requires PURCHASE_SURFACE_ENABLED=true'
    );
  });

  for (const locale of ['pt', 'en']) {
    // Implements ADR 03-002 - "Every Media Slot is a link to the
    // Simplified Purchase Surface within the same Locale."
    test(`/${locale} media slot navigates to /${locale}/checkout`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await page
        .locator('article[id^="post-"] a[href$="/checkout"]')
        .first()
        .click();
      await page.waitForURL(`**/${locale}/checkout`);
      await expect(page.getByTestId('purchase-surface')).toBeVisible();
    });
  }

  for (const locale of ['pt', 'en']) {
    // Implements ADR 03-002 - "on the purchase route, entries that
    // target landing feed units return the shopper to that unit on the
    // landing within the same Locale": the Nav Rail's feed-unit entries
    // resolve to `/{locale}#<anchor>`; the purchase entry keeps pointing
    // at the same-Locale checkout.
    test(`/${locale}/checkout Nav Rail feed entries return to the landing's feed units`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}/checkout`);
      const rail = navRail(page);
      await expect(rail.locator(`a[href="/${locale}#feed"]`)).toBeVisible();
      await expect(
        rail.locator(`a[href="/${locale}#products"]`)
      ).toBeVisible();
      await expect(
        rail.locator(`a[href="/${locale}#post-faq"]`)
      ).toBeVisible();
      // The brand mark still anchors the shell's own center column.
      await expect(rail.locator('a[href="#feed"]').first()).toBeVisible();
      // The purchase entry resolves to the same-Locale checkout.
      await expect(
        rail.locator(`a[href="/${locale}/checkout"]`).first()
      ).toBeVisible();
    });
  }

  for (const [locale, fitLabel] of [
    ['en', "Women's"],
    ['pt', 'Feminino'],
  ] as const) {
    // Implements ADR 03-002 - "an available Variant suggestion selects
    // that Variant on the surface": the catalog's single fit yields
    // exactly one suggestion card, linking its representative Variant
    // via `/checkout?fit=<variantId>`.
    test(`/${locale} suggestion card navigates to /checkout?fit=nsr-female-m and preselects the Variant`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}`);
      const rail = suggestionsRail(page);
      const card = rail.locator('a[href*="checkout?fit="]');
      // The women's fit is the only fit in Product Data — one card.
      await expect(card).toHaveCount(1);
      await expect(card).toHaveAttribute(
        'href',
        `/${locale}/checkout?fit=nsr-female-m`
      );

      await card.click();
      await page.waitForURL(`**/${locale}/checkout**`);
      expect(new URL(page.url()).searchParams.get('fit')).toBe(
        'nsr-female-m'
      );
      const surface = page.getByTestId('purchase-surface');
      await expect(surface).toBeVisible();
      await expect(surface).toContainText(fitLabel);
    });
  }

  // Implements ADR 03-002 - "the collapse is identical on every route
  // the shell composes — the purchase route gets the same bands": on
  // small viewports `/checkout` shows the minimal top band and drops
  // both rails exactly like the landing.
  test('on small viewports the purchase route renders the same top band and rail collapse', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/checkout');
    await expect(mobileTopBar(page)).toBeVisible();
    await expect(navRail(page)).toBeHidden();
    await expect(suggestionsRail(page)).toBeHidden();
    await expect(page.getByTestId('purchase-surface')).toBeVisible();
  });

  // Implements ADR 03-002 - the consolidated bottom navigation band is
  // "identical on every route the shell composes", still governed by
  // the `mobileStickyCta` chrome key and carrying return-to-feed
  // entries on the purchase route. Explicit skip when the operator
  // toggle is off.
  test('the consolidated bottom navigation band pins to the small-viewport bottom on the purchase route', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/checkout');
    const band = bottomNavBand(page);
    test.skip(
      (await band.count()) === 0,
      'mobileStickyCta chrome toggle is off in Site Config — the bottom band is intentionally not rendered'
    );
    await expect(band).toBeVisible();
    expect(await band.count()).toBe(1);
    // Return-to-feed entries inside the band resolve to /{locale}#anchor.
    await expect(band.locator('a[href="/en#feed"]')).toBeVisible();
    const box = await band.boundingBox();
    expect(box).not.toBeNull();
    // Pinned to the viewport bottom edge.
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(840);
  });

  // Implements ADR 03-002 - the Inbound Contact Surface "floats above
  // [the bottom band] and must never occlude navigation or purchase
  // actions" on the purchase route too (the ADR 00-009 presentation
  // constraint). Same configuration-dependent skips as the landing
  // variant of this check.
  test('the WhatsApp bubble never occludes the bottom navigation band on the purchase route', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/checkout');
    const band = bottomNavBand(page);
    const bubble = whatsAppBubble(page);
    test.skip(
      (await band.count()) === 0,
      'mobileStickyCta chrome toggle is off in Site Config — no bottom band to occlude'
    );
    test.skip(
      (await bubble.count()) === 0,
      'NEXT_PUBLIC_WHATSAPP_NUMBER unconfigured — the Inbound Contact Surface fails closed (ADR 00-009)'
    );
    const bandBox = await band.boundingBox();
    const bubbleBox = await bubble.boundingBox();
    expect(bandBox).not.toBeNull();
    expect(bubbleBox).not.toBeNull();
    // The bubble's bottom edge must sit at or above the band's top edge.
    expect(bubbleBox!.y + bubbleBox!.height).toBeLessThanOrEqual(
      bandBox!.y + 1
    );
  });
});
