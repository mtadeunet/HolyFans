/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior — ... normalization and fallback."
 *
 * Implements ADR 03-004: Model Profiles — the `profile:<slug>`
 * documents are operator-editable SPARSE overlays persisted in the
 * managed store, normalized like every operator-data group: malformed
 * profiles and post-override entries drop out individually, garbage
 * input never throws, and unknown keys are ignored. Profile ids
 * become `/u/<slug>` route segments and rendered `@handle`s, so
 * non-slug-safe and reserved ids reject rather than coerce; overlay
 * post keys must be well-formed `pp-<slug>-<basename>` ids belonging
 * to their own profile — deterministic ids derived from the folder's
 * post files — so foreign or malformed keys drop; `enabled` fails
 * closed to `false`; sparse fields store only usable values.
 * `postIdFor` mints the deterministic id and `parseCaptionSidecar`
 * reads the `[PT]`/`[EN]` sidecar sections. The display name is
 * DERIVED from the slug — `deslugifyProfileName` — never stored.
 *
 * Covers `lib/profiles.ts` — `normalizeProfiles`, `postIdFor`,
 * `parseCaptionSidecar`, `isProfilePostId`, `profilePath`,
 * `deslugifyProfileName`, `profileDisplayName`, `profileDefaults`,
 * `allProfilePosts`, `shuffled`, `findProfilePost` — plus the
 * feature's touchpoints in sibling modules: `lib/likes.ts`'s
 * `baseLikeCountsFor` generic mapper and `parseLikeToggleBody`'s
 * acceptance of well-formed `pp-` ids. The `saveProfile` write path
 * lives with the other Server Action tests in
 * `admin-actions.test.ts`.
 *
 * Identifier hygiene (ADR 00-007): every slug and handle below is
 * synthetic — no real-world identifiers in tracked files.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEED_POSTS } from '@/lib/feed-posts';
import {
  baseLikeCountsFor,
  LIKE_TOKEN_MAX_LENGTH,
  parseLikeToggleBody,
} from '@/lib/likes';
import {
  allProfilePosts,
  deslugifyProfileName,
  findProfilePost,
  isProfilePostId,
  normalizeProfiles,
  parseCaptionSidecar,
  postIdFor,
  PROFILE_POST_ID_MAX_LENGTH,
  PROFILE_POST_ID_PREFIX,
  profileDefaults,
  profileDisplayName,
  profilePath,
  publishedProfilePostPairs,
  publishedProfilePosts,
  RESERVED_PROFILE_SLUGS,
  shuffled,
  type ModelProfile,
} from '@/lib/profiles';

/** One well-formed sparse override entry inside a stored doc's
 *  `posts` Record. */
const rawOverride = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  visible: false,
  likes: 12,
  ...overrides,
});

/** One well-formed raw profile overlay document, pre-normalization. */
const rawProfile = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id: 'model-one',
  enabled: true,
  avatar: '/images/avatars/model-one.png',
  posts: { 'pp-model-one-1': rawOverride() },
  ...overrides,
});

/** An effective `ModelProfile` fixture — the merged shape the routes
 *  and consumers see (filesystem posts + overlay applied). */
const normalizedProfile = (
  overrides: Partial<ModelProfile> = {}
): ModelProfile => ({
  id: 'model-one',
  enabled: true,
  avatar: '/images/avatars/model-one.png',
  posts: [
    {
      id: 'pp-model-one-1',
      media: '/images/profiles/model-one/post-1.png',
      caption: { pt: 'Legenda um', en: 'Caption one' },
      likes: 12,
      visible: true,
    },
  ],
  ...overrides,
});

