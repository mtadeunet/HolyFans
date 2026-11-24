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
 * Implements ADR 03-004: Model Profiles — `saveProfile` normalizes the
 * submitted profile through `normalizeProfiles`, diffs each submitted
 * post against the SERVER-RECOMPUTED filesystem baseline (folder post
 * files + sidecar captions — never trusted from the client), and
 * persists the resulting SPARSE overlay through `writeProfile` into
 * the managed store's profiles keyspace — `writeProfile`'s own folder
 * guard rejects a slug naming no `public/images/profiles/<slug>/`
 * folder as `unknown_profile`, a submitted post id naming no folder
 * image rejects as `unknown_post`, and the action fails closed when
 * the store is unconfigured.
 *
 * Implements ADR 00-015: Transactional Notifications — the Order
 * Ledger as "the fulfillment/audit copy" the operator's bookkeeping
 * lands on: `saveOrder` submits only the order's operator fields to
 * `updateOrder`, fails closed on an unconfigured store, and surfaces
 * `updateOrder`'s named rejections to the operator.
 *
 * Covers `saveSiteConfig`, `saveProfile`, and `saveOrder` in
 * `app/admin/actions.ts`: the `emails` field's parse-and-normalize
 * path, the profile write path, and the order operator-fields write
 * path. The persistence writes, the stored-config read, the managed-
 * store client, the folder enumeration, and cache invalidation are
 * stubbed at their module boundaries; the actions' own validation
 * runs for real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from '@upstash/redis';
import { saveOrder, saveProfile, saveSiteConfig } from '@/app/admin/actions';
import type { OrderUpdate } from '@/lib/orders-server';
import {
  normalizeEmailOverrides,
  type EmailOverrides,
} from '@/lib/email-templates';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@/lib/site-config';

/**
 * Mocks are confined to true external boundaries: the Site Config
 * persistence write, the stored-config read, the managed-store client,
 * the profiles keyspace write, and the Next.js cache-invalidation
 * primitive. The actions under test run for real.
 */
const {
  writeSiteConfigMock,
  getSiteConfigMock,
  getManagedStoreMock,
  writeProfileMock,
  deriveProfilePostsMock,
  updateOrderMock,
} = vi.hoisted(() => ({
  writeSiteConfigMock: vi.fn(),
  getSiteConfigMock: vi.fn(),
  getManagedStoreMock: vi.fn(),
  writeProfileMock: vi.fn(),
  deriveProfilePostsMock: vi.fn(),
  updateOrderMock: vi.fn(),
}));

vi.mock('@/lib/edge-config-write', () => ({
  writeSiteConfig: writeSiteConfigMock,
}));
vi.mock('@/lib/site-config-server', () => ({
  getSiteConfig: getSiteConfigMock,
}));
vi.mock('@/lib/managed-store', () => ({
  getManagedStore: getManagedStoreMock,
}));
vi.mock('@/lib/profiles-server', () => ({
  writeProfile: writeProfileMock,
  deriveProfilePosts: deriveProfilePostsMock,
}));
vi.mock('@/lib/orders-server', () => ({
  updateOrder: updateOrderMock,
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

/** An opaque stand-in for the managed-store client — the write path
 *  is mocked, so the store is never commanded. */
const FAKE_STORE = {} as unknown as Redis;

/** The folder's derived baseline posts `deriveProfilePosts` returns —
 *  file-derived ids, media, and sidecar captions at baseline flags. */
const BASELINE_POSTS = [
  {
    id: 'pp-model-one-post-1',
    media: '/images/profiles/model-one/post-1.jpg',
    caption: { pt: 'Legenda sidecar', en: 'Sidecar caption' },
    likes: 0,
    visible: true,
  },
  {
    id: 'pp-model-one-post-2',
    media: '/images/profiles/model-one/post-2.jpg',
    caption: { pt: '', en: '' },
    likes: 0,
    visible: true,
  },
];

/** One submitted effective post — the shape the console's draft
 *  sends, defaults equal to the first baseline post. */
const submittedPost = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id: 'pp-model-one-post-1',
  media: '/images/profiles/model-one/post-1.jpg',
  caption: { pt: 'Legenda sidecar', en: 'Sidecar caption' },
  likes: 0,
  visible: true,
  ...overrides,
});

/** One well-formed profile submit (identifier hygiene: synthetic
 *  slugs only, ADR 00-007). */
const rawProfile = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id: 'model-one',
  enabled: true,
  avatar: '/images/profiles/model-one/avatar.png',
  posts: [submittedPost()],
  ...overrides,
});

/**
 * Implements ADR 03-004: Model Profiles — the Profiles tab submits
 * ONLY the selected profile as the `saveProfile` argument; the action
 * normalizes the identity fields through `normalizeProfiles` (a
 * malformed submit rejects rather than coercing), diffs every
 * submitted post against the SERVER-RECOMPUTED filesystem baseline —
 * `deriveProfilePosts`, never client-supplied baselines — into the
 * sparse `posts` Record, rejects a post id naming no folder image as
 * `unknown_post`, and persists through `writeProfile`, whose own
 * folder guard rejects a slug naming no
 * `public/images/profiles/<slug>/` folder as `unknown_profile` — the
 * filesystem is the profile set AND the post set, enforced at the
 * write-path gate. Fail-closed (ADR 00-002): an unconfigured store
 * reports 'Store not configured' rather than a success it did not
 * perform.
 */
