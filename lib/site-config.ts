import { VARIANTS, type VariantKey } from '@/lib/constants';
import {
  EMPTY_EMAIL_OVERRIDES,
  normalizeEmailOverrides,
  type EmailOverrides,
} from './email-templates';
import {
  DEFAULT_CAMPAIGNS,
  normalizeCampaigns,
  type PromotionCampaign,
} from './promotions';
import { FREE_SHIPPING_THRESHOLD_CENTS } from './shipping';

export const SITE_CONFIG_KEY = 'siteConfig';

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "each existing section toggle
 * governs the feed unit(s) carrying that content domain. Toggle keys are
 * retained so stored Site Config documents keep working without
 * migration."
 *
 * The key set is unchanged; semantics shifted from stacked page sections
 * to landing feed units — a saved "hide FAQ" still hides FAQ content,
 * now expressed as hiding the FAQ Post Card.
 */
export type SectionKey =
  'hero' | 'socialProof' | 'products' | 'craftsmanship' | 'faq' | 'finalCta';

// Implements ADR 00-009: WhatsApp Deep-Link Channels — Client-Resolved
// Vendor Deep Links for Customer Messaging - the Inbound Contact Surface
// is "operator-toggleable through Site Config and the Admin Console like
// other global chrome" via the `whatsappBubble` key below.
//
// Implements ADR 03-003: Promotion Bar - the Promotion Bar mount is
// "operator-toggleable through Site Config like other global chrome" via
// the `promotionBar` key below.
export type ChromeKey =
  | 'header'
  | 'footer'
  | 'mobileStickyCta'
  | 'premiumFeaturesModal'
  | 'whatsappBubble'
  | 'promotionBar';

export type SiteSections = Record<SectionKey, boolean> & {
  qrcoderedirect: string;
};

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "Each Stock
 * Flag is an operator toggle in Site Config — one per Variant in
 * Product Data — the same mechanism as the section and chrome
 * toggles". Each key is a Variant id of `PRODUCT.variants`
 * (`'nsr-female-m'` and siblings today — the domain derives from
 * Product Data so a new Variant gets its flag, its Admin Console
 * toggle, and its normalization automatically): `true` forces that
 * Variant into the Pre-order state; `false` — the default — leaves
 * purchasability to the Product Data Availability Flags. The flag is
 * presentation-level only: server-side Cart re-validation against
 * Availability Flags remains the hard purchase backstop.
 */
export type StockKey = VariantKey;

export type SiteConfig = {
  sections: SiteSections;
  chrome: Record<ChromeKey, boolean>;
  stock: Record<StockKey, boolean>;
  /**
   * Implements ADR 03-003: Promotion Bar - "the Promotion Campaign list
   * is operator-editable Site Config data, normalized like every other
   * Site Config group": the campaigns the Promotion Bar selects from,
   * validated by `normalizeCampaigns` — malformed entries drop out,
   * missing `promotion` documents fall back to `DEFAULT_CAMPAIGNS`.
   */
  promotion: { campaigns: PromotionCampaign[] };
  /**
   * Implements ADR 03-003: Promotion Bar — the free-shipping
   * threshold is operator-editable Site Config data, normalized like
   * every other Site Config group; it is the single value the checkout
   * shipping swap and the Promotion Bar's `belowFreeShipping`
   * condition key on, so the bar's `{remaining}` promise is enforced
   * identically at checkout.
   */
  shipping: { freeShippingThresholdCents: number };
  /**
   * Implements ADR 00-013: Email Delivery Channel — "The
   * customer-facing sends' copy — Thank-You Email, Capture
   * Acknowledgment, Restock Notification — is operator-editable Site
   * Config data (an `emails` group normalized field-by-field over the
   * in-repo defaults like every Site Config group, ADR 03-003)". The
   * `shared` per-Locale header/footer plus one `EmailTemplateOverride`
   * (`{subject, heading, body}`) per send kind; an empty object means
   * the send renders its in-repo default copy. Operator-facing sends
   * stay code-fixed and have no entry here.
   */
  emails: EmailOverrides;
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  sections: {
    hero: true,
    socialProof: true,
    products: true,
    craftsmanship: true,
    faq: true,
    finalCta: true,
    qrcoderedirect: '',
  },
  chrome: {
    header: true,
    footer: true,
    mobileStickyCta: true,
    premiumFeaturesModal: true,
    whatsappBubble: true,
    // Implements ADR 03-003: Site Config reads fail open to defaults,
    // and the always-on editorial fallback campaign ships enabled.
    promotionBar: true,
  },
  // Implements ADR 00-010: "Each defaults off (items purchasable)" —
  // Site Config reads fail open to defaults, and failing open to the
  // purchasable presentation is the bounded direction. One entry per
  // Variant in Product Data, derived like `STOCK_KEYS`.
  stock: Object.fromEntries(
    VARIANTS.map((variant) => [variant.id, false])
  ) as Record<StockKey, boolean>,
  promotion: { campaigns: DEFAULT_CAMPAIGNS },
  // Implements ADR 03-003: the threshold's default is the constant in
  // `lib/shipping.ts`; the Admin Console edits the live value through
  // the Shipping section.
  shipping: { freeShippingThresholdCents: FREE_SHIPPING_THRESHOLD_CENTS },
  // Implements ADR 00-013: the default `emails` group is empty — the
  // customer-facing sends ship with their in-repo copy and the
  // operator's edits arrive as overrides, never as a seeded document.
  emails: EMPTY_EMAIL_OVERRIDES,
};