describe('normalizeProfiles — the sparse overlay documents', () => {
  it.each([undefined, null, 'profiles', 42, true, {}, { profiles: [] }])(
    'returns [] for non-array input %j without throwing',
    (raw) => {
      expect(normalizeProfiles(raw)).toEqual([]);
    }
  );

  it.each([null, 'entry', 42, undefined])(
    'skips non-object entry %j and keeps valid siblings in order',
    (entry) => {
      const first = { ...rawProfile(), id: 'first' };
      const last = { ...rawProfile(), id: 'last' };
      const result = normalizeProfiles([first, entry, last]);
      expect(result.map((profile) => profile.id)).toEqual(['first', 'last']);
    }
  );

  it.each([
    ['missing id', { id: undefined }],
    ['empty-string id', { id: '' }],
    ['non-string id', { id: 7 }],
    ['uppercase id', { id: 'Model-One' }],
    ['id containing a space', { id: 'model one' }],
    ['id containing a dot', { id: 'model.one' }],
    ['id containing an underscore', { id: 'model_one' }],
    ['id with a leading hyphen', { id: '-model-one' }],
  ])(
    'drops a profile with %s — the id is a route segment and @handle',
    (_label, patch) => {
      expect(normalizeProfiles([{ ...rawProfile(), ...patch }])).toEqual([]);
    }
  );

  it.each(RESERVED_PROFILE_SLUGS)(
    'drops the reserved slug %s — platform surface names stay unavailable for handles',
    (slug) => {
      expect(normalizeProfiles([rawProfile({ id: slug })])).toEqual([]);
    }
  );

  it('trims the profile id before validating — surrounding whitespace survives as a clean slug', () => {
    const [profile] = normalizeProfiles([rawProfile({ id: ' model-one ' })]);
    expect(profile.id).toBe('model-one');
  });

  it('drops the later profile on a duplicate id, keeping the first', () => {
    const first = {
      ...rawProfile(),
      id: 'model-one',
      avatar: '/images/first.png',
    };
    const second = {
      ...rawProfile(),
      id: 'model-one',
      avatar: '/images/second.png',
    };
    const result = normalizeProfiles([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0].avatar).toBe('/images/first.png');
  });

  it('treats a trimmed duplicate id as a duplicate', () => {
    const result = normalizeProfiles([
      rawProfile({ id: 'model-one' }),
      rawProfile({ id: '  model-one  ' }),
    ]);
    expect(result).toHaveLength(1);
  });

  it('defaults enabled to false — an uncommitted profile stays unpublished', () => {
    for (const enabled of [undefined, 'yes', 1, null]) {
      const [profile] = normalizeProfiles([{ ...rawProfile(), enabled }]);
      expect(profile.enabled).toBe(false);
    }
  });

  it('keeps an explicit enabled boolean in both directions', () => {
    expect(normalizeProfiles([rawProfile()])[0].enabled).toBe(true);
    expect(normalizeProfiles([rawProfile({ enabled: false })])[0].enabled).toBe(
      false
    );
  });

  it.each([
    [
      'kept for a root-relative path',
      '/images/avatars/a.png',
      '/images/avatars/a.png',
    ],
    ['dropped to "" for a relative path', 'images/avatars/a.png', ''],
    [
      'dropped to "" for a protocol-relative URL',
      '//cdn.example.test/a.png',
      '',
    ],
    ['dropped to "" for an absolute URL', 'https://example.test/a.png', ''],
    ['dropped to "" for a non-string', 42, ''],
    ['dropped to "" when missing', undefined, ''],
  ])('avatar %s', (_label, avatar, expected) => {
    const [profile] = normalizeProfiles([{ ...rawProfile(), avatar }]);
    expect(profile.avatar).toBe(expected);
  });

  it('keeps a profile whose posts field is not an object map, with an empty override map', () => {
    // The overlay posts shape is a Record keyed by post id — arrays
    // (the pre-filesystem posts shape) and scalars yield no
    // overrides.
    for (const posts of [undefined, 'posts', 42, [], ['pp-model-one-1']]) {
      const [profile] = normalizeProfiles([{ ...rawProfile(), posts }]);
      expect(profile.id).toBe('model-one');
      expect(profile.posts).toEqual({});
    }
  });

  it('keeps the sparse override map verbatim — keys are post ids, values carry only changed fields', () => {
    const [profile] = normalizeProfiles([rawProfile()]);
    expect(profile.posts).toEqual({
      'pp-model-one-1': { visible: false, likes: 12 },
    });
  });

  it.each([
    ['a FEED_POSTS-style id without the pp- prefix', 'post-hero'],
    ['a well-formed pp- id of another profile', 'pp-model-two-1'],
    ['the bare pp- prefix', 'pp-'],
    ['a pp- id missing its basename', 'pp-model-one'],
    ['uppercase in the key', 'pp-Model-One-1'],
    ['a space in the key', 'pp-model-one 1'],
    [
      'a key over the length cap',
      PROFILE_POST_ID_PREFIX +
        'a'.repeat(
          PROFILE_POST_ID_MAX_LENGTH - PROFILE_POST_ID_PREFIX.length + 1
        ),
    ],
  ])(
    'drops an override keyed %s — only this profile\'s deterministic ids can merge',
    (_label, key) => {
      const [profile] = normalizeProfiles([
        rawProfile({
          posts: {
            [key]: rawOverride(),
            'pp-model-one-2': rawOverride({ visible: true }),
          },
        }),
      ]);
      expect(Object.keys(profile.posts)).toEqual(['pp-model-one-2']);
    }
  );

  it.each([null, 'post', 42, undefined, true])(
    'drops a non-object override value %j and keeps valid siblings',
    (value) => {
      const [profile] = normalizeProfiles([
        rawProfile({
          posts: {
            'pp-model-one-1': rawOverride(),
            'pp-model-one-2': value,
          },
        }),
      ]);
      expect(Object.keys(profile.posts)).toEqual(['pp-model-one-1']);
    }
  );

  it('drops an override that normalizes to no usable field', () => {
    const [profile] = normalizeProfiles([
      rawProfile({
        posts: {
          'pp-model-one-1': { visible: 'yes', likes: 'many', stray: 1 },
        },
      }),
    ]);
    expect(profile.posts).toEqual({});
  });

  it.each([
    ['keeps an explicit false', false, false],
    ['keeps an explicit true', true, true],
    ['drops a non-boolean string', 'yes', undefined],
    ['drops null', null, undefined],
    ['drops a number', 0, undefined],
  ])('override visible: %s', (_label, visible, expected) => {
    const [profile] = normalizeProfiles([
      rawProfile({
        posts: { 'pp-model-one-1': rawOverride({ visible }) },
      }),
    ]);
    const override = profile.posts['pp-model-one-1'];
    if (expected === undefined) {
      expect(override?.visible).toBeUndefined();
    } else {
      expect(override?.visible).toBe(expected);
    }
  });

  it.each([
    ['keeps a positive integer', 12, 12],
    ['keeps zero', 0, 0],
    ['clamps a negative to 0', -3, 0],
    ['floors a float', 4.9, 4],
    ['drops a numeric string', '5', undefined],
    ['drops NaN', Number.NaN, undefined],
    ['drops Infinity', Number.POSITIVE_INFINITY, undefined],
  ])('override likes: %s', (_label, likes, expected) => {
    const [profile] = normalizeProfiles([
      rawProfile({
        posts: { 'pp-model-one-1': rawOverride({ likes }) },
      }),
    ]);
    const override = profile.posts['pp-model-one-1'];
    if (expected === undefined) {
      expect(override?.likes).toBeUndefined();
    } else {
      expect(override?.likes).toBe(expected);
    }
  });

  it('normalizes an object caption override and omits caption for anything else', () => {
    const [withCaption] = normalizeProfiles([
      rawProfile({
        posts: {
          'pp-model-one-1': {
            caption: { pt: 'Legenda', en: 42 },
          },
        },
      }),
    ]);
    expect(withCaption.posts['pp-model-one-1'].caption).toEqual({
      pt: 'Legenda',
      en: '',
    });

    for (const caption of ['text', 42, null]) {
      const [profile] = normalizeProfiles([
        rawProfile({
          posts: {
            'pp-model-one-1': rawOverride({ caption, likes: 3 }),
          },
        }),
      ]);
      expect('caption' in profile.posts['pp-model-one-1']).toBe(false);
    }
  });

  it('normalizes an object alt override and omits alt for anything else', () => {
    const [withAlt] = normalizeProfiles([
      rawProfile({
        posts: {
          'pp-model-one-1': { alt: { pt: 'Texto alt' } },
        },
      }),
    ]);
    expect(withAlt.posts['pp-model-one-1'].alt).toEqual({
      pt: 'Texto alt',
      en: '',
    });

    for (const alt of [undefined, 'Texto alt', 42]) {
      const [profile] = normalizeProfiles([
        rawProfile({
          posts: { 'pp-model-one-1': rawOverride({ alt, likes: 1 }) },
        }),
      ]);
      expect('alt' in profile.posts['pp-model-one-1']).toBe(false);
    }
  });

  it('ignores unknown keys at profile, override, and localized-text level', () => {
    const [profile] = normalizeProfiles([
      {
        ...rawProfile(),
        unexpected: 'ignored',
        posts: {
          'pp-model-one-1': {
            likes: 7,
            extraPostKey: true,
            caption: { pt: 'Legenda um', en: 'Caption one', fr: 'Légende' },
          },
        },
      },
    ]);
    expect(profile).toEqual({
      id: 'model-one',
      enabled: true,
      avatar: '/images/avatars/model-one.png',
      posts: {
        'pp-model-one-1': {
          likes: 7,
          caption: { pt: 'Legenda um', en: 'Caption one' },
        },
      },
    });
  });
});

