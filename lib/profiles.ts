/**
 * Implements ADR 03-004: Model Profiles — the Model Profile model, its
 * normalization, and the pure helpers shared by the profile route, the
 * landing feed's profile-post mixing, the like counter Route Handler,
 * and the Admin Console's Profiles tab.
 *
 * A Model Profile exists iff its folder
 * `public/images/profiles/<slug>/` exists — the filesystem is the
 * profile set, never the managed store. The folder is also the post
 * set: every image file whose basename does NOT start with `profile`
 * (the avatar convention) IS a post — there is no stored post list and
 * no add/remove-post surface. The optional `profile:<slug>` document
 * in ADR 00-002's shared Redis (written by `lib/profiles-server.ts`)
 * carries only the operator-editable SPARSE overlay
 * `{enabled, avatar, posts: Record<postId, override>}` — per-post
 * fields stored only where they differ from the filesystem baseline
 * (a caption sidecar `<basename>.txt` supplies the baseline caption):
 * an enabled profile publishes a `/u/<slug>` route (its `id` doubles
 * as the displayed `@handle`) and mixes its posts into the landing
 * Feed Surface after the authored `FEED_POSTS` — the appended tail
 * shuffled per request so posts interleave across profiles rather
 * than grouping in folder order. Post copy is operator data —
 * `LocalizedText` fields resolved by the request Locale at render,
 * never message keys (ADR 00-005's localization applies to the copy
 * pipeline, not to operator data). The display name is not data at
 * all: it is DERIVED from the slug by `deslugifyProfileName` —
 * `helena-duarte` renders `Helena Duarte` — so no name field exists
 * to store or translate.
 *
 * This module is deliberately pure: no `fs`, no Redis, no framework
 * imports — the same posture as `lib/promotions.ts`, so normalization
 * and unit tests can run it in Node. The filesystem enumeration and
 * managed-store reads and writes live in `lib/profiles-server.ts`
 * beside it.
 */

/** One field of operator-authored copy, one string per Locale. */
export interface LocalizedText {
  pt: string;
  en: string;
}

/**
 * One post under a Model Profile — a folder image file merged with its
 * operator overlay. `media` is always the post's file path: the file
 * IS the post, so media-less profile posts cannot exist. `caption`
 * resolves to the overlay's override when stored, else the
 * `<basename>.txt` sidecar's `[PT]`/`[EN]` sections, else empty
 * Locales; `likes` is the authored base like count with the same
 * base+delta semantics as `FeedPost.likes` (the like counter adds the
 * managed store's deduped delta, ADR 03-002).
 */
export interface ProfilePost {
  /**
   * Deterministic id `pp-<slug>-<basename>` (`postIdFor`), unique
   * across every post of every profile — it is the Post Card's anchor
   * id and the post's key in the managed like store.
   */
  id: string;
  /**
   * Path to the post's image master under `public/` —
   * `/images/profiles/<slug>/<file>`; the file is the post, so the
   * Media Slot always renders.
   */
  media: string;
  /**
   * Effective localized caption — the stored override when present,
   * else the sidecar's sections; operator data resolved by request
   * Locale.
   */
  caption: LocalizedText;
  /**
   * Optional localized alt-text override for the Media Slot; absent,
   * the Media Slot falls back to the profile's display name.
   */
  alt?: LocalizedText;
  /** The authored base like count — a non-negative integer. */
  likes: number;
  /**
   * `false` hides the post without deleting its file — it renders
   * nowhere (feed, profile route) and holds no public like counts.
   * Files publish by default: `true` unless the overlay stores an
   * explicit `false`.
   */
  visible: boolean;
}

/**
 * The sparse per-post override a `profile:<slug>` document may store —
 * only fields the operator changed relative to the filesystem
 * baseline: `visible` when hidden (files publish by default), `likes`
 * when the authored base is non-zero, `caption` when it differs from
 * the sidecar's sections, `alt` when set.
 */
export interface ProfilePostOverride {
  visible?: boolean;
  likes?: number;
  caption?: LocalizedText;
  alt?: LocalizedText;
}

/**
 * The normalized `profile:<slug>` document — the sparse overlay the
 * managed store holds per folder. `posts` maps `pp-<slug>-<basename>`
 * post ids to their overrides; only overridden fields exist inside
 * each entry.
 */