describe('saveProfile (ADR 03-004)', () => {
  beforeEach(() => {
    writeProfileMock.mockReset().mockResolvedValue(undefined);
    deriveProfilePostsMock.mockReset().mockResolvedValue(BASELINE_POSTS);
    getManagedStoreMock.mockReset().mockReturnValue(FAKE_STORE);
  });

  /** The posts Record the write was called with. */
  const writtenPosts = (): Record<string, unknown> => {
    const profile = writeProfileMock.mock.calls[0][1] as {
      posts: Record<string, unknown>;
    };
    return profile.posts;
  };

  it('persists the selected profile as a sparse overlay — a post matching its baseline stores no entry', async () => {
    const result = await saveProfile(rawProfile());
    expect(result).toEqual({ ok: true });
    expect(writeProfileMock).toHaveBeenCalledWith(
      FAKE_STORE,
      expect.objectContaining({
        id: 'model-one',
        enabled: true,
        avatar: '/images/profiles/model-one/avatar.png',
        posts: {},
      })
    );
  });

  it('stores only the fields that differ from the filesystem baseline', async () => {
    const result = await saveProfile(
      rawProfile({
        posts: [
          submittedPost({
            visible: false,
            likes: 7,
            caption: { pt: 'Legenda nova', en: 'New caption' },
            alt: { pt: 'Texto alt', en: '' },
          }),
          // post-2 unchanged → no entry.
          submittedPost({
            id: 'pp-model-one-post-2',
            media: '/images/profiles/model-one/post-2.jpg',
            caption: { pt: '', en: '' },
          }),
        ],
      })
    );
    expect(result).toEqual({ ok: true });
    expect(writtenPosts()).toEqual({
      'pp-model-one-post-1': {
        visible: false,
        likes: 7,
        caption: { pt: 'Legenda nova', en: 'New caption' },
        alt: { pt: 'Texto alt', en: '' },
      },
    });
  });

  it('a caption equal to the sidecar stores no caption field — sparse means only diffs', async () => {
    const result = await saveProfile(
      rawProfile({ posts: [submittedPost({ likes: 3 })] })
    );
    expect(result).toEqual({ ok: true });
    expect(writtenPosts()).toEqual({
      'pp-model-one-post-1': { likes: 3 },
    });
  });

  it('an empty alt override stores nothing — absent means "fall back to the display name"', async () => {
    const result = await saveProfile(
      rawProfile({
        posts: [
          submittedPost({ likes: 1, alt: { pt: '', en: '' } }),
        ],
      })
    );
    expect(result).toEqual({ ok: true });
    expect(writtenPosts()).toEqual({
      'pp-model-one-post-1': { likes: 1 },
    });
  });

  it('accepts the posts field as an id-keyed record — the already-sparse transport shape', async () => {
    const result = await saveProfile(
      rawProfile({
        posts: {
          'pp-model-one-post-1': { visible: false },
          'pp-model-one-post-2': { likes: 5 },
        },
      })
    );
    expect(result).toEqual({ ok: true });
    expect(writtenPosts()).toEqual({
      'pp-model-one-post-1': { visible: false },
      'pp-model-one-post-2': { likes: 5 },
    });
  });

  it('rejects a submitted post id whose image is not in the folder — unknown_post, nothing written', async () => {
    const result = await saveProfile(
      rawProfile({
        posts: [submittedPost(), submittedPost({ id: 'pp-model-one-gone' })],
      })
    );
    expect(result).toEqual({
      ok: false,
      error: 'unknown_post: pp-model-one-gone',
    });
    expect(writeProfileMock).not.toHaveBeenCalled();
  });

  it('skips non-object post entries silently — they carry no fields to diff', async () => {
    const result = await saveProfile(
      rawProfile({
        posts: [null, 42, submittedPost({ likes: 2 })],
      })
    );
    expect(result).toEqual({ ok: true });
    expect(writtenPosts()).toEqual({
      'pp-model-one-post-1': { likes: 2 },
    });
  });

  it('ignores unknown keys on the submit — a stray `name` field never reaches the document', async () => {
    const result = await saveProfile(rawProfile({ name: 'Stray Name' }));
    expect(result).toEqual({ ok: true });
    expect(writeProfileMock).toHaveBeenCalledWith(
      FAKE_STORE,
      expect.not.objectContaining({ name: expect.anything() })
    );
  });

  it.each([
    ['non-object input', 'not a profile'],
    ['missing id', { enabled: true }],
    ['a non-slug id', rawProfile({ id: 'NOT A SLUG' })],
    ['a reserved slug', rawProfile({ id: 'admin' })],
  ])('rejects a malformed submit %s without writing', (_label, payload) => {
    return saveProfile(payload).then((result) => {
      expect(result).toEqual({
        ok: false,
        error: 'Profile data is not a valid profile',
      });
      expect(writeProfileMock).not.toHaveBeenCalled();
    });
  });

  it("surfaces writeProfile's folder guard as unknown_profile — the filesystem is the profile set", async () => {
    // The single existence check lives inside `writeProfile`; the
    // action relays its message verbatim to the operator.
    writeProfileMock.mockRejectedValue(new Error('unknown_profile'));
    const result = await saveProfile(rawProfile({ id: 'model-nine' }));
    expect(result).toEqual({ ok: false, error: 'unknown_profile' });
  });

  it('accepts a posts field that is neither array nor record — nothing to diff, the overlay stays empty', async () => {
    const result = await saveProfile(rawProfile({ posts: 'not-an-array' }));
    expect(result).toEqual({ ok: true });
    expect(writtenPosts()).toEqual({});
  });

  it('reports an unconfigured store without writing — and without touching the filesystem baselines', async () => {
    getManagedStoreMock.mockReturnValue(null);
    const result = await saveProfile(rawProfile());
    expect(result).toEqual({ ok: false, error: 'Store not configured' });
    expect(writeProfileMock).not.toHaveBeenCalled();
    expect(deriveProfilePostsMock).not.toHaveBeenCalled();
  });

  it('surfaces a store write failure', async () => {
    writeProfileMock.mockRejectedValue(new Error('write exploded'));
    const result = await saveProfile(rawProfile());
    expect(result).toEqual({ ok: false, error: 'write exploded' });
  });
});