describe('postIdFor — the deterministic file-derived id', () => {
  it('mints pp-<slug>-<basename>', () => {
    expect(postIdFor('model-one', 'post-1')).toBe('pp-model-one-post-1');
    expect(postIdFor('a', 'b')).toBe('pp-a-b');
  });

  it('produces ids isProfilePostId accepts for slug-safe inputs', () => {
    expect(isProfilePostId(postIdFor('model-one', 'fatima-03-4k'))).toBe(true);
  });
});

describe('parseCaptionSidecar — the <basename>.txt sections', () => {
  it('returns {pt:"",en:""} for empty and headerless text', () => {
    expect(parseCaptionSidecar('')).toEqual({ pt: '', en: '' });
    expect(parseCaptionSidecar('just some text\nmore text')).toEqual({
      pt: '',
      en: '',
    });
  });

  it('collects single- and multi-line text under [PT] and [EN]', () => {
    const text = '[PT]\nLinha um\nLinha dois\n\n[EN]\nLine one';
    expect(parseCaptionSidecar(text)).toEqual({
      pt: 'Linha um\nLinha dois',
      en: 'Line one',
    });
  });

  it('preserves interior blank lines but trims trailing blank lines', () => {
    const text = '[PT]\nLinha um\n\n\nLinha dois\n\n\n';
    expect(parseCaptionSidecar(text).pt).toBe('Linha um\n\n\nLinha dois');
  });

  it('tolerates CRLF line endings identically to LF', () => {
    const text = '[PT]\r\nLinha um\r\n\r\n[EN]\r\nLine one\r\n';
    expect(parseCaptionSidecar(text)).toEqual({
      pt: 'Linha um',
      en: 'Line one',
    });
  });

  it('strips a leading UTF-8 BOM before parsing — a BOM-prefixed [PT] header still matches', () => {
    const text = '\uFEFF[PT]\nLinha um\n[EN]\nLine one';
    expect(parseCaptionSidecar(text)).toEqual({
      pt: 'Linha um',
      en: 'Line one',
    });
  });

  it('yields "" for a missing section', () => {
    expect(parseCaptionSidecar('[PT]\nSó português')).toEqual({
      pt: 'Só português',
      en: '',
    });
    expect(parseCaptionSidecar('[EN]\nEnglish only')).toEqual({
      pt: '',
      en: 'English only',
    });
  });

  it('accepts lowercase and whitespace-padded section headers', () => {
    const text = '  [pt]  \nLinha\n[En]\nLine';
    expect(parseCaptionSidecar(text)).toEqual({
      pt: 'Linha',
      en: 'Line',
    });
  });

  it('pauses collection under a foreign [X] header until a known one appears', () => {
    const text = '[PT]\nLinha um\n[NOTES]\noperator note\n[EN]\nLine one';
    expect(parseCaptionSidecar(text)).toEqual({
      pt: 'Linha um',
      en: 'Line one',
    });
  });

  it('a later duplicate header appends to the same section', () => {
    const text = '[PT]\nUm\n[EN]\nOne\n[PT]\nDois';
    expect(parseCaptionSidecar(text)).toEqual({ pt: 'Um\nDois', en: 'One' });
  });

  it('a section of only blank lines yields ""', () => {
    expect(parseCaptionSidecar('[PT]\n\n   \n\n')).toEqual({
      pt: '',
      en: '',
    });
  });
});