export interface ProfileOverlay {
  /** The profile slug — the folder name, the key's suffix; injected by
   *  the reader, never stored inside the document. */
  id: string;
  /** `false` unpublishes the profile: no route, no feed posts. */
  enabled: boolean;
  /**
   * Path to the avatar image under `public/`, or `''` meaning "unset":
   * the server-side read resolves it to the folder's profile image —
   * the first sorted `profile*` file, else the first sorted image
   * file.
   */
  avatar: string;
  /** The sparse post overrides keyed by deterministic post id. */
  posts: Record<string, ProfilePostOverride>;
}

/**
 * One Model Profile as consumed by the routes and the Admin Console —
 * the folder's derived posts merged with the `profile:<slug>` overlay.
 */
export interface ModelProfile {
  /**
   * Slug-safe `a-z0-9-` id — the profile folder name, the `/u/<slug>`
   * route segment, the displayed `@handle`, and the seed of the
   * derived display name (`profileDisplayName`). Identifier hygiene
   * keeps real-world handles out of tracked files (ADR 00-007).
   */
  id: string;
  /** `false` unpublishes the profile: no route, no feed posts. */
  enabled: boolean;
  /**
   * Path to the avatar image under `public/` (e.g. `/images/…`). `''`
   * in the stored document means "unset": the server-side read
   * resolves it to the folder's profile image — the first sorted
   * `profile*` file, else the first sorted image file — so a
   * normalized profile handed to the UI carries a concrete avatar
   * whenever the folder holds imagery.
   */
  avatar: string;
  /** The profile's effective posts, in alphabetical filename order. */
  posts: ProfilePost[];
}

/**
 * Profile ids become route segments and rendered handles — restrict
 * them to lowercase slugs so operator-entered ids can never inject
 * whitespace, unicode, or control characters into URLs or chrome.
 * (Same pattern `CAMPAIGN_ID_PATTERN` enforces for campaign ids.)
 */
export const PROFILE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

/** The id prefix distinguishing Model Profile posts from authored
 *  `FEED_POSTS` in the shared like-store key space and Post Card
 *  anchors (`pp-<slug>-<basename>`). */
export const PROFILE_POST_ID_PREFIX = 'pp-';

/** Upper bound on a profile post id — rejects abusive input before it
 *  can mint a managed-store key (same posture as
 *  `LIKE_TOKEN_MAX_LENGTH`). */
export const PROFILE_POST_ID_MAX_LENGTH = 64;

/**
 * Route segments a profile slug must never claim. `/u/<slug>` nests
 * profiles under their own prefix so no collision exists in practice,
 * but a hand-edited stored document naming one of these ids is still
 * rejected:
 * the reserved set doubles as the "never a real account" guardrail —
 * platform and legal surface names stay unavailable for handles.
 */
export const RESERVED_PROFILE_SLUGS: readonly string[] = [
  'checkout',
  'contact',
  'qrcoderedirect',
  'admin',
  'api',
  'privacy',
  'terms',
];

/**
 * Whether a string is a well-formed profile post id: the `pp-` prefix
 * plus a slug-safe remainder, within the length cap.
 *
 * @param id - The candidate post id (untrusted).
 * @returns `true` when `id` has the `pp-` shape — existence in the
 *   folder's post-file set is a separate check (the server-side read
 *   derives post ids from filenames).
 */
export function isProfilePostId(id: string): boolean {
  if (!id.startsWith(PROFILE_POST_ID_PREFIX)) return false;
  if (id.length > PROFILE_POST_ID_MAX_LENGTH) return false;
  return PROFILE_SLUG_REGEX.test(id.slice(PROFILE_POST_ID_PREFIX.length));
}

/**
 * A post's deterministic id from its file: `pp-<slug>-<basename>`
 * where `basename` is the filename without its extension. The mapping
 * is stable — the same file always produces the same Post Card anchor
 * and the same managed like-store key.
 *
 * @param slug - The profile folder slug.
 * @param basename - The post file's name without extension.
 * @returns `pp-<slug>-<basename>`.
 */
export function postIdFor(slug: string, basename: string): string {
  return `${PROFILE_POST_ID_PREFIX}${slug}-${basename}`;
}

