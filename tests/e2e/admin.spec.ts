/**
 * Implements ADR 00-007: Quality Tooling and CI - "End-to-end tests run
 * against the production-built application and verify the public
 * contracts."
 *
 * Implements ADR 00-002: Rendering and Hosting Model - "The Admin
 * Console is password-gated at the edge by the Request-Time Middleware
 * and fails closed when no credential is configured", and its
 * "request-time read of the like store's aggregate state — per-post
 * totals, per-post last-like timestamps, and store health — aggregates
 * only, never Like Token membership (ADR 00-008)".
 *
 * Covers the Admin Console's Likes section: the store-health banner
 * (connected / not configured / read failed — surfaced, never silent)
 * and one aggregate card per Post Card carrying its like total and
 * `Last like:` field. The store's provisioning is environment state,
 * not a fixture: assertions that depend on a specific store posture
 * read the banner the page rendered and skip themselves when the
 * environment reports a different one, the same self-skipping
 * convention as the feed spec's live/degraded branches.
 *
 * Runs in the `storefront` project only — the purchase-surface gate is
 * orthogonal to the Admin Console. The authenticated tests need the
 * operator credential, read from `ADMIN_PASSWORD` in the environment
 * or `.env.local` on a developer machine (the same source `next start`
 * loads); when none exists the middleware itself fails closed, the
 * 401 contract still runs, and the authenticated tests report an
 * explicit skip.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEED_POSTS } from '../../lib/feed-posts';

/**
 * Resolve the `/admin` basic-auth credential the way the server does:
 * the process environment first, then `.env.local` (untracked — the
 * value itself never enters this file, per identifier hygiene).
 *
 * @returns The configured password, or `null` when none exists.
 */
function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }
  try {
    const envLocal = readFileSync(
      join(__dirname, '../../.env.local'),
      'utf8'
    );
    const line = envLocal
      .split('\n')
      .find((entry) => entry.startsWith('ADMIN_PASSWORD='));
    const value = line?.slice('ADMIN_PASSWORD='.length).trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

/**
 * Attach the basic-auth credential to every request the page makes —
 * the Request-Time Middleware reads the `authorization` header
 * directly; any username is accepted.
 *
 * @param page - The test page.
 * @param password - The configured operator password.
 */
async function authenticate(page: Page, password: string): Promise<void> {
  await page.setExtraHTTPHeaders({
    authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`,
  });
}

/** The Admin Console's Likes section, identified by its heading. */
const likesSection = (page: Page) =>
  page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Likes', exact: true }),
  });
/** The store-health banner inside the Likes section — `role="status"`
 *  when connected, `role="alert"` when degraded; matched on text so the
 *  assertion holds under either role. */
const storeBanner = (page: Page) =>
  likesSection(page).getByText(/^Like store:/);

test.describe('Admin Console — access control', () => {
  // Implements ADR 00-002 - "The Admin Console is password-gated at
  // the edge by the Request-Time Middleware and fails closed when no
  // credential is configured": an unauthenticated request is refused
  // with a Basic challenge regardless of store or flag state.
  test('/admin answers 401 with a Basic challenge when unauthenticated', async ({
    page,
  }) => {
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(401);
    expect(response?.headers()['www-authenticate']).toContain('Basic');
  });
});

test.describe('Admin Console — Likes section', () => {
  test.beforeEach(async ({ page }) => {
    const password = adminPassword();
    test.skip(
      password === null,
      'ADMIN_PASSWORD unconfigured — the Admin Console fails closed and the authenticated surface cannot be exercised'
    );
    await authenticate(page, password as string);
  });

  // Implements ADR 00-002 - the Admin Console's "request-time read of
  // the like store's aggregate state — per-post totals, per-post
  // last-like timestamps, and store health": the banner is explicit in
  // every posture and every Post Card lists its aggregate, degrading
  // to authored base counts rather than disappearing.
  test('the Likes section renders the store-health banner and one aggregate card per Post Card', async ({
    page,
  }) => {
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(200);

    const section = likesSection(page);
    await expect(section).toBeVisible();

    // The store-health banner is surfaced in every posture — never
    // silent.
    const banner = storeBanner(page);
    await expect(banner).toBeVisible();
    const bannerText = (await banner.textContent()) ?? '';
    expect(bannerText).toMatch(
      /^Like store: (connected|not configured|read failed)/
    );
    const degraded = !bannerText.startsWith('Like store: connected');

    // One aggregate card per authored Post Card, in feed order.
    const cards = section.locator('li');
    await expect(cards).toHaveCount(FEED_POSTS.length);
    for (const [index, post] of FEED_POSTS.entries()) {
      const card = cards.nth(index);
      await expect(card.locator('code')).toHaveText(post.id);
      // Degraded postures fall back to the authored base count; a
      // connected store reports the live total (base + delta).
      await expect(
        card.getByText(degraded ? `${post.likes} likes` : /\d+ likes/, {
          exact: true,
        })
      ).toBeVisible();
      // The last-like field renders on every card — `—` when no like
      // event is on record, a `dd Mon yyyy, HH:mm UTC` timestamp
      // otherwise.
      await expect(
        card.getByText(/^Last like: (—|\d{1,2} \w{3} \d{4}, \d{2}:\d{2} UTC)$/)
      ).toBeVisible();
    }

    // Aggregates only (ADR 00-008): no Like Token — a UUID-shaped
    // per-visitor identifier — may ever reach this surface.
    const sectionText = (await section.textContent()) ?? '';
    expect(sectionText).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
  });

  // Implements ADR 00-002 - "When the store is unconfigured or
  // unreachable ... the Admin Console surfaces the store's health":
  // the unconfigured posture shows the alert banner, authored base
  // counts, and empty last-like fields. Skips itself where a store is
  // provisioned, like the feed spec's live/degraded branches.
  test('an unconfigured like store shows authored base counts and empty last-like fields', async ({
    page,
  }) => {
    await page.goto('/admin');
    const banner = storeBanner(page);
    await expect(banner).toBeVisible();
    const bannerText = (await banner.textContent()) ?? '';
    test.skip(
      !bannerText.startsWith('Like store: not configured'),
      'like store reachable — the unconfigured degradation does not apply'
    );

    const cards = likesSection(page).locator('li');
    await expect(cards).toHaveCount(FEED_POSTS.length);
    for (const [index, post] of FEED_POSTS.entries()) {
      const card = cards.nth(index);
      await expect(
        card.getByText(`${post.likes} likes`, { exact: true })
      ).toBeVisible();
      await expect(
        card.getByText('Last like: —', { exact: true })
      ).toBeVisible();
    }
  });

  // Implements ADR 03-002 - the per-post last-like record marks "the
  // last like event, never rewound": when the store is connected each
  // card shows either `—` (no like event yet) or a well-formed UTC
  // timestamp — never raw data, never a Like Token.
  test('a connected like store shows live totals and well-formed last-like timestamps', async ({
    page,
  }) => {
    await page.goto('/admin');
    const banner = storeBanner(page);
    await expect(banner).toBeVisible();
    const bannerText = (await banner.textContent()) ?? '';
    test.skip(
      !bannerText.startsWith('Like store: connected'),
      'like store unconfigured or failing — the connected posture does not apply'
    );

    const cards = likesSection(page).locator('li');
    await expect(cards).toHaveCount(FEED_POSTS.length);
    for (const index of FEED_POSTS.keys()) {
      const card = cards.nth(index);
      await expect(
        card.getByText(/^Last like: (—|\d{1,2} \w{3} \d{4}, \d{2}:\d{2} UTC)$/)
      ).toBeVisible();
    }
  });
});