describe('isProfilePostId', () => {
  it.each(['pp-model-one-1', 'pp-9', 'pp-a', 'pp-model-one-fatima-03-4k'])(
    'accepts the well-formed pp- id %s',
    (id) => {
      expect(isProfilePostId(id)).toBe(true);
    }
  );

  it('accepts an id exactly at the length cap', () => {
    const id =
      PROFILE_POST_ID_PREFIX +
      'a'.repeat(PROFILE_POST_ID_MAX_LENGTH - PROFILE_POST_ID_PREFIX.length);
    expect(id).toHaveLength(PROFILE_POST_ID_MAX_LENGTH);
    expect(isProfilePostId(id)).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['a FEED_POSTS-style id', 'post-hero'],
    ['a non-pp- slug', 'model-one'],
    ['the prefix without the hyphen', 'ppmodel-one'],
    ['a pp- lookalike without the prefix at position 0', 'app-model-one'],
    ['the bare prefix', 'pp-'],
    ['an uppercase remainder', 'pp-Model'],
    ['a hyphen-leading remainder', 'pp--one'],
    ['a remainder with a space', 'pp-model one'],
    ['a remainder with an underscore', 'pp-model_one'],
    [
      'an id over the length cap',
      PROFILE_POST_ID_PREFIX +
        'a'.repeat(
          PROFILE_POST_ID_MAX_LENGTH - PROFILE_POST_ID_PREFIX.length + 1
        ),
    ],
  ])('rejects %s', (_label, id) => {
    expect(isProfilePostId(id)).toBe(false);
  });
});

