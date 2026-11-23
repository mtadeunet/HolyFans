import type { Dirent } from 'fs';
import { lstat, readdir, readFile } from 'fs/promises';
import path from 'path';
import type { Redis } from '@upstash/redis';
import {
  normalizeProfiles,
  parseCaptionSidecar,
  postIdFor,
  profileDefaults,
  PROFILE_SLUG_REGEX,
  RESERVED_PROFILE_SLUGS,
  type LocalizedText,
  type ModelProfile,
  type ProfileOverlay,
  type ProfilePost,
} from '@/lib/profiles';

/**
 * Implements ADR 03-004: Model Profiles — a Model Profile exists iff
 * its folder `public/images/profiles/<slug>/` exists: the FILESYSTEM
 * is the profile set — enumeration is the folder listing, sorted
 * alphabetically (the landing feed shuffles per request; folder order
 * is only the deterministic enumeration order) — and the post set
 * too: every image file in the folder whose basename does NOT start
 * with `profile` (the avatar convention) IS a post, identified by the
 * deterministic `pp-<slug>-<basename>` id, captioned by the sibling
 * `<basename>.txt` sidecar's `[PT]`/`[EN]` sections, ordered by
 * filename. Filename is post identity: the basename mints the id and
 * names the sidecar, so it must satisfy `PROFILE_SLUG_REGEX` — a file
 * whose stem is not slug-safe is not a post — and one stem carries
 * one post (a cross-extension duplicate is not a post either; the
 * first sorted file wins). The shared managed store of ADR 00-002
 * ("Small shared request-time state persists in a managed Redis
 * store") holds only
 * each profile's SPARSE operator overlay in its own keyspace never
 * joined to the like or stock-notification keys:
 *
 * - `profile:<slug>` — a STRING holding the profile's JSON document:
 *   `{enabled, avatar, posts: Record<postId, {visible?, likes?,
 *   caption?:{pt,en}, alt?:{pt,en}>}}` — per post, only the fields
 *   the operator changed relative to the file baseline. The slug
 *   itself is not stored — the folder name is the identity.
 *
 * A folder with no document resolves to the defaults
 * `{enabled: true, avatar: '', posts: {}}` — creating the folder
 * alone publishes the model with every image post visible; an
 * `avatar` of `''` resolves to the folder's profile image — the
 * first sorted `profile*` file, else the first sorted image file
 * (`''` only when the folder holds no images).
 *
 * Server-side reads and writes consumed by the landing and profile
 * routes, the like counter Route Handler, and the Admin Console's
 * Profiles tab, over the shared fail-closed client from
 * `lib/managed-store.ts` (`getManagedStore()`). Kept out of
 * `lib/profiles.ts` so that module stays pure (no `fs`, no Redis) and
 * unit-testable in Node — the same posture as `lib/likes-server.ts`.
 */

/** Absolute path of the profile-folder imagery root — the profile set
 *  itself. */
const PROFILES_IMAGES_ROOT = path.join(
  process.cwd(),
  'public',
  'images',
  'profiles'
);

/**
 * The image extensions a profile folder's files may carry — the
 * web-servable set the Media Slot and the avatar `<Image>` render, and
 * the set the avatar fallback and the post set both pick from.
 * Compared lowercase so casing in filenames never excludes an asset.
 */
const PROFILE_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
  '.svg',
]);

/** The empty caption a missing or unreadable sidecar yields — a fresh
 *  object per call so callers never share mutable state. */
const EMPTY_CAPTION = (): LocalizedText => ({ pt: '', en: '' });

/**
 * The Redis STRING key holding one profile's JSON overlay document.
 *
 * @param slug - The profile's slug-safe `id` (folder name, route
 *   segment, displayed `@handle`).
 * @returns `profile:<slug>`.
 */
export function PROFILE_KEY(slug: string): string {
  return `profile:${slug}`;
}

/**
 * Implements ADR 03-004: Model Profiles — the profile enumeration IS
 * the folder listing: the directory names under
 * `public/images/profiles/` filtered to `PROFILE_SLUG_REGEX`-safe
 * slugs, sorted alphabetically (enumeration order — the landing feed
 * shuffles per request). A missing or
 * unreadable root yields an empty list — fail-soft like the rest of
 * the feature's filesystem reads: no folders means no profiles, never
 * a crash.
 *
 * `RESERVED_PROFILE_SLUGS` folders never enumerate: `admin`/`api`-style
 * names can never be profiles (normalization would reject their
 * documents anyway), so keeping them out of the listing keeps them out
 * of the admin selector and out of every consumer's pipeline GET —
 * the enumeration's own filter rather than each reader's burden.
 *
 * @returns The sorted profile slugs the filesystem defines.
 */
