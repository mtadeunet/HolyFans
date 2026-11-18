/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior — ... Site Config normalization and fallback."
 *
 * Implements ADR 03-003: Promotion Bar — the Promotion Campaign schema's
 * normalization posture (malformed entries drop out, garbage input never
 * throws), the Smart Offer Switcher's ordered eligibility pipeline
 * (enabled → schedule → surface → visitor → Cart conditions failing
 * closed → the `/checkout` CTA gate → priority), surface
 * classification in parity with ChromeFrame's SHELL_ROUTES, `{remaining}`
 * interpolation, and the on-device persistence keys (`hf-visited` in
 * localStorage, `hf-promo-expanded` / `hf-promo-displayed` in
 * sessionStorage) whose guarded access must degrade to defaults, never
 * crash.
 *
 * Also covers the strict Admin Console write path — `saveSiteConfig`
 * rejects non-JSON, non-array, and partially-invalid campaign documents
 * before persisting (fail-loud for the operator, fail-safe for the
 * visitor) — and the checkout Route Handler's complimentary-shipping
 * swap at the Site Config free-shipping threshold, the server-side
 * enforcement the bar's `{remaining}` promise keys on.
 */
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveSiteConfig } from '@/app/admin/actions';
import { POST as checkoutPost } from '@/app/api/checkout/route';
import {
  interpolateRemaining,
  isVisitorNew,
  markDisplayed,
  markVisited,
  normalizeCampaigns,
  PROMO_EXPANDED_KEY,
  PROMO_VISITED_KEY,
  readDisplayedIds,
  readExpandedId,
  selectCampaign,
  surfaceForPathname,
  writeExpandedId,
  type PromotionCampaign,
  type PromotionContext,
} from '@/lib/promotions';
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  SHIPPING_OPTIONS,
} from '@/lib/shipping';
import { DEFAULT_SITE_CONFIG } from '@/lib/site-config';
import { formatPrice } from '@/lib/utils';

/**
 * Mocks are confined to true external boundaries: the Site Config
 * persistence write (Edge Config REST / local file), the Next.js
 * cache-invalidation primitive, and the PSP client factory. No unit
 * under test is mocked.
 */
const { writeSiteConfigMock, sessionCreate, getSiteConfigMock } = vi.hoisted(
  () => ({
    writeSiteConfigMock: vi.fn(),
    sessionCreate: vi.fn(),
    getSiteConfigMock: vi.fn(),
  })
);

vi.mock('@/lib/edge-config-write', () => ({
  writeSiteConfig: writeSiteConfigMock,
}));

vi.mock('@/lib/site-config-server', () => ({
  getSiteConfig: getSiteConfigMock,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/stripe', () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: sessionCreate } },
  }),
}));

const PT_COPY = {
  label: 'RÓTULO',
  headline: 'Título',
  description: '',
  ctaLabel: '',
};
const EN_COPY = {
  label: 'LABEL',
  headline: 'Headline',
  description: '',
  ctaLabel: '',
};

/** One well-formed raw campaign entry, pre-normalization. */
const rawCampaign = (): Record<string, unknown> => ({
  id: 'promo-raw',
  type: 'editorial',
  copy: {
    pt: { label: PT_COPY.label, headline: PT_COPY.headline },
    en: { label: EN_COPY.label, headline: EN_COPY.headline },
  },
});

/** A normalized, unconditionally-eligible campaign. */
function makeCampaign(
  overrides: Partial<PromotionCampaign> = {}
): PromotionCampaign {
  return {
    id: 'promo-test',
    type: 'editorial',
    priority: 0,
    enabled: true,
    startDate: null,
    endDate: null,
    ctaUrl: null,
    promoCode: null,
    conditions: null,
    copy: { pt: { ...PT_COPY }, en: { ...EN_COPY } },
    ...overrides,
  };
}

/** Fixed selection instant — inside every schedule used below. */
const NOW = new Date('2026-06-15T12:00:00.000Z');

function makeContext(
  overrides: Partial<PromotionContext> = {}
): PromotionContext {
  return {
    surface: 'feed',
    visitor: 'new',
    cartCents: null,
    freeShippingThresholdCents: FREE_SHIPPING_THRESHOLD_CENTS,
    now: NOW,
    purchaseSurfaceEnabled: true,
    ...overrides,
  };
}