/**
 * Implements ADR 00-015: Transactional Notifications — the Admin
 * Console's per-order Save submits ONLY the operator fields
 * (`status`, `trackingId`) as `saveOrder`'s serializable argument;
 * `updateOrder` validates and merges them onto the stored
 * `order:<sessionId>` document while the purchase detail stays
 * webhook-owned. Fail-closed (ADR 00-002): an unconfigured store
 * reports 'Store not configured', an empty session id rejects before
 * any store touch, a malformed `fields` transport degrades to a
 * no-field update rather than crashing, and `updateOrder`'s named
 * rejections (unknown order, invalid status, invalid tracking id)
 * surface to the operator verbatim.
 */
describe('saveOrder (ADR 00-015)', () => {
  const SESSION_ID = 'cs_test_synthetic_order';

  beforeEach(() => {
    updateOrderMock.mockReset().mockResolvedValue(undefined);
    getManagedStoreMock.mockReset().mockReturnValue(FAKE_STORE);
  });

  it.each([
    ['an empty string', ''],
    ['a whitespace string', '   '],
    ['a non-string', 42],
    ['null', null],
  ])('rejects %s as the session id before touching the store', async (_label, sessionId) => {
    const result = await saveOrder(sessionId as unknown as string, {
      status: 'processing',
    });
    expect(result).toEqual({ ok: false, error: 'Unknown order' });
    expect(getManagedStoreMock).not.toHaveBeenCalled();
    expect(updateOrderMock).not.toHaveBeenCalled();
  });

  it('reports an unconfigured store without writing', async () => {
    getManagedStoreMock.mockReturnValue(null);
    const result = await saveOrder(SESSION_ID, { status: 'processing' });
    expect(result).toEqual({ ok: false, error: 'Store not configured' });
    expect(updateOrderMock).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['a scalar', 42],
    ['a string', 'not-fields'],
  ])(
    'degrades a malformed fields transport (%s) to a no-field update',
    async (_label, fields) => {
      const result = await saveOrder(
        SESSION_ID,
        fields as unknown as OrderUpdate
      );
      // Nothing to merge — the transport carried no usable fields, so
      // `updateOrder` sees an empty update rather than a property
      // access crash.
      expect(result).toEqual({ ok: true });
      expect(updateOrderMock).toHaveBeenCalledWith(FAKE_STORE, SESSION_ID, {
        status: undefined,
        trackingId: undefined,
      });
    }
  );

  it("surfaces updateOrder's named rejections verbatim", async () => {
    updateOrderMock.mockRejectedValue(
      new Error('Invalid order status: teleported')
    );
    const result = await saveOrder(SESSION_ID, { status: 'teleported' });
    expect(result).toEqual({
      ok: false,
      error: 'Invalid order status: teleported',
    });
  });

  it('surfaces a non-Error write failure as a named fallback', async () => {
    updateOrderMock.mockRejectedValue('store gone');
    const result = await saveOrder(SESSION_ID, { status: 'processing' });
    expect(result).toEqual({ ok: false, error: 'Unknown write error' });
  });

  it('passes only the operator fields through — the happy-path merge', async () => {
    // A stray field on the transport never reaches the document —
    // the action destructures exactly `status` and `trackingId`.
    const fields = {
      status: 'shipped',
      trackingId: 'TRK-SYNTHETIC-001',
      extra: 'dropped',
    } as unknown as OrderUpdate;
    const result = await saveOrder(SESSION_ID, fields);
    expect(result).toEqual({ ok: true });
    expect(updateOrderMock).toHaveBeenCalledWith(FAKE_STORE, SESSION_ID, {
      status: 'shipped',
      trackingId: 'TRK-SYNTHETIC-001',
    });
  });
});