export async function listProfileFolders(): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(PROFILES_IMAGES_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        PROFILE_SLUG_REGEX.test(entry.name) &&
        !RESERVED_PROFILE_SLUGS.includes(entry.name)
    )
    .map((entry) => entry.name)
    .sort();
}

/**
 * The sorted `/images/profiles/<slug>/<file>` paths of one profile
 * folder's image files — the avatar fallback's candidate list and the
 * Admin avatar picker's option source. A missing or unreadable folder
 * yields an empty list. The slug feeds a path segment, so non-slug
 * input is rejected before it can reach the filesystem — callers pass
 * folder-derived names, but the guard keeps a hostile or malformed
 * slug from ever leaving the profiles root.
 *
 * @param slug - The profile folder to enumerate.
 * @returns The folder's sorted pickable image paths.
 */
export async function listProfileImages(slug: string): Promise<string[]> {
  if (!PROFILE_SLUG_REGEX.test(slug)) return [];
  let entries: Dirent[];
  try {
    entries = await readdir(path.join(PROFILES_IMAGES_ROOT, slug), {
      withFileTypes: true,
    });
  } catch {
    return [];
  }
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        PROFILE_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    )
    .map((entry) => `/images/profiles/${slug}/${entry.name}`)
    .sort();
}

/**
 * The post set of one profile folder: every image FILE whose basename
 * (extension stripped) does NOT start with `profile` — the avatar
 * convention — returned as bare filenames sorted alphabetically (the
 * post order every consumer inherits). `profile*` files are avatars,
 * never posts; non-image files — including the `.txt` caption
 * sidecars — are not posts either. Same slug guard and fail-soft
 * posture as `listProfileImages`.
 *
 * Filename is post identity: the stem mints the deterministic
 * `pp-<slug>-<basename>` id and names the `<basename>.txt` sidecar, so
 * the stem must satisfy `PROFILE_SLUG_REGEX` exactly like a slug — an
 * image whose stem is not slug-safe (`My Photo.jpg`, `a.b.jpg`) is NOT
 * a post: it is never enumerated, never rendered, and never reaches
 * the Admin Console. One stem likewise carries one post: files that
 * differ only in extension (`a.jpg` + `a.png`) would mint the same id,
 * so the set dedupes by stem — deterministic first-wins, the file
 * sorted first is the post and any later file under that stem is not.
 *
 * @param slug - The profile folder to enumerate.
 * @returns The folder's sorted post filenames (e.g. `church-01.jpg`).
 */
export async function listProfilePostFiles(slug: string): Promise<string[]> {
  if (!PROFILE_SLUG_REGEX.test(slug)) return [];
  let entries: Dirent[];
  try {
    entries = await readdir(path.join(PROFILES_IMAGES_ROOT, slug), {
      withFileTypes: true,
    });
  } catch {
    return [];
  }
  const seenStems = new Set<string>();
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        PROFILE_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    )
    .map((entry) => entry.name)
    .sort()
    .filter((name) => {
      const stem = path.basename(name, path.extname(name));
      // Filename-as-identity: a non-slug-safe stem could mint no valid
      // `pp-<slug>-<basename>` id, and the `profile*` stem convention
      // names avatars — neither is a post. (Slug-safe stems are
      // already lowercase, so `startsWith` needs no case fold.)
      if (!PROFILE_SLUG_REGEX.test(stem) || stem.startsWith('profile')) {
        return false;
      }
      // Cross-extension stem collisions mint the same id — the first
      // sorted file wins deterministically; a second file under the
      // stem is not a post.
      if (seenStems.has(stem)) return false;
      seenStems.add(stem);
      return true;
    });
}

/**
 * Read one post's caption sidecar — `<slug>/<basename>.txt` — and
 * parse its `[PT]`/`[EN]` sections through `parseCaptionSidecar`.
 * A missing or unreadable sidecar yields empty Locales — the post
 * still exists, simply captionless — and CRLF files parse identically
 * to LF. `basename` must already be a plain filename stem (it comes
 * from the folder enumeration or `postIdFor`'s inverse at call sites);
 * a value containing a separator is rejected outright rather than
 * allowed to escape the folder.
 *
 * @param slug - The profile folder slug.
 * @param basename - The post filename without its image extension.
 * @returns The sidecar's `{pt, en}` caption sections.
 */