describe('normalizeCampaigns', () => {
  it.each([undefined, null, 'campaigns', 42, true, {}, { campaigns: [] }])(
    'returns [] for non-array input %j without throwing',
    (raw) => {
      expect(normalizeCampaigns(raw)).toEqual([]);
    }
  );

  it.each([null, 'entry', 42, undefined])(
    'skips non-object entry %j and keeps valid siblings in order',
    (entry) => {
      const first = { ...rawCampaign(), id: 'first' };
      const last = { ...rawCampaign(), id: 'last' };
      const result = normalizeCampaigns([first, entry, last]);
      expect(result.map((campaign) => campaign.id)).toEqual(['first', 'last']);
    }
  );

  it.each([
    ['missing id', { id: undefined }],
    ['empty-string id', { id: '' }],
    ['non-string id', { id: 7 }],
    ['unknown type', { type: 'flash-sale' }],
    ['missing type', { type: undefined }],
  ])('drops an entry with %s', (_label, patch) => {
    expect(normalizeCampaigns([{ ...rawCampaign(), ...patch }])).toEqual([]);
  });

  it.each([
    [
      'missing pt copy',
      {
        copy: {
          en: { label: 'LABEL', headline: 'Headline' },
        },
      },
    ],
    [
      'missing en copy',
      {
        copy: {
          pt: { label: 'RÓTULO', headline: 'Título' },
        },
      },
    ],
    [
      'empty pt label',
      {
        copy: {
          pt: { label: '', headline: 'Título' },
          en: { label: 'LABEL', headline: 'Headline' },
        },
      },
    ],
    [
      'empty en headline',
      {
        copy: {
          pt: { label: 'RÓTULO', headline: 'Título' },
          en: { label: 'LABEL', headline: '' },
        },
      },
    ],
    ['missing copy', { copy: undefined }],
    ['non-object copy', { copy: 'text' }],
  ])('drops an entry with %s', (_label, patch) => {
    expect(normalizeCampaigns([{ ...rawCampaign(), ...patch }])).toEqual([]);
  });

  it('coerces defaults for absent optional fields', () => {
    expect(normalizeCampaigns([rawCampaign()])).toEqual([
      {
        id: 'promo-raw',
        type: 'editorial',
        priority: 0,
        enabled: true,
        startDate: null,
        endDate: null,
        ctaUrl: null,
        promoCode: null,
        conditions: null,
        copy: { pt: PT_COPY, en: EN_COPY },
      },
    ]);
  });

  it('keeps provided values and filled copy fields', () => {
    const entry = {
      ...rawCampaign(),
      priority: 5,
      enabled: false,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
      ctaUrl: '/#products',
      promoCode: 'TEST-CODE',
      copy: {
        pt: { ...PT_COPY, description: 'Descrição', ctaLabel: 'Descobrir' },
        en: { ...EN_COPY, description: 'Description', ctaLabel: 'Discover' },
      },
    };
    const [campaign] = normalizeCampaigns([entry]);
    expect(campaign).toMatchObject({
      priority: 5,
      enabled: false,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
      ctaUrl: '/#products',
      promoCode: 'TEST-CODE',
      copy: {
        pt: { ...PT_COPY, description: 'Descrição', ctaLabel: 'Descobrir' },
        en: { ...EN_COPY, description: 'Description', ctaLabel: 'Discover' },
      },
    });
  });

  it('coerces malformed optionals back to their defaults', () => {
    const entry = {
      ...rawCampaign(),
      priority: 'high',
      enabled: 'yes',
      startDate: 'not-a-date',
      endDate: 12345,
      ctaUrl: '',
      promoCode: 99,
    };
    const [campaign] = normalizeCampaigns([entry]);
    expect(campaign).toMatchObject({
      priority: 0,
      enabled: true,
      startDate: null,
      endDate: null,
      ctaUrl: null,
      promoCode: null,
    });
  });

  it('ignores unknown keys at entry, copy, and conditions level', () => {
    const entry = {
      ...rawCampaign(),
      unexpected: 'ignored',
      // Implements ADR 03-003 "Bar theme": a legacy per-campaign `theme`
      // key is just another unknown key now — it drops on normalize;
      // `normalizeSiteConfig` reads it for the `promotion.theme`
      // fallback before this strip runs.
      theme: 'dark',
      conditions: { surfaces: ['feed'], unknownCondition: true },
      copy: {
        pt: { ...PT_COPY, extra: 'x' },
        en: { ...EN_COPY, extra: 'x' },
      },
    };
    const [campaign] = normalizeCampaigns([entry]);
    expect(campaign).toEqual({
      id: 'promo-raw',
      type: 'editorial',
      priority: 0,
      enabled: true,
      startDate: null,
      endDate: null,
      ctaUrl: null,
      promoCode: null,
      conditions: { surfaces: ['feed'] },
      copy: { pt: PT_COPY, en: EN_COPY },
    });
  });

  it.each([null, 'surfaces', 42])(
    'normalizes non-object conditions %j to null',
    (conditions) => {
      const [campaign] = normalizeCampaigns([{ ...rawCampaign(), conditions }]);
      expect(campaign.conditions).toBeNull();
    }
  );

  it('filters invalid surfaces and drops an emptied surfaces list', () => {
    const [mixed] = normalizeCampaigns([
      { ...rawCampaign(), conditions: { surfaces: ['feed', 'popup'] } },
    ]);
    expect(mixed.conditions?.surfaces).toEqual(['feed']);

    // An empty surfaces array is dropped: "no surfaces" is not a real
    // posture — absent means all surfaces (ADR 03-003).
    const [emptied] = normalizeCampaigns([
      { ...rawCampaign(), conditions: { surfaces: [] } },
    ]);
    expect(emptied.conditions?.surfaces).toBeUndefined();

    const [nonArray] = normalizeCampaigns([
      { ...rawCampaign(), conditions: { surfaces: 'feed' } },
    ]);
    expect(nonArray.conditions?.surfaces).toBeUndefined();
  });

  it('keeps a valid visitor condition and drops unknown values', () => {
    const [kept] = normalizeCampaigns([
      { ...rawCampaign(), conditions: { visitor: 'returning' } },
    ]);
    expect(kept.conditions?.visitor).toBe('returning');

    const [dropped] = normalizeCampaigns([
      { ...rawCampaign(), conditions: { visitor: 'subscribed' } },
    ]);
    expect(dropped.conditions?.visitor).toBeUndefined();
  });

  it('keeps finite non-negative minCartCents and drops the rest', () => {
    const [kept] = normalizeCampaigns([
      { ...rawCampaign(), conditions: { minCartCents: 0 } },
    ]);
    expect(kept.conditions?.minCartCents).toBe(0);

    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, '500']) {
      const [campaign] = normalizeCampaigns([
        { ...rawCampaign(), conditions: { minCartCents: invalid } },
      ]);
      expect(campaign.conditions?.minCartCents).toBeUndefined();
    }
  });

  it('keeps belowFreeShipping only when strictly true', () => {
    const [kept] = normalizeCampaigns([
      { ...rawCampaign(), conditions: { belowFreeShipping: true } },
    ]);
    expect(kept.conditions?.belowFreeShipping).toBe(true);

    for (const invalid of [false, 'yes', 1]) {
      const [campaign] = normalizeCampaigns([
        { ...rawCampaign(), conditions: { belowFreeShipping: invalid } },
      ]);
      expect(campaign.conditions?.belowFreeShipping).toBeUndefined();
    }
  });
});

