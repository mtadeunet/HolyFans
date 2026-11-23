/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 03-004: Model Profiles — a profile exists iff its
 * `public/images/profiles/<slug>/` folder exists: the filesystem is
 * the profile set AND the post set — every image file whose basename
 * does not start with `profile` is a post, id `pp-<slug>-<basename>`,
 * captioned by the sibling `<basename>.txt` sidecar's `[PT]`/`[EN]`
 * sections, ordered by filename — while the managed store's
 * `profile:<slug>` documents carry only the SPARSE overlay
 * `{enabled, avatar, posts: Record<postId, override>}` merged onto
 * the derived baseline at read. A folder without a document resolves
 * to `{enabled: true, avatar: '', posts: {}}` (every derived post
 * visible at baseline); an `avatar` of `''` resolves to the folder's
 * profile image — the first sorted `profile*` file, else the first
 * sorted image file; the write is a single `SET` gated on the
 * folder's existence.
 *
 * Covers `lib/profiles-server.ts`: `listProfileFolders`,
 * `listProfileImages`, `listProfilePostFiles`, `readCaptionSidecar`,
 * `deriveProfilePosts`, the folder-truth `readProfiles`/`readProfile`
 * (defaults, overlay merge, avatar fallback, corrupt-document drop,
 * not-found surface), and `writeProfile`'s folder gate and document
 * shape. The Redis client is faked at the `store` parameter and
 * `fs/promises` is faked at the module boundary; parsing and
 * normalization run for real through `lib/profiles.ts`.
 *
 * Identifier hygiene (ADR 00-007): every slug below is synthetic — no
 * real-world identifiers in tracked files.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from '@upstash/redis';
import path from 'path';
import type { ProfileOverlay } from '@/lib/profiles';
import {
  deriveProfilePosts,
  listProfileFolders,
  listProfileImages,
  listProfilePostFiles,
  PROFILE_KEY,
  readCaptionSidecar,
  readProfile,
  readProfiles,
  writeProfile,
} from '@/lib/profiles-server';

/**
 * `fs/promises` is faked at the module boundary — the module's only
 * filesystem dependency — so the folder-truth reads, the post-file
 * enumeration, the sidecar reads, and the avatar fallback run against
 * synthetic trees. `readdir` backs enumeration (`listProfileFolders`,
 * `listProfileImages`, `listProfilePostFiles`), `lstat` backs the
 * single existence predicate (`profileFolderExists`), and `readFile`
 * backs the caption sidecars.
 */
const { readdirMock, lstatMock, readFileMock } = vi.hoisted(() => ({
  readdirMock: vi.fn(),
  lstatMock: vi.fn(),
  readFileMock: vi.fn(),
}));
vi.mock('fs/promises', () => ({
  readdir: readdirMock,
  lstat: lstatMock,
  readFile: readFileMock,
}));

/** The profiles imagery root the module reads — the profile set. */
const PROFILES_ROOT = path.join(process.cwd(), 'public', 'images', 'profiles');

/** A minimal `Dirent` stand-in for a directory entry. */
const dirEntry = (name: string) => ({
  name,
  isDirectory: () => true,
  isFile: () => false,
});

/** A minimal `Dirent` stand-in for a regular-file entry. */
const fileEntry = (name: string) => ({
  name,
  isDirectory: () => false,
  isFile: () => true,
});

/**
 * Install a synthetic profiles tree: `folders` maps each folder name
 * to its file names. The root listing also returns a stray file, a
 * non-slug directory, and a `RESERVED_PROFILE_SLUGS` directory, and
 * returns folders in reverse-sorted order so tests prove the module's
 * own filtering and sort. `lstat` answers `isDirectory() === true`
 * only for the declared folders — every other path throws ENOENT like
 * a real lookup. `readFile` serves `sidecars` content keyed by
 * `<slug>/<file>` — a lookup miss throws ENOENT like a missing
 * sidecar.
 *
 * @param folders - Folder name → contained file names.
 * @param sidecars - `<slug>/<file>` → file content (the `.txt`
 *   caption sidecars).
 */