export async function readCaptionSidecar(
  slug: string,
  basename: string
): Promise<LocalizedText> {
  if (!PROFILE_SLUG_REGEX.test(slug) || path.basename(basename) !== basename) {
    return EMPTY_CAPTION();
  }
  try {
    const text = await readFile(
      path.join(PROFILES_IMAGES_ROOT, slug, `${basename}.txt`),
      'utf8'
    );
    return parseCaptionSidecar(text);
  } catch {
    return EMPTY_CAPTION();
  }
}

/**
 * The filesystem baseline of one profile's posts — the post set as it
 * exists with NO overlay applied: deterministic `pp-<slug>-<basename>`
 * ids, media paths, sidecar captions, `likes: 0`, `visible: true`.
 * This is what `readProfiles`/`readProfile` merge the `profile:<slug>`
 * overlay onto, and what the Admin Console's `saveProfile` diffs
 * submissions against — baselines are always computed server-side
 * from the folder, never trusted from the client.
 *
 * @param slug - The profile folder slug.
 * @param opts - Optional derivation tuning: `captions` (default
 *   `true`) reads each post's `<basename>.txt` sidecar — consumers
 *   that never render captions (e.g. the like counter, which needs
 *   only ids and base counts) pass `false`, skip the per-post
 *   `readFile`, and receive `{pt: '', en: ''}` captions.
 * @returns The derived posts in alphabetical filename order; empty
 *   for a missing folder.
 */
export async function deriveProfilePosts(
  slug: string,
  opts?: { captions?: boolean }
): Promise<ProfilePost[]> {
  const files = await listProfilePostFiles(slug);
  return Promise.all(
    files.map(async (file) => {
      const basename = path.basename(file, path.extname(file));
      return {
        id: postIdFor(slug, basename),
        media: `/images/profiles/${slug}/${file}`,
        caption:
          opts?.captions === false
            ? EMPTY_CAPTION()
            : await readCaptionSidecar(slug, basename),
        likes: 0,
        visible: true,
      };
    })
  );
}

/**
 * Whether `public/images/profiles/<slug>/` exists — the single
 * filesystem-truth question `readProfile` and `writeProfile` ask.
 * A non-slug input answers `false` without touching the filesystem
 * (the slug becomes a path segment; the regex makes traversal
 * impossible and doubles as the existence contract).
 *
 * The predicate is `lstat().isDirectory()` — deliberately `lstat`, not
 * `stat`: `Dirent.isDirectory()` (what `listProfileFolders` filters
 * on) reports `false` for a symlink, and `lstat` answers the same for
 * the same entry, so existence and enumeration can never disagree —
 * a regular file or a symlinked directory is not a profile folder in
 * either. A `stat()` here would follow the link and let a folder that
 * never enumerates pass the write gate, orphaning its document.
 *
 * @param slug - The candidate profile slug.
 * @returns `true` when the folder exists and is a real directory.
 */