/**
 * Implements ADR 03-003: Promotion Bar — the Smart Offer Switcher:
 * "an ordered pipeline: enabled → schedule → surface match → visitor
 * match → Cart conditions → highest priority → the
 * fallback campaign." Each `it` pins one eligibility rule in isolation.
 */
describe('selectCampaign', () => {
  it('returns null when there are no eligible campaigns', () => {
    expect(selectCampaign([], makeContext())).toBeNull();
    expect(
      selectCampaign([makeCampaign({ enabled: false })], makeContext())
    ).toBeNull();
  });

  it('selects an enabled campaign and skips disabled ones regardless of priority', () => {
    const disabled = makeCampaign({ id: 'off', priority: 99, enabled: false });
    const enabled = makeCampaign({ id: 'on', priority: 0 });
    expect(selectCampaign([disabled, enabled], makeContext())?.id).toBe('on');
  });

  it('enforces the schedule window inclusively at both boundaries', () => {
    const campaign = makeCampaign({
      startDate: '2026-06-15T12:00:00.000Z',
      endDate: '2026-06-15T12:00:00.000Z',
    });
    // now === startDate === endDate: both comparisons are inclusive.
    expect(selectCampaign([campaign], makeContext())?.id).toBe('promo-test');
  });

  it('skips a campaign before its startDate and after its endDate', () => {
    const notYet = makeCampaign({
      id: 'not-yet',
      startDate: '2026-06-16T00:00:00.000Z',
    });
    const over = makeCampaign({
      id: 'over',
      endDate: '2026-06-14T23:59:59.000Z',
    });
    const eligible = makeCampaign({ id: 'eligible' });
    expect(selectCampaign([notYet, over, eligible], makeContext())?.id).toBe(
      'eligible'
    );
  });

  it('matches the surface condition against the resolved surface', () => {
    const purchaseOnly = makeCampaign({
      id: 'purchase-only',
      conditions: { surfaces: ['purchase'] },
    });
    expect(selectCampaign([purchaseOnly], makeContext())).toBeNull();
    expect(
      selectCampaign([purchaseOnly], makeContext({ surface: 'purchase' }))?.id
    ).toBe('purchase-only');
    // Absent conditions match every surface.
    expect(
      selectCampaign(
        [purchaseOnly, makeCampaign({ id: 'everywhere' })],
        makeContext({ surface: 'classic' })
      )?.id
    ).toBe('everywhere');
  });

  it('matches visitor targeting; any or absent matches everyone', () => {
    const returning = makeCampaign({
      id: 'returning',
      conditions: { visitor: 'returning' },
    });
    expect(selectCampaign([returning], makeContext())).toBeNull();
    expect(
      selectCampaign([returning], makeContext({ visitor: 'returning' }))?.id
    ).toBe('returning');

    const any = makeCampaign({
      id: 'any',
      conditions: { visitor: 'any' },
    });
    expect(selectCampaign([any], makeContext())?.id).toBe('any');
    expect(
      selectCampaign([any], makeContext({ visitor: 'returning' }))?.id
    ).toBe('any');
  });

  it('fails minCartCents closed on an unhydrated Cart and below the bound', () => {
    const cartGated = makeCampaign({
      conditions: { minCartCents: 5000 },
    });
    // Cart still rehydrating — cart-conditioned campaigns never flash in.
    expect(selectCampaign([cartGated], makeContext())).toBeNull();
    expect(
      selectCampaign([cartGated], makeContext({ cartCents: 4999 }))
    ).toBeNull();
    expect(
      selectCampaign([cartGated], makeContext({ cartCents: 5000 }))?.id
    ).toBe('promo-test');
  });

  it('requires a non-empty Cart strictly below the free-shipping threshold', () => {
    const freeShipping = makeCampaign({
      conditions: { belowFreeShipping: true },
    });
    // Unhydrated Cart fails closed.
    expect(selectCampaign([freeShipping], makeContext())).toBeNull();
    // An empty Cart is not "below threshold" — the offer never shows on zero.
    expect(
      selectCampaign([freeShipping], makeContext({ cartCents: 0 }))
    ).toBeNull();
    // At/over threshold the promise would be false — ineligible.
    expect(
      selectCampaign(
        [freeShipping],
        makeContext({ cartCents: FREE_SHIPPING_THRESHOLD_CENTS })
      )
    ).toBeNull();
    expect(
      selectCampaign(
        [freeShipping],
        makeContext({ cartCents: FREE_SHIPPING_THRESHOLD_CENTS + 1 })
      )
    ).toBeNull();
    // Any non-empty subtotal below the threshold is eligible.
    expect(
      selectCampaign(
        [freeShipping],
        makeContext({ cartCents: FREE_SHIPPING_THRESHOLD_CENTS - 1 })
      )?.id
    ).toBe('promo-test');
  });

  // Implements ADR 03-003: the threshold is Site Config data — the
  // context carries whatever `shipping.freeShippingThresholdCents`
  // normalized to, and `belowFreeShipping` keys on that value, never a
  // constant.
  it('gates belowFreeShipping on the Site Config threshold carried in context', () => {
    const freeShipping = makeCampaign({
      conditions: { belowFreeShipping: true },
    });
    // A lower configured threshold moves the bound with it.
    expect(
      selectCampaign(
        [freeShipping],
        makeContext({ freeShippingThresholdCents: 5000, cartCents: 4999 })
      )?.id
    ).toBe('promo-test');
    expect(
      selectCampaign(
        [freeShipping],
        makeContext({ freeShippingThresholdCents: 5000, cartCents: 5000 })
      )
    ).toBeNull();
    // A threshold of 0 disables the condition — no subtotal is below it.
    expect(
      selectCampaign(
        [freeShipping],
        makeContext({ freeShippingThresholdCents: 0, cartCents: 1 })
      )
    ).toBeNull();
  });

  it('keeps a /checkout-CTA campaign eligible while the gate is closed — the CTA is suppressed at render (ADR 03-003)', () => {
    const checkoutCta = makeCampaign({
      id: 'checkout-cta',
      ctaUrl: '/checkout',
    });
    // Flag off — the campaign still wins; `isPurchasePath` suppresses
    // its CTA in the Island rather than making the campaign ineligible.
    expect(
      selectCampaign(
        [checkoutCta],
        makeContext({ purchaseSurfaceEnabled: false })
      )?.id
    ).toBe('checkout-cta');
    // Flag on — eligible as well.
    expect(selectCampaign([checkoutCta], makeContext())?.id).toBe(
      'checkout-cta'
    );
  });

  it('makes a purchase-surface-only campaign ineligible while the gate is closed', () => {
    const purchaseOnly = makeCampaign({
      id: 'purchase-only',
      conditions: { surfaces: ['purchase'] },
    });
    const purchasePlusFeed = makeCampaign({
      id: 'purchase-plus-feed',
      conditions: { surfaces: ['purchase', 'feed'] },
    });
    const gatedOff = makeContext({
      surface: 'purchase',
      purchaseSurfaceEnabled: false,
    });
    // The gated /checkout subtree renders the not-found boundary inside
    // the layout — a purchase-only campaign must not appear there.
    expect(selectCampaign([purchaseOnly], gatedOff)).toBeNull();
    // A multi-surface campaign is not "purchase-only" — eligible.
    expect(selectCampaign([purchasePlusFeed], gatedOff)?.id).toBe(
      'purchase-plus-feed'
    );
    // Gate open — the purchase-only campaign is eligible on its surface.
    expect(
      selectCampaign([purchaseOnly], makeContext({ surface: 'purchase' }))?.id
    ).toBe('purchase-only');
  });

  it('picks the highest-priority eligible campaign', () => {
    const low = makeCampaign({ id: 'low', priority: 1 });
    const high = makeCampaign({ id: 'high', priority: 9 });
    expect(selectCampaign([low, high], makeContext())?.id).toBe('high');
  });

  it('keeps array order on a priority tie', () => {
    const first = makeCampaign({ id: 'first', priority: 5 });
    const second = makeCampaign({ id: 'second', priority: 5 });
    expect(selectCampaign([first, second], makeContext())?.id).toBe('first');
    expect(selectCampaign([second, first], makeContext())?.id).toBe('second');
  });
});