function mockFsTree(
  folders: Record<string, string[]>,
  sidecars: Record<string, string> = {}
): void {
  readdirMock.mockImplementation(async (dir: string) => {
    if (dir === PROFILES_ROOT) {
      return [
        ...Object.keys(folders).reverse().map(dirEntry),
        fileEntry('stray.png'),
        dirEntry('NOT A SLUG'),
        dirEntry('admin'),
      ];
    }
    if (dir.startsWith(`${PROFILES_ROOT}${path.sep}`)) {
      const slug = path.basename(dir);
      if (folders[slug] !== undefined) {
        return folders[slug].map(fileEntry);
      }
    }
    throw new Error(`ENOENT: no such file or directory, scandir '${dir}'`);
  });
  lstatMock.mockImplementation(async (target: string) => {
    const slug = path.basename(target);
    if (
      target.startsWith(`${PROFILES_ROOT}${path.sep}`) &&
      folders[slug] !== undefined
    ) {
      return { isDirectory: () => true };
    }
    throw new Error(`ENOENT: no such file or directory, stat '${target}'`);
  });
  readFileMock.mockImplementation(async (target: string) => {
    const key = path.relative(PROFILES_ROOT, target);
    if (sidecars[key] !== undefined) {
      return sidecars[key];
    }
    throw new Error(`ENOENT: no such file or directory, open '${target}'`);
  });
}

/**
 * A well-formed stored `profile:<slug>` SPARSE overlay document — the
 * raw record shape before normalization (`{enabled, avatar, posts}`
 * where `posts` maps post ids to overrides; the slug is the key,
 * never stored).
 *
 * @param overrides - Fields to replace on the base document.
 * @returns The raw stored document.
 */
function profileDoc(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    avatar: '/images/profiles/model-one/avatar.png',
    posts: {
      'pp-model-one-post-1': {
        caption: { pt: 'Legenda um', en: 'Caption one' },
        likes: 12,
        visible: false,
      },
    },
    ...overrides,
  };
}

/** A normalized overlay for `writeProfile` inputs. */
function overlay(overrides: Partial<ProfileOverlay> = {}): ProfileOverlay {
  return {
    id: 'model-one',
    enabled: true,
    avatar: '/images/profiles/model-one/avatar.png',
    posts: {},
    ...overrides,
  };
}

/**
 * A fake `pipeline()` for `readProfiles`: records every pipelined GET
 * key and answers the queued documents in order.
 *
 * @param docs - The values `exec()` resolves, in `get` order.
 */
function makePipeline(docs: unknown[]) {
  const pipeline = {
    keys: [] as string[],
    get: vi.fn((key: string) => {
      pipeline.keys.push(key);
      return pipeline;
    }),
    exec: vi.fn(async () => docs),
  };
  return pipeline;
}

/**
 * A fake managed store exposing only the commands the module uses.
 *
 * @param overrides - Command replacements per case.
 */
function makeStore(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    pipeline: vi.fn(() => makePipeline([])),
    ...overrides,
  } as unknown as Redis & {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    pipeline: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => {
  readdirMock.mockReset();
  lstatMock.mockReset();
  readFileMock.mockReset();
});

describe('listProfileFolders — the filesystem profile set (ADR 03-004)', () => {
  it('returns slug-regex directories sorted alphabetically — files and non-slug names drop', async () => {
    mockFsTree({ 'model-two': [], 'model-one': [] });
    expect(await listProfileFolders()).toEqual(['model-one', 'model-two']);
  });

  it('filters reserved slugs — an `admin`-style folder can never be a profile', async () => {
    // The synthetic tree always carries an `admin` directory; the
    // reserved-slug filter keeps it (and every reserved name) out of
    // the enumeration — and so out of the admin selector.
    mockFsTree({ 'model-one': [] });
    expect(await listProfileFolders()).toEqual(['model-one']);
    expect(await listProfileFolders()).not.toContain('admin');
  });

  it('returns [] when the profiles root is missing — no folders, no profiles', async () => {
    readdirMock.mockRejectedValue(new Error('ENOENT'));
    expect(await listProfileFolders()).toEqual([]);
  });
});