export const SECTION_KEYS: SectionKey[] = [
  'hero',
  'socialProof',
  'products',
  'craftsmanship',
  'faq',
  'finalCta',
];

export const CHROME_KEYS: ChromeKey[] = [
  'header',
  'footer',
  'mobileStickyCta',
  'premiumFeaturesModal',
  'whatsappBubble',
  'promotionBar',
];

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "a Stock
 * Flag **per Variant** in Site Config". The per-Variant Stock Flag
 * keys are the Variant ids of Product Data itself: every consumer of
 * `STOCK_KEYS` (normalization, the Admin Console form, the save
 * action) enumerates the catalog's Variants, so a Variant entering
 * the catalog appears everywhere without a code change.
 */
export const STOCK_KEYS: StockKey[] = VARIANTS.map((variant) => variant.id);

/**
 * Merge a partial/unknown config shape on top of defaults so missing keys
 * fall back to `true` and unknown keys are ignored.
 */
export function normalizeSiteConfig(raw: unknown): SiteConfig {
  const out: SiteConfig = {
    sections: { ...DEFAULT_SITE_CONFIG.sections },
    chrome: { ...DEFAULT_SITE_CONFIG.chrome },
    stock: { ...DEFAULT_SITE_CONFIG.stock },
    promotion: { campaigns: [...DEFAULT_CAMPAIGNS] },
    shipping: { ...DEFAULT_SITE_CONFIG.shipping },
    // Implements ADR 00-013: the `emails` group's starting shape is the
    // shared all-defaults constant — `normalizeEmailOverrides` rebuilds
    // it fresh below for object input, and non-object input keeps this
    // read-only alias exactly like `DEFAULT_SITE_CONFIG.emails` does.
    emails: EMPTY_EMAIL_OVERRIDES,
  };
  if (!raw || typeof raw !== 'object') return out;
  const source = raw as Partial<SiteConfig>;
  if (source.sections && typeof source.sections === 'object') {
    for (const key of SECTION_KEYS) {
      const value = (source.sections as Record<string, unknown>)[key];
      if (typeof value === 'boolean') out.sections[key] = value;
    }
    const qrcoderedirect = (source.sections as Record<string, unknown>)[
      'qrcoderedirect'
    ];
    if (typeof qrcoderedirect === 'string') {
      out.sections.qrcoderedirect = qrcoderedirect;
    }
  }
  if (source.chrome && typeof source.chrome === 'object') {
    for (const key of CHROME_KEYS) {
      const value = (source.chrome as Record<string, unknown>)[key];
      if (typeof value === 'boolean') out.chrome[key] = value;
    }
  }
  if (source.stock && typeof source.stock === 'object') {
    for (const key of STOCK_KEYS) {
      const value = (source.stock as Record<string, unknown>)[key];
      if (typeof value === 'boolean') out.stock[key] = value;
    }
  }
  // Implements ADR 03-003: Promotion Bar — campaigns normalize through
  // the same posture: applied only when the stored document carries a
  // `promotion.campaigns` array (missing → defaults, unknown keys
  // ignored); an explicit empty array stays empty so the operator can
  // deliberately run no campaigns.
  if (source.promotion && typeof source.promotion === 'object') {
    const campaigns = (source.promotion as Record<string, unknown>)[
      'campaigns'
    ];
    if (Array.isArray(campaigns)) {
      out.promotion.campaigns = normalizeCampaigns(campaigns);
    }
  }
  // Implements ADR 03-003: Promotion Bar — the shipping group
  // normalizes with the same posture: applied only when the stored
  // document carries `shipping` (missing → defaults, unknown keys
  // ignored); a finite non-negative `freeShippingThresholdCents` is
  // rounded to whole cents, anything else falls back to the default.
  if (source.shipping && typeof source.shipping === 'object') {
    const threshold = (source.shipping as Record<string, unknown>)[
      'freeShippingThresholdCents'
    ];
    if (
      typeof threshold === 'number' &&
      Number.isFinite(threshold) &&
      threshold >= 0
    ) {
      out.shipping.freeShippingThresholdCents = Math.round(threshold);
    }
  }
  // Implements ADR 00-013: Email Delivery Channel — the `emails` group
  // merges like every Site Config group: the `shared` header/footer and
  // known send kinds, Locales, and per-kind fields survive; unknown
  // keys, non-strings, blanks, and line-broken single-line fields drop
  // out — a missing or empty group means all-default copy, never a
  // failure.
  out.emails = normalizeEmailOverrides(source.emails);
  return out;
}