/**
 * Implements ADR 03-003: Promotion Bar — pathname classes mirror
 * ChromeFrame's SHELL_ROUTES exactly (`'/' → feed`, `'/checkout' →
 * purchase`, everything else → `classic`); the post-checkout
 * success/cancel pages deliberately keep classic chrome.
 */
describe('surfaceForPathname', () => {
  it.each([
    ['/', 'feed'],
    ['/checkout', 'purchase'],
    ['/checkout/success', 'classic'],
    ['/checkout/cancel', 'classic'],
    ['/checkout/', 'classic'],
    ['/checkout-anything', 'classic'],
    ['/privacy', 'classic'],
    ['', 'classic'],
  ])('maps %s to %s', (pathname, surface) => {
    expect(surfaceForPathname(pathname)).toBe(surface);
  });
});

describe('interpolateRemaining', () => {
  it('replaces the {remaining} token with the formatted amount', () => {
    expect(
      interpolateRemaining('Faltam {remaining} para envio grátis', 3000)
    ).toBe(`Faltam ${formatPrice(30)} para envio grátis`);
  });

  it('replaces every occurrence of the token', () => {
    expect(interpolateRemaining('{remaining} + {remaining}', 500)).toBe(
      `${formatPrice(5)} + ${formatPrice(5)}`
    );
  });

  it('is a no-op on copy without the token', () => {
    expect(interpolateRemaining('No placeholder', 9999)).toBe('No placeholder');
  });
});