describe('listProfileImages — the avatar pick list (ADR 03-004)', () => {
  it('returns sorted /images/profiles/<slug>/ paths for image files only', async () => {
    mockFsTree({
      'model-one': ['b.PNG', 'a.jpg', 'notes.txt', 'c.webp'],
    });
    // Non-image files drop; extension casing is ignored; the result
    // is the sorted pick list the avatar fallback and the picker use.
    expect(await listProfileImages('model-one')).toEqual([
      '/images/profiles/model-one/a.jpg',
      '/images/profiles/model-one/b.PNG',
      '/images/profiles/model-one/c.webp',
    ]);
  });

  it('returns [] for a missing folder and for non-slug input — no filesystem escape', async () => {
    mockFsTree({});
    expect(await listProfileImages('gone')).toEqual([]);
    expect(await listProfileImages('../secrets')).toEqual([]);
    expect(readdirMock).not.toHaveBeenCalledWith(
      expect.stringContaining('secrets'),
      expect.anything()
    );
  });
});

describe('listProfilePostFiles — the filesystem post set (ADR 03-004)', () => {
  it('returns sorted image filenames minus `profile*` basenames and non-images', async () => {
    mockFsTree({
      'model-one': [
        'b.PNG',
        'a.jpg',
        'a.txt',
        'profile-01.jpg',
        'PROFILE.png',
        'notes.txt',
        'c.webp',
      ],
    });
    // `.txt` sidecars and any non-image file drop; `profile*` files —
    // the avatar convention, matched case-insensitively on the
    // basename — are never posts.
    expect(await listProfilePostFiles('model-one')).toEqual([
      'a.jpg',
      'b.PNG',
      'c.webp',
    ]);
  });

  it('skips image files whose basename stem is not slug-safe — filename is post identity', async () => {
    mockFsTree({
      'model-one': [
        'My Photo.jpg',
        'a.b.jpg',
        'with space.png',
        'UPPER.webp',
        'ok-post.jpg',
      ],
    });
    // The stem mints `pp-<slug>-<basename>` and names the sidecar, so
    // it must satisfy PROFILE_SLUG_REGEX like a slug: a file whose
    // stem is not slug-safe is never enumerated, never rendered, and
    // never reaches the admin.
    expect(await listProfilePostFiles('model-one')).toEqual(['ok-post.jpg']);
  });

  it('dedupes cross-extension stem collisions — the first sorted file wins', async () => {
    mockFsTree({
      'model-one': ['a.png', 'a.jpg', 'b.webp', 'b.png'],
    });
    // `a.jpg` and `a.png` would both mint `pp-model-one-a` — one stem
    // carries one post: deterministic first-sorted-wins, the second
    // file under the stem is not a post.
    expect(await listProfilePostFiles('model-one')).toEqual([
      'a.jpg',
      'b.png',
    ]);
  });

  it('returns [] for a missing folder and for non-slug input — no filesystem escape', async () => {
    mockFsTree({});
    expect(await listProfilePostFiles('gone')).toEqual([]);
    expect(await listProfilePostFiles('../secrets')).toEqual([]);
  });
});

