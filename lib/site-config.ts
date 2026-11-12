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
export type ChromeKey =
  | 'header'
  | 'footer'
  | 'mobileStickyCta'
  | 'premiumFeaturesModal'
  | 'whatsappBubble';

export type SiteSections = Record<SectionKey, boolean> & {
  qrcoderedirect: string;
};

export type SiteConfig = {
  sections: SiteSections;
  chrome: Record<ChromeKey, boolean>;
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
  },
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
];

/**
 * Merge a partial/unknown config shape on top of defaults so missing keys
 * fall back to `true` and unknown keys are ignored.
 */
export function normalizeSiteConfig(raw: unknown): SiteConfig {
  const out: SiteConfig = {
    sections: { ...DEFAULT_SITE_CONFIG.sections },
    chrome: { ...DEFAULT_SITE_CONFIG.chrome },
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
  return out;
}