/**
 * Implements ADR 03-003: Promotion Bar — per-visitor state lives on the
 * device (`hf-visited` in localStorage, `hf-promo-expanded` /
 * `hf-promo-displayed` in sessionStorage) and "all access is
 * try/catch-guarded — storage full, blocked, or absent degrades to the
 * default posture, never a crash." Vitest runs in a Node environment, so
 * the Web Storage API is stubbed with a minimal in-memory implementation.
 */
describe('on-device persistence helpers', () => {
  const memoryStorage = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string): string | null => data.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        data.set(key, String(value));
      },
      removeItem: (key: string): void => {
        data.delete(key);
      },
      clear: (): void => {
        data.clear();
      },
    };
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a new visitor until markVisited records the flag', () => {
    expect(isVisitorNew()).toBe(true);
    markVisited();
    expect(isVisitorNew()).toBe(false);
    expect(localStorage.getItem(PROMO_VISITED_KEY)).toBe('1');
  });

  it('round-trips the per-session expanded campaign id and clears it on null', () => {
    expect(readExpandedId()).toBeNull();
    writeExpandedId('promo-a');
    expect(readExpandedId()).toBe('promo-a');
    expect(sessionStorage.getItem(PROMO_EXPANDED_KEY)).toBe('promo-a');
    writeExpandedId(null);
    expect(readExpandedId()).toBeNull();
    expect(sessionStorage.getItem(PROMO_EXPANDED_KEY)).toBeNull();
  });

  it('keeps expanded state per campaign id — a swap never inherits it', () => {
    writeExpandedId('promo-a');
    expect(readExpandedId()).toBe('promo-a');
    // A different campaign's id does not read as expanded.
    expect(readExpandedId()).not.toBe('promo-b');
  });

  it('degrades to defaults — never throws — when storage is unavailable', () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error('storage blocked');
      },
      setItem: (): void => {
        throw new Error('storage blocked');
      },
      removeItem: (): void => {
        throw new Error('storage blocked');
      },
    };
    vi.stubGlobal('localStorage', blocked);
    vi.stubGlobal('sessionStorage', blocked);

    // The bounded direction: failures report "new" so returning-targeted
    // campaigns stay hidden rather than flashing at first-time visitors.
    expect(isVisitorNew()).toBe(true);
    expect(readExpandedId()).toBeNull();
    expect(readDisplayedIds()).toEqual([]);
    expect(() => markVisited()).not.toThrow();
    expect(() => writeExpandedId('promo-a')).not.toThrow();
    expect(() => markDisplayed('promo-a')).not.toThrow();
  });
});