describe('profilePath', () => {
  it('builds the locale-stripped /u/<slug> route path', () => {
    expect(profilePath('model-one')).toBe('/u/model-one');
    expect(profilePath('a')).toBe('/u/a');
  });
});

// Implements ADR 03-004: the folder-default overlay — a bare
// `public/images/profiles/<slug>/` folder publishes with
// `{enabled: true, avatar: '', posts: {}}`, one shared definition the
// server read and the console draft both consume.
describe('profileDefaults', () => {
  it('returns the publish-by-default overlay for a bare folder', () => {
    expect(profileDefaults('model-one')).toEqual({
      id: 'model-one',
      enabled: true,
      avatar: '',
      posts: {},
    });
  });

  it('returns a fresh posts map per call — defaults never share mutable state', () => {
    const first = profileDefaults('model-one');
    const second = profileDefaults('model-one');
    expect(first.posts).not.toBe(second.posts);
  });
});

// Implements ADR 03-004: the display name is DERIVED from the slug —
// never stored: hyphens become word separators and each word is
// capitalized, so the folder name alone produces the rendered name.
describe('deslugifyProfileName', () => {
  it.each([
    ['a two-word slug', 'model-one', 'Model One'],
    ['a single-word slug', 'model', 'Model'],
    ['digits kept verbatim', 'model-2', 'Model 2'],
    ['a three-word slug', 'ana-maria-silva', 'Ana Maria Silva'],
  ])('derives the display name from %s', (_label, slug, expected) => {
    expect(deslugifyProfileName(slug)).toBe(expected);
  });

  it('drops empty words rather than doubling spaces', () => {
    // `a--b` is slug-regex-conformant (interior hyphen runs are legal)
    // — the derive must not render a doubled space.
    expect(deslugifyProfileName('a--b')).toBe('A B');
  });

  it('returns "" for an empty slug', () => {
    expect(deslugifyProfileName('')).toBe('');
  });
});

describe('profileDisplayName', () => {
  it('derives the display name from the profile id', () => {
    expect(profileDisplayName(normalizedProfile({ id: 'model-two' }))).toBe(
      'Model Two'
    );
  });
});

describe('allProfilePosts', () => {
  it('flattens every profile post in profile order, then filename order', () => {
    const profiles: ModelProfile[] = [
      normalizedProfile({
        posts: [
          {
            id: 'pp-model-one-1',
            media: '/images/profiles/model-one/a.jpg',
            caption: { pt: '', en: '' },
            likes: 0,
            visible: true,
          },
          {
            id: 'pp-model-one-2',
            media: '/images/profiles/model-one/b.jpg',
            caption: { pt: '', en: '' },
            likes: 0,
            visible: true,
          },
        ],
      }),
      normalizedProfile({
        id: 'model-two',
        enabled: false,
        posts: [
          {
            id: 'pp-model-two-1',
            media: '/images/profiles/model-two/a.jpg',
            caption: { pt: '', en: '' },
            likes: 0,
            visible: true,
          },
        ],
      }),
    ];
    expect(allProfilePosts(profiles).map((post) => post.id)).toEqual([
      'pp-model-one-1',
      'pp-model-one-2',
      'pp-model-two-1',
    ]);
  });

  it('returns [] for no profiles and skips postless profiles', () => {
    expect(allProfilePosts([])).toEqual([]);
    expect(allProfilePosts([normalizedProfile({ posts: [] })])).toEqual([]);
  });
});