/**
 * The profile's public route path — locale-stripped; the next-intl
 * `Link`/`redirect` apply the Locale prefix automatically (ADR 00-005).
 *
 * @param slug - The profile's `id`.
 * @returns `/u/<slug>`.
 */
export function profilePath(slug: string): string {
  return `/u/${slug}`;
}

/**
 * Implements ADR 03-004: Model Profiles — the folder-default overlay:
 * a profile exists iff its `public/images/profiles/<slug>/` folder
 * does, so a folder holding no `profile:<slug>` overlay publishes as
 * `{enabled: true, avatar: '', posts: {}}` — existence alone is publish
 * intent, and an empty override map leaves every derived post at its
 * filesystem baseline (`avatar: ''` resolves to the folder's profile
 * image — the first sorted `profile*` file, else the first sorted
 * image — at read).
 *
 * @param slug - The folder slug the defaults belong to.
 * @returns The default overlay for a bare folder.
 */
export function profileDefaults(slug: string): ProfileOverlay {
  return { id: slug, enabled: true, avatar: '', posts: {} };
}

/**
 * Implements ADR 03-004: Model Profiles — the display name is DERIVED
 * from the slug, never stored: the slug's `-` word separators become
 * spaces and each word is capitalized, so `helena-duarte` renders
 * `Helena Duarte` and `model-2` renders `Model 2`. A
 * `PROFILE_SLUG_REGEX`-conformant slug is already lowercase `a-z0-9-`,
 * so capitalization is the only transform needed; empty words (a
 * slug-safe string can still carry a `-` run) drop rather than
 * produce double spaces.
 *
 * @param slug - The profile slug (folder name, route segment, handle).
 * @returns The display name derived from the slug — `''` only for an
 *   empty input.
 */
export function deslugifyProfileName(slug: string): string {
  return slug
    .split('-')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Implements ADR 03-004: Model Profiles — the profile's display name
 * everywhere it renders (Profile Route header, Post Card author
 * header, media-alt fallback, Admin selector): one derived string so
 * no surface can drift from the folder-named identity.
 *
 * @param profile - The normalized Model Profile.
 * @returns `deslugifyProfileName(profile.id)`.
 */
export function profileDisplayName(profile: ModelProfile): string {
  return deslugifyProfileName(profile.id);
}

/**
 * Parse a caption sidecar `<basename>.txt` into its per-Locale
 * sections: text under a `[PT]` or `[EN]` header (matched
 * case-insensitively) is that Locale's caption — multi-line preserved,
 * trailing blank lines trimmed. A line shaped like `[anything else]`
 * ends collection until the next known header; a missing section
 * yields `''` for that Locale. Pure string parsing — CRLF tolerated by
 * the line split, and a leading UTF-8 BOM (`\uFEFF`, which
 * some editors prepend) is stripped so it cannot fuse to the first
 * line and keep a leading `[PT]`/`[EN]` header from matching.
 *
 * @param text - The sidecar file's raw content.
 * @returns `{pt, en}` section text; `''` for absent sections.
 */
export function parseCaptionSidecar(text: string): LocalizedText {
  const sections: { pt: string[]; en: string[] } = { pt: [], en: [] };
  let current: 'pt' | 'en' | null = null;
  const content = text.startsWith('\uFEFF') ? text.slice(1) : text;
  for (const line of content.split(/\r?\n/)) {
    const header = /^\s*\[(pt|en)\]\s*$/i.exec(line);
    if (header !== null) {
      current = header[1].toLowerCase() as 'pt' | 'en';
      continue;
    }
    // Any other bracketed line is a foreign section header — lines
    // under it belong to no Locale, so collection pauses.
    if (/^\s*\[[^\]]*\]\s*$/.test(line)) {
      current = null;
      continue;
    }
    if (current !== null) sections[current].push(line);
  }
  const joinSection = (lines: string[]): string => {
    const kept = lines.slice();
    while (kept.length > 0 && kept[kept.length - 1].trim() === '') {
      kept.pop();
    }
    return kept.join('\n');
  };
  return { pt: joinSection(sections.pt), en: joinSection(sections.en) };
}

/** Narrow an unknown value to a `LocalizedText`, defaulting missing or
 *  non-string fields to `''` — partially-filled operator copy still
 *  normalizes. Exported for `saveProfile`'s baseline diff, which
 *  narrows a submitted field the same way before comparing it against
 *  the filesystem baseline. */