/**
 * Implements ADR 03-003: Promotion Bar — "The write path validates
 * strictly and rejects invalid campaigns with a named error — fail-loud
 * for the operator, fail-safe for the visitor." The persistence write
 * and cache invalidation are stubbed at their module boundary; the
 * action's own validation runs for real.
 */
describe('saveSiteConfig — strict promotion.campaigns validation', () => {
  beforeEach(() => {
    writeSiteConfigMock.mockReset().mockResolvedValue(undefined);
    getSiteConfigMock.mockReset().mockResolvedValue(DEFAULT_SITE_CONFIG);
  });

  const formDataWith = (campaigns?: string): FormData => {
    const formData = new FormData();
    if (campaigns !== undefined) {
      formData.set('promotion.campaigns', campaigns);
    }
    return formData;
  };

  it('rejects non-JSON campaign data before persisting', async () => {
    const result = await saveSiteConfig(formDataWith('{not json'));
    expect(result).toEqual({
      ok: false,
      error: 'Campaign data is not valid JSON',
    });
    expect(writeSiteConfigMock).not.toHaveBeenCalled();
  });

  it.each(['42', '"a string"', '{"campaigns":[]}', 'true'])(
    'rejects parsed JSON that is not a campaign list: %j',
    async (payload) => {
      const result = await saveSiteConfig(formDataWith(payload));
      expect(result).toEqual({
        ok: false,
        error: 'Campaign data is not a campaign list',
      });
      expect(writeSiteConfigMock).not.toHaveBeenCalled();
    }
  );

  it('rejects the whole document when any campaign fails validation', async () => {
    const payload = JSON.stringify([
      rawCampaign(),
      { id: 'broken', type: 'bogus', copy: {} },
      { id: 'also-broken' },
    ]);
    const result = await saveSiteConfig(formDataWith(payload));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('2 campaign(s) failed validation');
    }
    // Strict posture: nothing persists until every campaign is valid.
    expect(writeSiteConfigMock).not.toHaveBeenCalled();
  });

  it('persists normalized campaigns when every entry is valid', async () => {
    const payload = JSON.stringify([rawCampaign()]);
    const result = await saveSiteConfig(formDataWith(payload));
    expect(result).toEqual({ ok: true });
    expect(writeSiteConfigMock).toHaveBeenCalledTimes(1);
    const saved = writeSiteConfigMock.mock.calls[0][0];
    expect(saved.promotion.campaigns).toEqual(
      normalizeCampaigns([rawCampaign()])
    );
  });

  it('persists an explicit empty campaign list', async () => {
    // An operator may deliberately run no campaigns — `[]` is valid.
    const result = await saveSiteConfig(formDataWith('[]'));
    expect(result).toEqual({ ok: true });
    const saved = writeSiteConfigMock.mock.calls[0][0];
    expect(saved.promotion.campaigns).toEqual([]);
  });

  it('carries the stored campaign list forward when the field is absent', async () => {
    // An absent field is a malformed submit — the action must not seed
    // defaults over the operator's stored campaigns.
    const stored = normalizeCampaigns([
      { ...rawCampaign(), id: 'stored-campaign' },
    ]);
    getSiteConfigMock.mockResolvedValue({
      ...DEFAULT_SITE_CONFIG,
      promotion: { ...DEFAULT_SITE_CONFIG.promotion, campaigns: stored },
    });
    const result = await saveSiteConfig(formDataWith());
    expect(result).toEqual({ ok: true });
    const saved = writeSiteConfigMock.mock.calls[0][0];
    expect(saved.promotion.campaigns).toEqual(stored);
  });

  // Implements ADR 03-003: the free-shipping threshold is
  // operator-editable Site Config data — the form submits euros, the
  // action stores whole cents, and a malformed field carries the
  // stored value forward rather than resetting operator config.
  it('persists a valid free-shipping threshold in whole cents', async () => {
    const formData = formDataWith('[]');
    formData.set('shipping.freeShippingThreshold', '75.50');
    const result = await saveSiteConfig(formData);
    expect(result).toEqual({ ok: true });
    const saved = writeSiteConfigMock.mock.calls[0][0];
    expect(saved.shipping.freeShippingThresholdCents).toBe(7550);
  });

  it.each([undefined, 'not-a-number', '-5'])(
    'carries the stored threshold forward on invalid input %j',
    async (value) => {
      getSiteConfigMock.mockResolvedValue({
        ...DEFAULT_SITE_CONFIG,
        shipping: { freeShippingThresholdCents: 8000 },
      });
      const formData = formDataWith('[]');
      if (value !== undefined) {
        formData.set('shipping.freeShippingThreshold', value);
      }
      const result = await saveSiteConfig(formData);
      expect(result).toEqual({ ok: true });
      const saved = writeSiteConfigMock.mock.calls[0][0];
      expect(saved.shipping.freeShippingThresholdCents).toBe(8000);
    }
  );
});

