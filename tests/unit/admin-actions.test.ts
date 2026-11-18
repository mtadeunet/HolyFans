/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-013: Email Delivery Channel — the `emails` group is
 * "operator-editable Site Config data": `saveSiteConfig` normalizes a
 * well-formed overrides document, rejects unparseable JSON with a named
 * error, and — the same carry-forward posture as the campaigns and
 * threshold siblings — preserves the stored group on malformed submits
 * rather than wiping the operator's copy.
 *
 * Covers `saveSiteConfig` in `app/admin/actions.ts`: the `emails` field's
 * parse-and-normalize path. The persistence write, the stored-config
 * read, and cache invalidation are stubbed at their module boundaries;
 * the action's own validation runs for real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveSiteConfig } from '@/app/admin/actions';
import {
  normalizeEmailOverrides,
  type EmailOverrides,
} from '@/lib/email-templates';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@/lib/site-config';

/**
 * Mocks are confined to true external boundaries: the Site Config
 * persistence write, the stored-config read, and the Next.js
 * cache-invalidation primitive. The action under test runs for real.
 */
const { writeSiteConfigMock, getSiteConfigMock } = vi.hoisted(() => ({
  writeSiteConfigMock: vi.fn(),
  getSiteConfigMock: vi.fn(),
}));

vi.mock('@/lib/edge-config-write', () => ({
  writeSiteConfig: writeSiteConfigMock,
}));
vi.mock('@/lib/site-config-server', () => ({
  getSiteConfig: getSiteConfigMock,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** Stored overrides every malformed-submit path must preserve. */
const STORED_EMAILS: EmailOverrides = {
  shared: { pt: { footerText: 'Com carinho' } },
  thankYou: { pt: { heading: 'Olá!' } },
  captureAck: {},
  restock: { en: { body: 'See it now' } },
};

const formDataWith = (emails?: string): FormData => {
  const formData = new FormData();
  if (emails !== undefined) {
    formData.set('emails', emails);
  }
  return formData;
};

const savedConfig = (): SiteConfig =>
  writeSiteConfigMock.mock.calls[0][0] as SiteConfig;

describe('saveSiteConfig — emails group write path (ADR 00-013)', () => {
  beforeEach(() => {
    writeSiteConfigMock.mockReset().mockResolvedValue(undefined);
    getSiteConfigMock.mockReset().mockResolvedValue({
      ...DEFAULT_SITE_CONFIG,
      emails: STORED_EMAILS,
    });
  });

  it('rejects unparseable email template JSON before persisting', async () => {
    const result = await saveSiteConfig(formDataWith('{not json'));
    expect(result).toEqual({
      ok: false,
      error: 'Email template data is not valid JSON',
    });
    expect(writeSiteConfigMock).not.toHaveBeenCalled();
  });

  it.each(['[]', 'null', '"a string"', '42', 'true'])(
    'carries the stored overrides forward on non-object JSON: %s',
    async (payload) => {
      // Valid JSON that is not an overrides object is malformed submit
      // data — normalizing it would produce an all-defaults group and
      // silently wipe the operator's copy.
      const result = await saveSiteConfig(formDataWith(payload));
      expect(result).toEqual({ ok: true });
      expect(savedConfig().emails).toEqual(STORED_EMAILS);
    }
  );

  it('carries the stored overrides forward when the field is absent', async () => {
    const result = await saveSiteConfig(formDataWith());
    expect(result).toEqual({ ok: true });
    expect(savedConfig().emails).toEqual(STORED_EMAILS);
  });

  it('persists normalized overrides for a well-formed document', async () => {
    const payload = JSON.stringify({
      thankYou: { pt: { subject: 'Obrigado!' } },
      unknownKind: { pt: { subject: 'x' } },
    });
    const result = await saveSiteConfig(formDataWith(payload));
    expect(result).toEqual({ ok: true });
    expect(savedConfig().emails).toEqual(
      normalizeEmailOverrides(JSON.parse(payload))
    );
  });
});

/**
 * Implements ADR 03-003: Promotion Bar — "Bar theme": `promotion.theme`
 * travels as a plain scalar field and validates against the theme enum;
 * a missing or invalid value carries the stored theme forward — the
 * same never-silently-reset posture as the campaigns list and the
 * threshold.
 */
describe('saveSiteConfig — promotion.theme write path (ADR 03-003)', () => {
  beforeEach(() => {
    writeSiteConfigMock.mockReset().mockResolvedValue(undefined);
    getSiteConfigMock.mockReset().mockResolvedValue({
      ...DEFAULT_SITE_CONFIG,
      promotion: {
        ...DEFAULT_SITE_CONFIG.promotion,
        theme: 'soft',
      },
    });
  });

  it('persists a valid submitted theme', async () => {
    const formData = new FormData();
    formData.set('promotion.theme', 'accent');
    const result = await saveSiteConfig(formData);
    expect(result).toEqual({ ok: true });
    expect(savedConfig().promotion.theme).toBe('accent');
  });

  it.each([undefined, 'sepia', '42'])(
    'carries the stored theme forward on invalid input %j',
    async (value) => {
      const formData = new FormData();
      if (value !== undefined) {
        formData.set('promotion.theme', value);
      }
      const result = await saveSiteConfig(formData);
      expect(result).toEqual({ ok: true });
      expect(savedConfig().promotion.theme).toBe('soft');
    }
  );
});