// Implements ADR 03-004: the published post domain — a post renders
// and accepts likes only while its profile is enabled and the post
// itself is visible. `publishedProfilePosts` is the flat list the
// like counter serves and toggles; `publishedProfilePostPairs` keeps
// each post's owning profile attached for the landing feed's shuffled
// tail.
describe('publishedProfilePosts / publishedProfilePostPairs — the published post domain', () => {
  /** One effective post fixture — baseline flags unless overridden. */
  const post = (
    id: string,
    overrides: Partial<ModelProfile['posts'][number]> = {}
  ): ModelProfile['posts'][number] => ({
    id,
    media: `/images/profiles/x/${id}.jpg`,
    caption: { pt: '', en: '' },
    likes: 0,
    visible: true,
    ...overrides,
  });

  const profiles = (): ModelProfile[] => [
    normalizedProfile({
      id: 'model-one',
      posts: [
        post('pp-model-one-1'),
        post('pp-model-one-2', { visible: false }),
      ],
    }),
    normalizedProfile({
      id: 'model-two',
      enabled: false,
      posts: [post('pp-model-two-1')],
    }),
    normalizedProfile({
      id: 'model-three',
      posts: [post('pp-model-three-1'), post('pp-model-three-2')],
    }),
  ];

  it('returns enabled profiles\' visible posts only, in profile order then filename order', () => {
    expect(publishedProfilePosts(profiles()).map((entry) => entry.id)).toEqual([
      'pp-model-one-1',
      'pp-model-three-1',
      'pp-model-three-2',
    ]);
  });

  it('keeps each post\'s owning profile attached in the pairs view', () => {
    expect(
      publishedProfilePostPairs(profiles()).map(
        ({ profile, post: entry }) => `${profile.id}:${entry.id}`
      )
    ).toEqual([
      'model-one:pp-model-one-1',
      'model-three:pp-model-three-1',
      'model-three:pp-model-three-2',
    ]);
  });

  it('returns [] when nothing publishes — no profiles, none enabled, none visible', () => {
    expect(publishedProfilePosts([])).toEqual([]);
    expect(publishedProfilePostPairs([])).toEqual([]);
    expect(
      publishedProfilePosts([
        normalizedProfile({
          enabled: false,
          posts: [post('pp-model-one-1')],
        }),
        normalizedProfile({
          posts: [post('pp-model-three-1', { visible: false })],
        }),
      ])
    ).toEqual([]);
  });
});

describe('findProfilePost', () => {
  const profiles: ModelProfile[] = [
    normalizedProfile({
      posts: [
        {
          id: 'pp-model-one-1',
          media: '/images/profiles/model-one/a.jpg',
          caption: { pt: '', en: '' },
          likes: 5,
          visible: true,
        },
      ],
    }),
    normalizedProfile({
      id: 'model-two',
      posts: [
        {
          id: 'pp-model-two-1',
          media: '/images/profiles/model-two/two.png',
          caption: { pt: '', en: '' },
          likes: 3,
          visible: true,
        },
      ],
    }),
  ];

  it('finds a post on any profile and returns the effective post object', () => {
    expect(findProfilePost(profiles, 'pp-model-one-1')?.likes).toBe(5);
    const found = findProfilePost(profiles, 'pp-model-two-1');
    expect(found).not.toBeNull();
    expect(found?.media).toBe('/images/profiles/model-two/two.png');
  });

  it('finds a post on a disabled profile — like-store existence is publish-state agnostic', () => {
    const disabled = [normalizedProfile({ enabled: false })];
    expect(findProfilePost(disabled, 'pp-model-one-1')?.id).toBe(
      'pp-model-one-1'
    );
  });

  it.each([['pp-model-nine-9'], [''], ['post-hero'], ['pp-']])(
    'returns null for unknown or malformed id %s',
    (postId) => {
      expect(findProfilePost(profiles, postId)).toBeNull();
    }
  );

  it('returns null when there are no profiles', () => {
    expect(findProfilePost([], 'pp-model-one-1')).toBeNull();
  });
});