/**
 * Implements ADR 03-003: Promotion Bar — "Free-shipping truthfulness":
 * when the server-validated subtotal reaches the Site Config
 * free-shipping threshold the checkout Route Handler swaps both
 * shipping options for complimentary (amount-0) ones, so the bar's
 * `{remaining}` message is enforced at Session creation — never
 * decorative. The PSP client is stubbed at the `getStripeClient`
 * boundary and Site Config at `getSiteConfig`; the handler's
 * validation and swap arithmetic run for real.
 */
describe('checkout Route Handler — complimentary shipping swap', () => {
  const checkoutRequest = (quantity: number): NextRequest =>
    new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [{ variantId: 'nsr-female-m', quantity }],
        locale: 'en',
        attemptId: `unit-checkout-${quantity}`,
      }),
    });

  const shippingOptionsOf =
    (): Stripe.Checkout.SessionCreateParams.ShippingOption[] => {
      const params = sessionCreate.mock.calls[0][0] as
        Stripe.Checkout.SessionCreateParams | undefined;
      return params?.shipping_options ?? [];
    };

  beforeEach(() => {
    vi.stubEnv('PURCHASE_SURFACE_ENABLED', 'true');
    sessionCreate
      .mockReset()
      .mockResolvedValue({ url: 'https://checkout.example.com/session' });
    getSiteConfigMock.mockReset().mockResolvedValue(DEFAULT_SITE_CONFIG);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the configured shipping rates below the threshold', async () => {
    // One item = 9000 cents < 10000 (the default Site Config
    // threshold) — paid shipping survives.
    const response = await checkoutPost(checkoutRequest(1));
    expect(response.status).toBe(200);
    const options = shippingOptionsOf();
    expect(
      options.map((option) => option.shipping_rate_data?.fixed_amount?.amount)
    ).toEqual(SHIPPING_OPTIONS.map((option) => option.amountCents));
    expect(
      options.map((option) => option.shipping_rate_data?.display_name)
    ).toEqual(SHIPPING_OPTIONS.map((option) => option.displayName));
  });

  it('swaps every shipping option to complimentary at/above the threshold', async () => {
    // Two items = 18000 cents >= 10000 — the promise the bar advertises.
    const response = await checkoutPost(checkoutRequest(2));
    expect(response.status).toBe(200);
    const options = shippingOptionsOf();
    expect(options).toHaveLength(SHIPPING_OPTIONS.length);
    for (const option of options) {
      expect(option.shipping_rate_data?.fixed_amount?.amount).toBe(0);
      expect(option.shipping_rate_data?.display_name).toContain(
        'Complimentary'
      );
      // Delivery estimates are preserved — only the rate changes.
      expect(option.shipping_rate_data?.delivery_estimate).toBeDefined();
    }
  });

  // Implements ADR 03-003: the swap keys on
  // `siteConfig.shipping.freeShippingThresholdCents` — the
  // operator-editable value — not the `lib/shipping.ts` fallback
  // constant.
  it('swaps at the Site Config threshold, not the fallback constant', async () => {
    getSiteConfigMock.mockResolvedValue({
      ...DEFAULT_SITE_CONFIG,
      shipping: { freeShippingThresholdCents: 9000 },
    });
    // One item = 9000 cents: below the 10000 default but at the
    // configured 9000 — complimentary rates apply.
    const response = await checkoutPost(checkoutRequest(1));
    expect(response.status).toBe(200);
    for (const option of shippingOptionsOf()) {
      expect(option.shipping_rate_data?.fixed_amount?.amount).toBe(0);
    }
  });

  it('keeps paid shipping at any subtotal when the threshold is 0', async () => {
    // A threshold of 0 is the operator's "free shipping off" switch —
    // the swap must never apply, even above the default threshold.
    getSiteConfigMock.mockResolvedValue({
      ...DEFAULT_SITE_CONFIG,
      shipping: { freeShippingThresholdCents: 0 },
    });
    const response = await checkoutPost(checkoutRequest(2));
    expect(response.status).toBe(200);
    for (const option of shippingOptionsOf()) {
      expect(option.shipping_rate_data?.fixed_amount?.amount).toBeGreaterThan(
        0
      );
    }
  });
});