async function profileFolderExists(slug: string): Promise<boolean> {
  if (!PROFILE_SLUG_REGEX.test(slug)) return false;
  try {
    return (await lstat(path.join(PROFILES_IMAGES_ROOT, slug))).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Narrow a stored `profile:<slug>` value to a normalization input. The
 * SDK's automatic deserialization may already have parsed the JSON
 * document into an object; a raw string is parsed here. Anything else
 * — or unparseable JSON — yields `undefined` and the document is
 * skipped (the same drop-malformed posture normalization applies).
 *
 * @param value - The stored value as returned by `get` (untrusted).
 * @returns The parsed document, or `undefined` when it is unusable.
 */
function parseStoredProfile(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (value !== null && typeof value === 'object') {
    return value;
  }
  return undefined;
}

/**
 * Build one normalization input for a folder's stored document —
 * either the folder's `{enabled, avatar, posts}` overlay with the
 * folder name injected as `id` (the filesystem stays the identity, so
 * a stored `id` can never rename the profile), or the folder-default
 * overlay when the key is absent: a bare folder publishes with
 * `{enabled: true, avatar: '', posts: {}}` — existence alone is
 * publish intent. A present-but-unusable document (unparseable JSON,
 * a non-object) returns `null`: the record drops rather than
 * silently publishing defaults over corrupted operator data — the
 * same fail-closed drop posture normalization applies.
 *
 * @param slug - The folder slug the document belongs to.
 * @param stored - The raw `GET profile:<slug>` result.
 * @returns The normalization input, or `null` for a corrupt document.
 */
function rawProfileDocument(
  slug: string,
  stored: unknown
): Record<string, unknown> | null {
  if (stored === null || stored === undefined) {
    // `profileDefaults` is the folder-default overlay — one shared
    // definition with the console's empty draft.
    return { ...profileDefaults(slug) };
  }
  const parsed = parseStoredProfile(stored);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return { ...(parsed as Record<string, unknown>), id: slug };
}

/**
 * Merge a normalized overlay onto a folder's derived baseline posts:
 * each baseline post gains the override's stored fields — `caption`
 * (replacing the sidecar's), `alt` (present only when stored),
 * `likes`, `visible` — while posts the overlay never mentions keep
 * their baseline values. Order is the baseline's alphabetical
 * filename order; overlay keys naming no derived post (a deleted
 * file's residue) merge with nothing and are ignored.
 *
 * @param baseline - The folder's derived posts.
 * @param overlay - The normalized `posts` override map.
 * @returns The effective posts the routes and console render.
 */
function applyPostOverlay(
  baseline: readonly ProfilePost[],
  overlay: Record<
    string,
    {
      visible?: boolean;
      likes?: number;
      caption?: LocalizedText;
      alt?: LocalizedText;
    }
  >
): ProfilePost[] {
  return baseline.map((post) => {
    const override = overlay[post.id];
    if (override === undefined) return post;
    return {
      id: post.id,
      media: post.media,
      caption: override.caption ?? post.caption,
      ...(override.alt !== undefined ? { alt: override.alt } : {}),
      likes: override.likes ?? post.likes,
      visible: override.visible ?? post.visible,
    };
  });
}

/**
 * Resolve a normalized profile's `avatar === ''` to the folder's
 * profile image — the first sorted image whose basename (without
 * extension) starts with `profile`, case-insensitive (`profile.jpg`,
 * `PROFILE-01.png`). When no `profile*` file exists the folder's
 * first sorted image takes the slot. `''` means "unset" in the
 * document, and survives only when the folder holds no images.
 *
 * @param profile - The merged profile.
 * @returns The profile with its concrete or still-empty avatar.
 */
async function applyAvatarFallback(
  profile: ModelProfile
): Promise<ModelProfile> {
  if (profile.avatar !== '') return profile;
  const images = await listProfileImages(profile.id);
  const avatar =
    images.find((image) =>
      path
        .basename(image, path.extname(image))
        .toLowerCase()
        .startsWith('profile')
    ) ?? images[0];
  return avatar === undefined ? profile : { ...profile, avatar };
}

/**
 * Materialize one normalized overlay into a consumed `ModelProfile`:
 * the folder's derived posts merged with the overlay's sparse
 * per-post overrides.
 *
 * @param overlay - The normalized `profile:<slug>` document.
 * @param captions - Whether the baseline derivation reads the
 *   `<basename>.txt` sidecars (`false` yields empty captions — the
 *   caller never renders them).
 * @returns The effective profile (avatar still unresolved).
 */
async function materializeProfile(
  overlay: ProfileOverlay,
  captions: boolean
): Promise<ModelProfile> {
  const baseline = await deriveProfilePosts(overlay.id, { captions });
  return {
    id: overlay.id,
    enabled: overlay.enabled,
    avatar: overlay.avatar,
    posts: applyPostOverlay(baseline, overlay.posts),
  };
}

/**
 * Read every Model Profile in alphabetical folder order: the sorted
 * folder list is the enumeration, with one `GET profile:<slug>` per
 * folder in a single pipeline, each document normalized to its sparse
 * overlay and merged onto the folder's derived post baseline. A
 * folder without a document yields the publish-by-default record
 * (enabled, all posts visible at baseline); a corrupt document drops
 * its profile — never taking the whole list down. The avatar fallback
 * resolves against the folder afterwards.
 *
 * @param store - The configured Redis client.
 * @param opts - Optional read tuning: `resolveAvatars` (default `true`)
 *   resolves `''` avatars to the folder's profile image — consumers that
 *   never render avatars (e.g. the like counter) pass `false` and skip
 *   the per-folder image readdir; `folders` supplies a pre-fetched
 *   slug list (e.g. the Admin Console's single enumeration shared with
 *   its avatar picker), skipping the internal `listProfileFolders`;
 *   `readCaptions` (default `true`) reads each post's caption sidecar
 *   — consumers that never render captions pass `false` and skip the
 *   per-post `readFile`, receiving empty captions.
 * @returns The effective profiles, in alphabetical folder order.
 * @throws Propagates store read failures; callers degrade per their
 *   fail-closed posture.
 */
export async function readProfiles(
  store: Redis,
  opts?: {
    resolveAvatars?: boolean;
    folders?: string[];
    readCaptions?: boolean;
  }
): Promise<ModelProfile[]> {
  const slugs = opts?.folders ?? (await listProfileFolders());
  if (slugs.length === 0) return [];

  const pipeline = store.pipeline();
  for (const slug of slugs) {
    pipeline.get(PROFILE_KEY(slug));
  }
  const docs: unknown[] = await pipeline.exec();

  // Collect the per-folder documents first, then normalize the whole
  // list in a single pass — the profile-id uniqueness invariant must
  // span every document. A corrupt stored doc drops its profile; a
  // missing doc publishes defaults.
  const raw: Record<string, unknown>[] = [];
  for (const [index, slug] of slugs.entries()) {
    const doc = rawProfileDocument(slug, docs[index]);
    if (doc !== null) raw.push(doc);
  }
  const overlays = normalizeProfiles(raw);
  // `readCaptions === false`: the caller never renders captions, so
  // each baseline derivation skips its per-post sidecar `readFile` —
  // one filesystem read saved per post.
  const captions = opts?.readCaptions !== false;
  const profiles = await Promise.all(
    overlays.map((overlay) => materializeProfile(overlay, captions))
  );
  // resolveAvatars === false: the caller never renders avatars, so the
  // stored value ('' or an explicit path) passes through unresolved —
  // one image-folder readdir saved per profile.
  if (opts?.resolveAvatars === false) return profiles;
  return Promise.all(profiles.map(applyAvatarFallback));
}

/**
 * Read one Model Profile by slug: the folder must exist — filesystem
 * truth — else `null`; the `profile:<slug>` document is optional and
 * resolves to the folder-default record when absent, or to `null`
 * when corrupt (the not-found surface the `/u/<slug>` route applies).
 * The folder's derived posts merge with the document's sparse
 * overrides; the avatar fallback resolves the same way as
 * `readProfiles`.
 *
 * @param store - The configured Redis client.
 * @param slug - The profile slug to look up.
 * @returns The effective profile, or `null`.
 * @throws Propagates store read failures; callers degrade per their
 *   fail-closed posture.
 */
export async function readProfile(
  store: Redis,
  slug: string
): Promise<ModelProfile | null> {
  if (!(await profileFolderExists(slug))) return null;
  const raw = rawProfileDocument(slug, await store.get(PROFILE_KEY(slug)));
  if (raw === null) return null;
  const [overlay] = normalizeProfiles([raw]);
  if (overlay === undefined) return null;
  // The single-profile read always resolves captions — the Profile
  // Route renders them.
  return applyAvatarFallback(await materializeProfile(overlay, true));
}

/**
 * Persist one profile's overlay document: a single
 * `SET profile:<slug>` of the `{enabled, avatar, posts}` JSON — the
 * posts map is the ALREADY-SPARSE override record the caller built
 * (`saveProfile` diffs submissions against the server-computed
 * filesystem baselines; only diffs are stored). The slug is the key,
 * never stored inside the document. The folder is the profile's
 * existence, so writing a profile whose folder does not exist is
 * rejected: a stray document could never describe a real model and
 * would only orphan.
 *
 * @param store - The configured Redis client.
 * @param profile - The normalized profile overlay to persist.
 * @throws `Error('unknown_profile')` when
 *   `public/images/profiles/<slug>/` does not exist; propagates store
 *   failures. Callers surface the message to the operator
 *   (fail-closed, ADR 00-002).
 */
export async function writeProfile(
  store: Redis,
  profile: ProfileOverlay
): Promise<void> {
  if (!(await profileFolderExists(profile.id))) {
    throw new Error('unknown_profile');
  }
  const { id, ...doc } = profile;
  await store.set(PROFILE_KEY(id), JSON.stringify(doc));
}