describe('readCaptionSidecar — the <basename>.txt sections (ADR 03-004)', () => {
  it('parses the [PT] and [EN] sections of a real sidecar', async () => {
    mockFsTree(
      { 'model-one': ['post-1.jpg', 'post-1.txt'] },
      {
        'model-one/post-1.txt':
          '[PT]\nLegenda um\nLinha dois\n\n[EN]\nCaption one\n',
      }
    );
    expect(await readCaptionSidecar('model-one', 'post-1')).toEqual({
      pt: 'Legenda um\nLinha dois',
      en: 'Caption one',
    });
  });

  it('tolerates CRLF files identically to LF', async () => {
    mockFsTree(
      { 'model-one': ['post-1.jpg', 'post-1.txt'] },
      {
        'model-one/post-1.txt': '[PT]\r\nLegenda\r\n\r\n[EN]\r\nCaption\r\n',
      }
    );
    expect(await readCaptionSidecar('model-one', 'post-1')).toEqual({
      pt: 'Legenda',
      en: 'Caption',
    });
  });

  it('parses a sidecar saved with a UTF-8 BOM — the BOM is stripped before parsing', async () => {
    mockFsTree(
      { 'model-one': ['post-1.jpg', 'post-1.txt'] },
      {
        'model-one/post-1.txt': '\uFEFF[PT]\nLegenda\n[EN]\nCaption\n',
      }
    );
    expect(await readCaptionSidecar('model-one', 'post-1')).toEqual({
      pt: 'Legenda',
      en: 'Caption',
    });
  });

  it('yields empty Locales for a missing sidecar — the post still exists', async () => {
    mockFsTree({ 'model-one': ['post-1.jpg'] });
    expect(await readCaptionSidecar('model-one', 'post-1')).toEqual({
      pt: '',
      en: '',
    });
  });

  it('yields empty Locales for a non-slug input and a separator-carrying basename — no filesystem escape', async () => {
    mockFsTree({ 'model-one': [] });
    expect(await readCaptionSidecar('../secrets', 'post-1')).toEqual({
      pt: '',
      en: '',
    });
    expect(await readCaptionSidecar('model-one', '../post-1')).toEqual({
      pt: '',
      en: '',
    });
    expect(readFileMock).not.toHaveBeenCalled();
  });
});

describe('deriveProfilePosts — the filesystem baseline (ADR 03-004)', () => {
  it('derives one post per post file — deterministic id, media path, sidecar caption, baseline flags', async () => {
    mockFsTree(
      {
        'model-one': [
          'b-post.jpg',
          'a-post.jpg',
          'a-post.txt',
          'profile-01.jpg',
        ],
      },
      {
        'model-one/a-post.txt': '[PT]\nLegenda\n\n[EN]\nCaption\n',
      }
    );
    expect(await deriveProfilePosts('model-one')).toEqual([
      {
        id: 'pp-model-one-a-post',
        media: '/images/profiles/model-one/a-post.jpg',
        caption: { pt: 'Legenda', en: 'Caption' },
        likes: 0,
        visible: true,
      },
      {
        id: 'pp-model-one-b-post',
        media: '/images/profiles/model-one/b-post.jpg',
        caption: { pt: '', en: '' },
        likes: 0,
        visible: true,
      },
    ]);
  });

  it('returns [] for a missing folder and for non-slug input', async () => {
    mockFsTree({});
    expect(await deriveProfilePosts('gone')).toEqual([]);
    expect(await deriveProfilePosts('../x')).toEqual([]);
  });

  it('never derives a post from a non-slug-safe filename — enumeration is the gate', async () => {
    mockFsTree({ 'model-one': ['My Photo.jpg', 'ok.jpg'] });
    expect(
      (await deriveProfilePosts('model-one')).map((post) => post.id)
    ).toEqual(['pp-model-one-ok']);
  });

  it('captions: false skips every sidecar read — empty captions, no readFile', async () => {
    mockFsTree(
      { 'model-one': ['a.jpg', 'a.txt', 'b.jpg'] },
      { 'model-one/a.txt': '[PT]\nLegenda\n[EN]\nCaption\n' }
    );
    const posts = await deriveProfilePosts('model-one', { captions: false });
    // Consumers that never render captions (the like counter) skip the
    // per-post `readFile` entirely; the posts still exist, captionless.
    expect(posts.map((post) => post.caption)).toEqual([
      { pt: '', en: '' },
      { pt: '', en: '' },
    ]);
    expect(readFileMock).not.toHaveBeenCalled();
  });
});