// Implements ADR 03-004: profile posts share the like counter's
// base+delta semantics with FEED_POSTS — the generic mapper serves both
// domains' `{postId: base}` maps through one path.
describe('baseLikeCountsFor', () => {
  it('maps any {id, likes} list to the authored-base record', () => {
    const posts = [
      { id: 'pp-model-one-1', likes: 3 },
      { id: 'pp-model-two-1', likes: 7 },
      { id: 'post-hero', likes: 10 },
    ];
    expect(baseLikeCountsFor(posts)).toEqual({
      'pp-model-one-1': 3,
      'pp-model-two-1': 7,
      'post-hero': 10,
    });
  });

  it('returns {} for an empty list', () => {
    expect(baseLikeCountsFor([])).toEqual({});
  });
});

// Implements ADR 03-004: `pp-` profile post ids are valid like-toggle
// targets — a well-formed id may mint a managed-store key (existence as
// a real derived folder post is the Route Handler's separate check);
// arbitrary strings still may not.
describe('parseLikeToggleBody — pp- post ids (ADR 03-004)', () => {
  const valid = {
    postId: 'pp-model-one-1',
    token: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    liked: true,
  };

  it('accepts a well-formed toggle body naming a pp- profile post', () => {
    expect(parseLikeToggleBody(valid)).toEqual(valid);
    expect(parseLikeToggleBody({ ...valid, liked: false })).toEqual({
      ...valid,
      liked: false,
    });
  });

  it('still accepts a real FEED_POSTS id alongside pp- ids', () => {
    for (const post of FEED_POSTS) {
      expect(parseLikeToggleBody({ ...valid, postId: post.id })).not.toBeNull();
    }
  });

  it.each([
    ['post-hero-nine'],
    ['pp-'],
    ['pp-Model'],
    ['pp--one'],
    ['ppmodel-one'],
    [''],
    [
      PROFILE_POST_ID_PREFIX +
        'a'.repeat(
          PROFILE_POST_ID_MAX_LENGTH - PROFILE_POST_ID_PREFIX.length + 1
        ),
    ],
  ])(
    'rejects postId %s — only FEED_POSTS ids and well-formed pp- ids may name store keys',
    (postId) => {
      expect(parseLikeToggleBody({ ...valid, postId })).toBeNull();
    }
  );

  it('still enforces token and liked validation on a pp- postId', () => {
    expect(parseLikeToggleBody({ ...valid, token: '' })).toBeNull();
    expect(
      parseLikeToggleBody({
        ...valid,
        token: 'x'.repeat(LIKE_TOKEN_MAX_LENGTH + 1),
      })
    ).toBeNull();
    expect(parseLikeToggleBody({ ...valid, token: 42 })).toBeNull();
    expect(parseLikeToggleBody({ ...valid, liked: 'true' })).toBeNull();
    expect(parseLikeToggleBody({ ...valid, liked: 1 })).toBeNull();
  });
});

// Implements ADR 03-004: the landing feed's appended profile-post tail
// is shuffled per request — a Fisher–Yates pass on a copy, so callers
// keep their derived order (the `/u/<slug>` route and `allProfilePosts`
// are unshuffled domains) and each call draws an independent
// `Math.random()` permutation.
describe('shuffled', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a permutation — same elements and length in a new array', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffled(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort((a, b) => a - b)).toEqual(
      [...input].sort((a, b) => a - b)
    );
    expect(result).not.toBe(input);
  });

  it('never mutates the input — callers keep their derived order', () => {
    const input = [3, 1, 4, 1, 5, 9, 2, 6];
    const snapshot = [...input];
    shuffled(input);
    expect(input).toEqual(snapshot);
  });

  it('returns [] for an empty array', () => {
    expect(shuffled([])).toEqual([]);
  });

  it('returns the single element for a one-item array', () => {
    expect(shuffled(['only'])).toEqual(['only']);
  });

  it('draws each swap index from Math.random — a forced sequence yields a known permutation', () => {
    // Fisher–Yates on [1,2,3,4] with draws 0.5, 0, 0.9:
    //   i=3: j=floor(0.5*4)=2 → swap positions 3,2 → [1,2,4,3]
    //   i=2: j=floor(0*3)=0   → swap positions 2,0 → [4,2,1,3]
    //   i=1: j=floor(0.9*2)=1 → self-swap          → [4,2,1,3]
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.9);
    expect(shuffled([1, 2, 3, 4])).toEqual([4, 2, 1, 3]);
  });

  it('produces varied orderings across calls — the tail never renders in one fixed order', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(shuffled([1, 2, 3]).join(','));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
