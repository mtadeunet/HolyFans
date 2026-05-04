import { get } from '@vercel/edge-config';

export const SITE_CONFIG_KEY = 'siteConfig';

export type SectionKey =
  | 'hero'
  | 'socialProof'
  | 'products'
  | 'craftsmanship'
  | 'faq'
  | 'finalCta';

export type ChromeKey =
  | 'header'
  | 'footer'
  | 'mobileStickyCta'
  | 'premiumFeaturesModal';

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

/**
 * Fetch the current site config from Vercel Edge Config.
 * Returns defaults (all enabled) if the store is unavailable or the key is missing.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (!process.env.EDGE_CONFIG) {
    return DEFAULT_SITE_CONFIG;
  }
  try {
    const raw = await get(SITE_CONFIG_KEY);
    return normalizeSiteConfig(raw);
  } catch (error) {
    console.error('[site-config] Edge Config read failed:', error);
    return DEFAULT_SITE_CONFIG;
  }
}
