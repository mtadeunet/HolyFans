/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover ...
 * Site Config normalization and fallback."
 *
 * Covers `normalizeSiteConfig`: raw Edge Config payloads merge onto
 * defaults so missing keys fall back to enabled, unknown keys are ignored,
 * and malformed input degrades to `DEFAULT_SITE_CONFIG` — the always-safe
 * fallback required by ADR 00-002's Site Config failure posture.
 */
import { describe, expect, it } from 'vitest';
import {
  isVariantPurchasable,
  PRODUCT,
  purchasableRepresentative,
  representativeVariant,
  type VariantKey,
} from '@/lib/constants';
import type { ProductVariant } from '@/types/product';
import {
  DEFAULT_SITE_CONFIG,
  normalizeSiteConfig,
  type SiteConfig,
} from '@/lib/site-config';

describe('normalizeSiteConfig', () => {
  it.each([undefined, null, 'string', 42, true])(
    'returns defaults for non-object input %j',
    (raw) => {
      expect(normalizeSiteConfig(raw)).toEqual(DEFAULT_SITE_CONFIG);
    }
  );

  it('returns defaults for an empty object', () => {
    expect(normalizeSiteConfig({})).toEqual(DEFAULT_SITE_CONFIG);
  });

  it('merges known section flags and keeps defaults for missing keys', () => {
    const config = normalizeSiteConfig({
      sections: { hero: false, faq: false },
    });
    expect(config.sections.hero).toBe(false);
    expect(config.sections.faq).toBe(false);
    expect(config.sections.products).toBe(true);
    expect(config.chrome).toEqual(DEFAULT_SITE_CONFIG.chrome);
  });

  it('merges known chrome flags and ignores unknown keys', () => {
    const raw: unknown = {
      sections: { hero: true, unknownSection: false },
      chrome: { header: false, unknownChrome: false },
    };
    const config = normalizeSiteConfig(raw);
    expect(config.chrome.header).toBe(false);
    expect(config.chrome.footer).toBe(true);
    expect('unknownSection' in config.sections).toBe(false);
    expect('unknownChrome' in config.chrome).toBe(false);
  });

  it('ignores non-boolean section/chrome values', () => {
    const config = normalizeSiteConfig({
      sections: { hero: 'yes' },
      chrome: { header: 0 },
    });
    expect(config.sections.hero).toBe(true);
    expect(config.chrome.header).toBe(true);
  });

  // Implements ADR 00-010: Pre-order and Stock Notification — "Each
  // defaults off (items purchasable): Site Config reads fail open to
  // defaults". The per-Variant Stock Flags merge like the other toggle
  // groups and fall back to off when absent or malformed.
  it('defaults every per-Variant Stock Flag to off when absent or malformed', () => {
    expect(normalizeSiteConfig({}).stock['nsr-female-m']).toBe(false);
    expect(normalizeSiteConfig({}).stock['nsr-female-l']).toBe(false);
    expect(
      normalizeSiteConfig({ stock: { 'nsr-female-m': 'yes' } }).stock[
        'nsr-female-m'
      ]
    ).toBe(false);
    expect(normalizeSiteConfig({ stock: 'on' }).stock['nsr-female-m']).toBe(
      false
    );
  });

  it('merges a per-Variant Stock Flag and ignores unknown stock keys', () => {
    const raw: unknown = {
      stock: { 'nsr-female-m': true, unknownStock: true },
    };
    const config = normalizeSiteConfig(raw);
    expect(config.stock['nsr-female-m']).toBe(true);
    expect('unknownStock' in config.stock).toBe(false);
  });

  it('scopes stock flags per Variant — flagging one size leaves its sibling off', () => {
    const config = normalizeSiteConfig({
      stock: { 'nsr-female-l': true },
    });
    expect(config.stock['nsr-female-l']).toBe(true);
    expect(config.stock['nsr-female-m']).toBe(false);
  });

  it('ignores the retired stock key shapes', () => {
    // Shape changes: the global flag and the per-fit keys are replaced
    // by per-Variant keys — a stored document carrying either old
    // shape fails open to purchasable.
    const config = normalizeSiteConfig({
      stock: { outOfStock: true, female: true },
    });
    expect(config.stock['nsr-female-m']).toBe(false);
    expect(config.stock['nsr-female-l']).toBe(false);
    expect('outOfStock' in config.stock).toBe(false);
    expect('female' in config.stock).toBe(false);
  });

  it('passes through a string qrcoderedirect destination', () => {
    const target = 'https://example.com/campaign';
    const config = normalizeSiteConfig({
      sections: { qrcoderedirect: target },
    });
    expect(config.sections.qrcoderedirect).toBe(target);
  });

  it('ignores a non-string qrcoderedirect value', () => {
    const config = normalizeSiteConfig({
      sections: { qrcoderedirect: 123 },
    });
    expect(config.sections.qrcoderedirect).toBe(
      DEFAULT_SITE_CONFIG.sections.qrcoderedirect
    );
  });

  // Implements ADR 03-003: Promotion Bar — the shipping group merges
  // like every other Site Config group: a finite non-negative
  // `freeShippingThresholdCents` rounds to whole cents, garbage and a
  // missing group fall back to the default, unknown keys are ignored.
  it('normalizes shipping.freeShippingThresholdCents and falls back on garbage', () => {
    expect(
      normalizeSiteConfig({
        shipping: { freeShippingThresholdCents: 7500 },
      }).shipping.freeShippingThresholdCents
    ).toBe(7500);
    // Rounded to whole cents.
    expect(
      normalizeSiteConfig({
        shipping: { freeShippingThresholdCents: 100.6 },
      }).shipping.freeShippingThresholdCents
    ).toBe(101);

    for (const bad of [-1, '100', Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(
        normalizeSiteConfig({
          shipping: { freeShippingThresholdCents: bad },
        }).shipping.freeShippingThresholdCents
      ).toBe(DEFAULT_SITE_CONFIG.shipping.freeShippingThresholdCents);
    }

    // Missing group → defaults; unknown keys ignored.
    const config = normalizeSiteConfig({ shipping: { unknown: 5 } });
    expect(config.shipping).toEqual(DEFAULT_SITE_CONFIG.shipping);
    expect('unknown' in config.shipping).toBe(false);
  });

  // Implements ADR 03-003: Promotion Bar — the promotion group merges
  // like every other Site Config group: a missing group falls back to
  // the default campaigns, an explicit empty list is the operator's
  // deliberate no-campaigns posture, malformed entries drop out, and
  // unknown keys are ignored.
  it('normalizes the promotion group merge', () => {
    // Missing group → default fallback campaigns.
    expect(normalizeSiteConfig({}).promotion.campaigns).toEqual(
      DEFAULT_SITE_CONFIG.promotion.campaigns
    );
    // Explicit [] is honored — the operator turned every campaign off.
    expect(
      normalizeSiteConfig({ promotion: { campaigns: [] } }).promotion.campaigns
    ).toEqual([]);
    // Malformed entries drop out individually; the valid one survives.
    const [campaign] = normalizeSiteConfig({
      promotion: {
        campaigns: [
          { id: 'broken' },
          {
            id: 'ok',
            type: 'editorial',
            theme: 'light',
            copy: {
              pt: { label: 'L', headline: 'H' },
              en: { label: 'L', headline: 'H' },
            },
          },
        ],
      },
    }).promotion.campaigns;
    expect(campaign.id).toBe('ok');
    // Unknown keys on the group are ignored.
    const config = normalizeSiteConfig({ promotion: { unknown: 1 } });
    expect(config.promotion.campaigns).toEqual(
      DEFAULT_SITE_CONFIG.promotion.campaigns
    );
    expect('unknown' in config.promotion).toBe(false);
  });

  it('does not mutate the defaults object', () => {
    const before: SiteConfig = structuredClone(DEFAULT_SITE_CONFIG);
    normalizeSiteConfig({ sections: { hero: false } });
    expect(DEFAULT_SITE_CONFIG).toEqual(before);
  });
});

// Shared fixtures for the purchasability/representative describes:
// the female fit's two Variants and a Stock-Flag record builder that
// merges overrides onto the flag-off defaults.
const [medium, large] = PRODUCT.variants.female;
const stockFlags = (
  flags: Record<VariantKey, boolean>
): Record<VariantKey, boolean> => ({
  ...DEFAULT_SITE_CONFIG.stock,
  ...flags,
});

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "a Variant
 * is purchasable exactly when every Availability Flag applying to it in
 * Product Data is on AND its own Stock Flag in Site Config is off".
 * The conjunctive composition shared by every buy surface.
 */
describe('isVariantPurchasable', () => {
  it('is purchasable when the Availability Flag is on and its Stock Flag is off', () => {
    expect(isVariantPurchasable(medium, stockFlags({}))).toBe(true);
  });

  it('is not purchasable when it carries the Stock Flag', () => {
    expect(
      isVariantPurchasable(medium, stockFlags({ 'nsr-female-m': true }))
    ).toBe(false);
  });

  it('stays purchasable when a sibling Variant carries the Stock Flag', () => {
    // Per-Variant granularity: flagging L does not drag M into the
    // Pre-order state with it.
    expect(isVariantPurchasable(medium, stockFlags({ [large.id]: true }))).toBe(
      true
    );
  });

  it('is not purchasable when the Availability Flag is off even with its Stock Flag off', () => {
    expect(
      isVariantPurchasable({ ...medium, available: false }, stockFlags({}))
    ).toBe(false);
  });
});

/**
 * Implements ADR 00-004: Commerce and Checkout - "sold-out state is
 * expressed through Availability Flags in Product Data". The
 * flag-agnostic representative — label text and defensive fallbacks —
 * ignores Stock Flags entirely.
 */
describe('representativeVariant', () => {
  const fitVariants = PRODUCT.variants.female;

  it('returns the first available Variant', () => {
    expect(representativeVariant(fitVariants)).toBe(medium);
    expect(
      representativeVariant([{ ...medium, available: false }, large])
    ).toBe(large);
  });

  it('falls back to the first entry when every Variant of the fit is Availability-Flag-off', () => {
    const soldOut: ProductVariant[] = fitVariants.map((variant) => ({
      ...variant,
      available: false,
    }));
    expect(representativeVariant(soldOut)).toEqual(soldOut[0]);
  });
});

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "Fit-level
 * surfaces present the fit's first purchasable Variant". The
 * shopper-facing representative rule: first `isVariantPurchasable`,
 * then the flag-agnostic fallback so a sold-out fit still resolves.
 */
describe('purchasableRepresentative', () => {
  const fitVariants = PRODUCT.variants.female;

  it('returns the first Variant when every Stock Flag is off', () => {
    expect(purchasableRepresentative(fitVariants, stockFlags({}))).toBe(medium);
  });

  it('skips a flagged Variant for its purchasable sibling', () => {
    expect(
      purchasableRepresentative(
        fitVariants,
        stockFlags({ 'nsr-female-m': true })
      )
    ).toBe(large);
  });

  it('keeps the first Variant when only its sibling is flagged', () => {
    expect(
      purchasableRepresentative(
        fitVariants,
        stockFlags({ 'nsr-female-l': true })
      )
    ).toBe(medium);
  });

  it('falls back to the first available Variant when every Variant is Stock-Flagged', () => {
    expect(
      purchasableRepresentative(
        fitVariants,
        stockFlags({ 'nsr-female-m': true, 'nsr-female-l': true })
      )
    ).toBe(medium);
  });

  it('falls back to the first available Variant — flagged or not — when nothing is purchasable', () => {
    // Medium's Availability Flag is off and L carries the Stock Flag:
    // nothing purchasable, so the flag-agnostic representative (first
    // available) resolves — a sold-out fit still has a representative.
    const variants: ProductVariant[] = [{ ...medium, available: false }, large];
    expect(
      purchasableRepresentative(variants, stockFlags({ 'nsr-female-l': true }))
    ).toBe(large);
  });

  it('falls back to the first entry when every Variant is Availability-Flag-off', () => {
    const soldOut: ProductVariant[] = fitVariants.map((variant) => ({
      ...variant,
      available: false,
    }));
    expect(purchasableRepresentative(soldOut, stockFlags({}))).toEqual(
      soldOut[0]
    );
  });
});