describe('readProfiles — folder enumeration over stored overlays (ADR 03-004)', () => {
  it('returns [] without opening a pipeline when no folder exists', async () => {
    mockFsTree({});
    const store = makeStore();
    expect(await readProfiles(store)).toEqual([]);
    expect(store.pipeline).not.toHaveBeenCalled();
  });

  it('reads one profile:<slug> GET per folder in alphabetical order', async () => {
    mockFsTree({ 'model-two': ['a.png'], 'model-one': ['a.png'] });
    const pipeline = makePipeline([
      JSON.stringify(profileDoc({ posts: {} })),
      JSON.stringify(profileDoc({ enabled: false, posts: {} })),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const profiles = await readProfiles(store);
    expect(profiles.map((entry) => entry.id)).toEqual([
      'model-one',
      'model-two',
    ]);
    expect(pipeline.keys).toEqual([
      PROFILE_KEY('model-one'),
      PROFILE_KEY('model-two'),
    ]);
    expect(profiles[1].enabled).toBe(false);
  });

  it('accepts a document the SDK already deserialized into an object', async () => {
    mockFsTree({ 'model-one': ['post-1.jpg'] });
    const pipeline = makePipeline([profileDoc()]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const profiles = await readProfiles(store);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('model-one');
    expect(profiles[0].posts[0].id).toBe('pp-model-one-post-1');
  });

  it('a folder with no document publishes defaults over its derived posts — every file visible at baseline', async () => {
    mockFsTree({ 'model-one': ['a.png', 'b.png'] });
    const pipeline = makePipeline([null]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const [entry] = await readProfiles(store);
    expect(entry.id).toBe('model-one');
    expect(entry.enabled).toBe(true);
    expect(entry.posts.map((post) => post.id)).toEqual([
      'pp-model-one-a',
      'pp-model-one-b',
    ]);
    expect(entry.posts.every((post) => post.visible)).toBe(true);
    // The '' avatar resolved to the folder's first sorted image —
    // no `profile*` file in this folder.
    expect(entry.avatar).toBe('/images/profiles/model-one/a.png');
  });

  it('merges the sparse overlay onto the derived baseline — overridden fields apply, untouched posts keep baseline', async () => {
    mockFsTree(
      { 'model-one': ['post-1.jpg', 'post-1.txt', 'post-2.jpg'] },
      { 'model-one/post-1.txt': '[PT]\nDo sidecar\n[EN]\nFrom sidecar\n' }
    );
    const pipeline = makePipeline([
      JSON.stringify(
        profileDoc({
          posts: {
            'pp-model-one-post-1': { visible: false, likes: 7 },
            'pp-model-one-post-2': {
              caption: { pt: 'Sobreposta', en: 'Overridden' },
              alt: { pt: 'Texto alt', en: '' },
            },
          },
        })
      ),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const [entry] = await readProfiles(store);
    // post-1: flags overridden, caption kept from the sidecar.
    expect(entry.posts[0]).toEqual({
      id: 'pp-model-one-post-1',
      media: '/images/profiles/model-one/post-1.jpg',
      caption: { pt: 'Do sidecar', en: 'From sidecar' },
      likes: 7,
      visible: false,
    });
    // post-2: caption and alt overridden, baseline flags.
    expect(entry.posts[1]).toEqual({
      id: 'pp-model-one-post-2',
      media: '/images/profiles/model-one/post-2.jpg',
      caption: { pt: 'Sobreposta', en: 'Overridden' },
      alt: { pt: 'Texto alt', en: '' },
      likes: 0,
      visible: true,
    });
  });

  it('ignores overlay keys naming no folder file — deleted-file residue merges with nothing', async () => {
    mockFsTree({ 'model-one': ['post-1.jpg'] });
    const pipeline = makePipeline([
      JSON.stringify(
        profileDoc({
          posts: {
            'pp-model-one-post-1': { likes: 3 },
            'pp-model-one-gone': { visible: false },
          },
        })
      ),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const [entry] = await readProfiles(store);
    expect(entry.posts.map((post) => post.id)).toEqual([
      'pp-model-one-post-1',
    ]);
    expect(entry.posts[0].likes).toBe(3);
  });

  it('excludes `profile*` files from the post set while picking them as avatar', async () => {
    mockFsTree({
      'model-one': ['profile-01.jpg', 'post-1.jpg'],
    });
    const pipeline = makePipeline([
      JSON.stringify(profileDoc({ avatar: '', posts: {} })),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const [entry] = await readProfiles(store);
    expect(entry.avatar).toBe('/images/profiles/model-one/profile-01.jpg');
    expect(entry.posts.map((post) => post.id)).toEqual([
      'pp-model-one-post-1',
    ]);
  });

  it('the folder name is the identity — a stored id inside the document cannot rename the profile', async () => {
    mockFsTree({ 'model-one': [] });
    const pipeline = makePipeline([
      JSON.stringify(profileDoc({ id: 'renamed', posts: {} })),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const [entry] = await readProfiles(store);
    expect(entry.id).toBe('model-one');
  });

  it("a stored '' avatar prefers the first sorted `profile*` file — case-insensitive basename", async () => {
    mockFsTree({
      // `profile-01.jpg` loses the plain sort to `a-01.jpg` but still
      // wins the avatar slot.
      'model-one': ['a-01.jpg', 'profile-01.jpg', 'z.png'],
      // The basename match is case-insensitive: `PROFILE.png` sorted
      // after `A-01.jpg` still takes the slot.
      'model-two': ['A-01.jpg', 'PROFILE.png'],
    });
    const pipeline = makePipeline([
      JSON.stringify(profileDoc({ avatar: '', posts: {} })),
      JSON.stringify(profileDoc({ avatar: '', posts: {} })),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const profiles = await readProfiles(store);
    expect(profiles[0].avatar).toBe(
      '/images/profiles/model-one/profile-01.jpg'
    );
    expect(profiles[1].avatar).toBe('/images/profiles/model-two/PROFILE.png');
  });

  it("a stored '' avatar falls back to the folder's first sorted image when no `profile*` file exists — '' only when the folder holds none", async () => {
    mockFsTree({
      'model-one': ['z.png', 'a.png', 'skip.txt'],
      'model-two': [],
    });
    const pipeline = makePipeline([
      JSON.stringify(profileDoc({ avatar: '', posts: {} })),
      JSON.stringify(profileDoc({ avatar: '', posts: {} })),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const profiles = await readProfiles(store);
    expect(profiles[0].avatar).toBe('/images/profiles/model-one/a.png');
    expect(profiles[1].avatar).toBe('');
  });

  it('an explicit stored avatar is never overridden by the folder', async () => {
    mockFsTree({ 'model-one': ['a.png'] });
    const pipeline = makePipeline([JSON.stringify(profileDoc())]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const [entry] = await readProfiles(store);
    expect(entry.avatar).toBe('/images/profiles/model-one/avatar.png');
  });

  it('drops a corrupt document — a broken record never takes the list down nor publishes defaults', async () => {
    // Sorted folder order: model-one, model-three, model-two — the
    // docs align by index, so the corrupt first and third entries
    // drop their folders while the valid second keeps model-two.
    mockFsTree({ 'model-one': [], 'model-two': ['a.png'], 'model-three': [] });
    const pipeline = makePipeline([
      '{not json',
      '[[broken',
      JSON.stringify(profileDoc({ posts: {} })),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const profiles = await readProfiles(store);
    expect(profiles.map((entry) => entry.id)).toEqual(['model-two']);
  });

  it('drops a non-object stored value (number, JSON scalar) the same way', async () => {
    mockFsTree({ 'model-one': [], 'model-two': [] });
    const pipeline = makePipeline([42, JSON.stringify(profileDoc())]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const profiles = await readProfiles(store);
    expect(profiles.map((entry) => entry.id)).toEqual(['model-two']);
  });

  it('drops corrupt overlay entries individually — a malformed post key or value never takes the profile down', async () => {
    mockFsTree({ 'model-one': ['post-1.jpg', 'post-2.jpg'] });
    const pipeline = makePipeline([
      JSON.stringify(
        profileDoc({
          posts: {
            // Valid override for a real file.
            'pp-model-one-post-1': { visible: false },
            // A foreign profile's post id — can never merge.
            'pp-model-two-1': { visible: false },
            // Not a pp- id at all.
            'post-2': { likes: 9 },
            // A real post id whose override yields no usable field.
            'pp-model-one-post-2': { visible: 'yes' },
          },
        })
      ),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const [entry] = await readProfiles(store);
    expect(entry.posts[0].visible).toBe(false);
    // post-2's empty-handed override dropped at normalize — baseline.
    expect(entry.posts[1].visible).toBe(true);
    expect(entry.posts[1].likes).toBe(0);
  });

  it('propagates store read failures — callers degrade fail-closed (ADR 00-002)', async () => {
    mockFsTree({ 'model-one': [] });
    const store = makeStore({
      pipeline: vi.fn(() => {
        throw new Error('store unreachable');
      }),
    });
    await expect(readProfiles(store)).rejects.toThrow('store unreachable');
  });

  it('still derives posts with resolveAvatars: false — only the avatar fallback readdir is skipped', async () => {
    mockFsTree({ 'model-one': ['post-1.jpg'] });
    const pipeline = makePipeline([
      JSON.stringify(profileDoc({ avatar: '', posts: {} })),
    ]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const [entry] = await readProfiles(store, { resolveAvatars: false });
    expect(entry.avatar).toBe('');
    // The posts set is filesystem truth — derived regardless of the
    // avatar tuning: one readdir for the root enumeration plus one
    // for the folder's files; the avatar fallback's second folder
    // readdir is what `resolveAvatars: false` saves.
    expect(entry.posts.map((post) => post.id)).toEqual([
      'pp-model-one-post-1',
    ]);
    expect(readdirMock).toHaveBeenCalledTimes(2);
  });

  it('accepts a pre-fetched folders list — no root re-enumeration', async () => {
    // No mockFsTree for the root: the supplied list skips
    // `listProfileFolders`; each folder's post-file readdir and any
    // sidecar reads still run (the post set is the filesystem).
    mockFsTree({ 'model-one': ['post-1.jpg'] });
    const pipeline = makePipeline([JSON.stringify(profileDoc())]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const profiles = await readProfiles(store, {
      folders: ['model-one'],
      resolveAvatars: false,
    });
    expect(profiles.map((entry) => entry.id)).toEqual(['model-one']);
    expect(readdirMock).toHaveBeenCalledTimes(1);
    expect(readdirMock).toHaveBeenCalledWith(
      path.join(PROFILES_ROOT, 'model-one'),
      { withFileTypes: true }
    );
    expect(lstatMock).not.toHaveBeenCalled();
  });

  it('readCaptions: false skips every sidecar read — captions arrive empty', async () => {
    mockFsTree(
      { 'model-one': ['post-1.jpg', 'post-1.txt'] },
      { 'model-one/post-1.txt': '[PT]\nLegenda\n[EN]\nCaption\n' }
    );
    const pipeline = makePipeline([JSON.stringify(profileDoc({ posts: {} }))]);
    const store = makeStore({ pipeline: vi.fn(() => pipeline) });

    const [entry] = await readProfiles(store, {
      resolveAvatars: false,
      readCaptions: false,
    });
    expect(entry.posts.map((post) => post.id)).toEqual([
      'pp-model-one-post-1',
    ]);
    expect(entry.posts[0].caption).toEqual({ pt: '', en: '' });
    expect(readFileMock).not.toHaveBeenCalled();
  });
});

describe('readProfile — the single-slug not-found surface (ADR 03-004)', () => {
  it('returns null for a missing folder without touching the store', async () => {
    mockFsTree({});
    const store = makeStore();
    expect(await readProfile(store, 'model-one')).toBeNull();
    expect(store.get).not.toHaveBeenCalled();
  });

  it('returns null for a non-slug input — the route param never reaches the filesystem', async () => {
    const store = makeStore();
    expect(await readProfile(store, '../../etc')).toBeNull();
    expect(lstatMock).not.toHaveBeenCalled();
    expect(readdirMock).not.toHaveBeenCalled();
    expect(store.get).not.toHaveBeenCalled();
  });

  it('returns null when the path exists but is a file — the isDirectory predicate matches enumeration', async () => {
    // `lstat` answers like `Dirent.isDirectory()`: only real
    // directories count — a file (or a symlink, which lstat also
    // reports as not-a-directory) at the slug's path is not a folder.
    lstatMock.mockResolvedValue({ isDirectory: () => false });
    const store = makeStore();
    expect(await readProfile(store, 'model-file')).toBeNull();
    expect(store.get).not.toHaveBeenCalled();
  });

  it('returns the folder defaults over the derived posts when the document is absent', async () => {
    mockFsTree(
      { 'model-one': ['b.png', 'a.png', 'a.txt'] },
      { 'model-one/a.txt': '[PT]\nLegenda a\n[EN]\nCaption a\n' }
    );
    const store = makeStore({ get: vi.fn(async () => null) });

    const found = await readProfile(store, 'model-one');
    expect(store.get).toHaveBeenCalledWith(PROFILE_KEY('model-one'));
    expect(found).toEqual({
      id: 'model-one',
      enabled: true,
      avatar: '/images/profiles/model-one/a.png',
      posts: [
        {
          id: 'pp-model-one-a',
          media: '/images/profiles/model-one/a.png',
          caption: { pt: 'Legenda a', en: 'Caption a' },
          likes: 0,
          visible: true,
        },
        {
          id: 'pp-model-one-b',
          media: '/images/profiles/model-one/b.png',
          caption: { pt: '', en: '' },
          likes: 0,
          visible: true,
        },
      ],
    });
  });

  it("keeps avatar '' when the folder holds no images", async () => {
    mockFsTree({ 'model-one': [] });
    const store = makeStore({ get: vi.fn(async () => null) });

    const found = await readProfile(store, 'model-one');
    expect(found?.avatar).toBe('');
    expect(found?.posts).toEqual([]);
  });

  it('returns the merged overlay for a stored document — id injected from the folder', async () => {
    mockFsTree({ 'model-one': ['post-1.jpg'] });
    const store = makeStore({
      get: vi.fn(async () => JSON.stringify(profileDoc())),
    });

    const found = await readProfile(store, 'model-one');
    expect(found?.id).toBe('model-one');
    expect(found?.enabled).toBe(true);
    expect(found?.posts).toHaveLength(1);
    // The stored override applied over the file baseline.
    expect(found?.posts[0].visible).toBe(false);
    expect(found?.posts[0].likes).toBe(12);
  });

  it('returns null for a corrupt document — a broken record never publishes defaults', async () => {
    mockFsTree({ 'model-one': ['a.png'] });
    const store = makeStore({ get: vi.fn(async () => 'not{json') });
    expect(await readProfile(store, 'model-one')).toBeNull();
  });

  it('returns null for a reserved-slug folder — normalization rejects it outright', async () => {
    mockFsTree({ admin: ['a.png'] });
    const store = makeStore({ get: vi.fn(async () => null) });
    expect(await readProfile(store, 'admin')).toBeNull();
  });
});

describe('writeProfile — the folder-gated sparse-overlay write (ADR 03-004)', () => {
  it('writes the {enabled, avatar, posts: Record} document — the slug is the key, never stored', async () => {
    mockFsTree({ 'model-one': [] });
    const store = makeStore();
    const entry = overlay({
      posts: { 'pp-model-one-post-1': { visible: false } },
    });

    await writeProfile(store, entry);

    expect(store.set).toHaveBeenCalledTimes(1);
    expect(store.set).toHaveBeenCalledWith(
      PROFILE_KEY('model-one'),
      JSON.stringify({
        enabled: entry.enabled,
        avatar: entry.avatar,
        posts: entry.posts,
      })
    );
  });

  it("rejects a profile whose folder does not exist — 'unknown_profile', nothing written", async () => {
    mockFsTree({});
    const store = makeStore();

    await expect(writeProfile(store, overlay({ id: 'gone' }))).rejects.toThrow(
      'unknown_profile'
    );
    expect(store.set).not.toHaveBeenCalled();
  });

  it('rejects a slug whose path is a file, not a folder — same predicate as enumeration', async () => {
    lstatMock.mockResolvedValue({ isDirectory: () => false });
    const store = makeStore();

    await expect(
      writeProfile(store, overlay({ id: 'model-file' }))
    ).rejects.toThrow('unknown_profile');
    expect(store.set).not.toHaveBeenCalled();
  });

  it('propagates store failures — the write reports rather than silently dropping (ADR 00-002)', async () => {
    mockFsTree({ 'model-one': [] });
    const store = makeStore({
      set: vi.fn(async () => {
        throw new Error('set failed');
      }),
    });

    await expect(writeProfile(store, overlay())).rejects.toThrow('set failed');
  });
});