export function normalizeLocalizedText(raw: unknown): LocalizedText {
  if (!raw || typeof raw !== 'object') return { pt: '', en: '' };
  const source = raw as Record<string, unknown>;
  return {
    pt: typeof source.pt === 'string' ? source.pt : '',
    en: typeof source.en === 'string' ? source.en : '',
  };
}

/** Narrow an unknown value to a root-relative `public/` asset path —
 *  `/...` but never protocol-relative `//...` — else `null`. */
function asPublicPathOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

/** Narrow an unknown value to a non-negative integer like count.
 *  Exported for `saveProfile`'s baseline diff — the same clamp the
 *  store-side normalization applies. */
export function asLikeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * Normalize one `posts` map entry into a `ProfilePostOverride` —
 * sparse semantics: only fields that normalize are kept, so a stored
 * entry carrying no recognizable override drops out entirely.
 *
 * @param value - The untrusted stored override value.
 * @returns The normalized override, or `null` when it carries no
 *   usable field.
 */
function normalizePostOverride(value: unknown): ProfilePostOverride | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const override: ProfilePostOverride = {};
  if (typeof source.visible === 'boolean') override.visible = source.visible;
  if (typeof source.likes === 'number' && Number.isFinite(source.likes)) {
    override.likes = asLikeCount(source.likes);
  }
  if (source.caption && typeof source.caption === 'object') {
    override.caption = normalizeLocalizedText(source.caption);
  }
  if (source.alt && typeof source.alt === 'object') {
    override.alt = normalizeLocalizedText(source.alt);
  }
  return Object.keys(override).length > 0 ? override : null;
}

/**
 * Implements ADR 03-004: Model Profiles — the `profile:<slug>`
 * documents are operator-supplied data persisted in the managed
 * store, so normalization follows the same posture as
 * `normalizeSiteConfig` and `normalizeCampaigns`: unknown keys
 * ignored, malformed entries drop out entirely, and the function
 * never throws.
 *
 * A profile survives only with a non-empty `id` that is slug-safe,
 * unique across the list, and not a `RESERVED_PROFILE_SLUGS` member;
 * the remaining fields — the document's `{enabled, avatar, posts}`
 * overlay — are coerced (`enabled` defaults to `false`: an unchecked
 * or malformed submit stays unpublished, fail-closed; `avatar` to
 * `''`, which the server-side read resolves to the folder's profile
 * image). `posts` is the sparse override map: each key must be a
 * well-formed `pp-<slug>-` id belonging to THIS profile — the
 * deterministic `postIdFor` convention means a foreign or malformed
 * key can never merge with a file — and each value must yield at
 * least one recognizable override field; entries failing either check
 * drop individually, never the whole profile.
 *
 * @param raw - Untrusted value (a stored profile document or an admin
 *   submit — one entry per `profile:<slug>` record).
 * @returns The well-formed profile overlays contained in `raw`, in
 *   order.
 */
export function normalizeProfiles(raw: unknown): ProfileOverlay[] {
  if (!Array.isArray(raw)) return [];
  const out: ProfileOverlay[] = [];
  const seenProfileIds = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const source = entry as Record<string, unknown>;

    const id = typeof source.id === 'string' ? source.id.trim() : '';
    // Hard requirements — a profile with an empty, non-slug-safe,
    // reserved, or duplicate id drops out entirely: the id is the
    // route segment and the @handle, so no coercion is acceptable.
    if (
      id.length === 0 ||
      !PROFILE_SLUG_REGEX.test(id) ||
      RESERVED_PROFILE_SLUGS.includes(id) ||
      seenProfileIds.has(id)
    )
      continue;
    seenProfileIds.add(id);

    const posts: Record<string, ProfilePostOverride> = {};
    // The overlay posts map is a Record keyed by deterministic post
    // id — arrays and scalars are malformed and yield no overrides.
    if (
      source.posts !== null &&
      typeof source.posts === 'object' &&
      !Array.isArray(source.posts)
    ) {
      for (const [key, value] of Object.entries(
        source.posts as Record<string, unknown>
      )) {
        const postId = key.trim();
        // A usable overlay key is a well-formed `pp-` id belonging to
        // this profile — `pp-<slug>-<basename>`; anything else can
        // never merge with a folder file, so it drops.
        if (
          !isProfilePostId(postId) ||
          !postId.startsWith(`${PROFILE_POST_ID_PREFIX}${id}-`)
        )
          continue;
        const override = normalizePostOverride(value);
        if (override !== null) posts[postId] = override;
      }
    }

    out.push({
      id,
      enabled: typeof source.enabled === 'boolean' ? source.enabled : false,
      avatar: asPublicPathOrNull(source.avatar) ?? '',
      posts,
    });
  }
  return out;
}

