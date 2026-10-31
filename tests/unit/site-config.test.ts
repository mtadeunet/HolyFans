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

  it('does not mutate the defaults object', () => {
    const before: SiteConfig = structuredClone(DEFAULT_SITE_CONFIG);
    normalizeSiteConfig({ sections: { hero: false } });
    expect(DEFAULT_SITE_CONFIG).toEqual(before);
  });
});