/**
 * Every profile post across the given profiles, flattened in
 * profile-list order — the domain the like counter's GET serves and
 * the Admin Console's aggregate view enumerates.
 *
 * @param profiles - Read profiles (enabled or not — like data is
 *   aggregate operator data, and a disabled profile's posts still
 *   hold authored base counts).
 * @returns All posts in profile order, then filename order.
 */
export function allProfilePosts(
  profiles: readonly ModelProfile[]
): ProfilePost[] {
  return profiles.flatMap((profile) => profile.posts);
}

/**
 * Implements ADR 03-004: Model Profiles — "a post renders in the feed
 * and on the Profile Route and accepts likes only while its profile
 * is enabled and the post itself is visible" — the PUBLISHED post
 * domain as `{profile, post}` pairs: every enabled profile's visible
 * posts, in profile order then filename order, keeping each post's
 * owning profile attached. The landing feed's shuffled tail renders
 * the pairs directly (the card needs the profile's author identity).
 *
 * @param profiles - Read profiles (enabled or not — the filter is
 *   this function's job).
 * @returns The `{profile, post}` pairs of the published post set.
 */
export function publishedProfilePostPairs(
  profiles: readonly ModelProfile[]
): { profile: ModelProfile; post: ProfilePost }[] {
  return profiles
    .filter((profile) => profile.enabled)
    .flatMap((profile) =>
      profile.posts
        .filter((post) => post.visible)
        .map((post) => ({ profile, post }))
    );
}

/**
 * Implements ADR 03-004: Model Profiles — the published post domain
 * as a flat posts list: enabled profiles' visible posts only, in
 * profile order then filename order. The like counter serves and
 * toggles exactly this set — unpublished or hidden posts hold no
 * public count, matching the Profile Route's not-found posture.
 *
 * @param profiles - Read profiles (enabled or not — the filter is
 *   this function's job).
 * @returns The published posts, flattened in profile order.
 */
export function publishedProfilePosts(
  profiles: readonly ModelProfile[]
): ProfilePost[] {
  return publishedProfilePostPairs(profiles).map(({ post }) => post);
}

/**
 * Implements ADR 03-004: Model Profiles — the landing feed's appended
 * profile-post tail is shuffled per request: every enabled profile's
 * visible posts interleave across profiles in a fresh random order
 * instead of rendering grouped in alphabetical folder order.
 *
 * Fisher–Yates shuffle on a copy: the input array is never mutated
 * (callers keep their derived order — the `/u/<slug>` Profile Route
 * and the `allProfilePosts` aggregate are unshuffled domains), and
 * each call draws a new `Math.random()` permutation so
 * server-rendered requests get independent orders.
 *
 * @param items - The list to shuffle — read-only, never mutated.
 * @returns A new array holding the same items in random order.
 */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  // Walk from the last index down, swapping each position with a
  // uniformly drawn earlier-or-equal index — the standard Fisher–Yates
  // pass that yields an unbiased permutation.
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const held = out[i];
    out[i] = out[j];
    out[j] = held;
  }
  return out;
}

/**
 * Find one profile post by id across all profiles — the existence
 * check the like counter's POST applies to `pp-` ids (an id passing
 * `isProfilePostId` is only valid when it names a real derived post).
 *
 * @param profiles - Read profiles to search.
 * @param postId - The candidate post id.
 * @returns The matching post, or `null` when no profile carries it.
 */
export function findProfilePost(
  profiles: readonly ModelProfile[],
  postId: string
): ProfilePost | null {
  for (const profile of profiles) {
    const post = profile.posts.find((entry) => entry.id === postId);
    if (post !== undefined) return post;
  }
  return null;
}
