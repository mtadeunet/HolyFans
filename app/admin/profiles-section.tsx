'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import {
  deslugifyProfileName,
  profileDisplayName,
  type ModelProfile,
  type ProfilePost,
} from '@/lib/profiles';
import { saveProfile, type SaveResult } from './actions';
import type { StoreStatus } from './types';

/**
 * Implements ADR 03-004: Model Profiles — the Admin Console's Profiles
 * tab: the per-folder profile editor. The profile set is the
 * filesystem — the selector lists the `public/images/profiles/<slug>/`
 * folders, so adding a model is creating a folder, never a console
 * action — and the post set is too: every image file in the folder
 * whose basename does not start with `profile` IS a post, so the
 * editor enumerates rows from the derived posts rather than offering
 * add/remove controls or a media picker. Each folder's `profile:<slug>`
 * SPARSE overlay document (`enabled`, `avatar`, per-post `visible` /
 * `likes` / `caption` / `alt` overrides) edits here and persists
 * through the `saveProfile` Server Action, outside the Site Config
 * form. The store's health is surfaced in a banner with the same
 * posture as the Likes and Stock Notifications sections.
 */

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none ring-primary/30 transition focus:border-primary focus:ring';
const fieldLabelClass = 'mb-1 block text-xs font-medium text-text-secondary';

/**
 * The editor's starting drafts: one per folder, seeded from the
 * profile the folder's `profile:<slug>` document merged into at read
 * (enabled flag, avatar, and effective posts — overlay fields already
 * applied over the filesystem baseline). A folder whose stored
 * document failed normalization — or a folder read while the store
 * is unconfigured — falls back to the publish-by-default overlay over
 * the folder's own derived baseline posts: the editor never loses a
 * folder, and its post rows always enumerate the real files.
 */
function initialDrafts(
  folders: readonly string[],
  profiles: readonly ModelProfile[],
  baselinePosts: Record<string, ProfilePost[]>
): Record<string, ModelProfile> {
  const stored = new Map(profiles.map((profile) => [profile.id, profile]));
  return Object.fromEntries(
    folders.map((slug) => [
      slug,
      stored.get(slug) ?? {
        id: slug,
        enabled: true,
        avatar: '',
        posts: baselinePosts[slug] ?? [],
      },
    ])
  );
}

interface PostCardPreviewProps {
  /** The profile draft the post belongs to — supplies the derived
   *  display name and the `@<slug>` handle. */
  profile: ModelProfile;
  /** The post draft being previewed — media, per-Locale captions,
   *  base likes, and the `visible` flag all render live. */
  post: ProfilePost;
  /** The avatar path the header renders — the draft's selected avatar,
   *  or the folder's auto-resolved profile image when the draft's is
   *  `''`; `''` renders the feed's plain circle placeholder. */
  avatarSrc: string;
}

/**
 * Implements ADR 03-004: Model Profiles — the post editor's live
 * preview: a static, presentational rendering of how the draft post
 * will look as a feed Post Card (author header, localized caption,
 * Media Slot, like row), mirroring `components/feed/post-card.tsx`'s
 * structure and Tailwind classes without importing the server
 * component (its `next-intl` translations are server-side). Both
 * Locales' captions render labeled so the operator sees each stored
 * value at once; `visible: false` surfaces as a `hidden` badge rather
 * than removing the preview.
 *
 * Pure derived markup — it re-renders from the draft on every edit,
 * carrying no state of its own.
 *
 * @param props - The profile draft, the post draft, and the resolved
 *   avatar path.
 * @returns The preview card markup.
 */
function PostCardPreview({ profile, post, avatarSrc }: PostCardPreviewProps) {
  const name = profileDisplayName(profile);
  // The media alt mirrors the ProfilePostCard fallback chain — the
  // authored per-Locale alt, then the derived display name — with pt
  // preferred as the operator's primary authoring Locale.
  const mediaAlt = post.alt?.pt || post.alt?.en || name;
  const captionTagClass =
    'mr-1.5 inline-block rounded border border-border bg-background px-1 align-middle text-xs font-semibold uppercase text-text-secondary';
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <p className="border-b border-border bg-background px-4 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
        Preview
      </p>
      <article className="bg-surface">
        {/* Same header as the feed card's author variant: circular
            avatar (or the plain placeholder circle), display name, and
            the decorative `@<slug>` handle. */}
        <header className="flex items-center gap-3 px-4 py-3">
          {avatarSrc !== '' ? (
            <Image
              src={avatarSrc}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full border border-border object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="h-10 w-10 rounded-full border border-border bg-background"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {name}
            </p>
            <p className="truncate text-sm text-text-secondary">
              @{profile.id}
            </p>
          </div>
        </header>

        {/* The feed card's caption slot renders one Locale; the preview
            shows both, each labeled, with a muted placeholder for an
            unset value so the operator sees the stored pair. */}
        <div className="space-y-1 px-4 pb-3">
          <p className="text-sm leading-relaxed text-text-primary">
            <span className={captionTagClass}>PT</span>
            {post.caption.pt === '' ? (
              <span className="text-text-secondary">(sem legenda)</span>
            ) : (
              post.caption.pt
            )}
          </p>
          <p className="text-sm leading-relaxed text-text-primary">
            <span className={captionTagClass}>EN</span>
            {post.caption.en === '' ? (
              <span className="text-text-secondary">(no caption)</span>
            ) : (
              post.caption.en
            )}
          </p>
        </div>

        {/* MediaSlot look: a square, cover-cropped region. The post IS
            its image file — media always exists. */}
        <div className="relative aspect-square w-full overflow-hidden bg-surface">
          <Image
            src={post.media}
            alt={mediaAlt}
            fill
            sizes="(max-width: 768px) 100vw, 576px"
            className="object-cover"
          />
        </div>

        {/* Static stand-in for the Interaction Row: the base like count
            with the same heart glyph, plus a `hidden` badge while the
            post's `visible` flag is off. */}
        <div className="flex items-center gap-4 px-4 py-3">
          <svg
            className="h-6 w-6 text-text-secondary"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span className="text-sm font-medium text-text-secondary">
            {post.likes} likes
          </span>
          {!post.visible && (
            <span className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-text-secondary">
              hidden
            </span>
          )}
        </div>
      </article>
    </div>
  );
}

interface ProfilesSectionProps {
  /** Store health: connected, unconfigured, or a failed read. */
  status: StoreStatus;
  /** The store's error message when `status` is `'error'`. */
  statusDetail?: string;
  /**
   * Implements ADR 03-004: Model Profiles — the profile set itself:
   * the sorted `public/images/profiles/<slug>/` folder names the
   * selector enumerates. Adding a model is a filesystem operation —
   * the console only edits what the folders define.
   */
  folders: string[];
  /** The profiles as read: each folder's overlay merged onto its
   *  filesystem-derived posts — the drafts seed from it, falling back
   *  to `baselinePosts` for a folder with no readable overlay. */
  profiles: ModelProfile[];
  /**
   * Implements ADR 03-004: Model Profiles — each folder's derived
   * baseline posts (files + sidecar captions, no overlay applied).
   * The drafts of folders with no readable profile fall back to it,
   * so post rows enumerate the real files whatever the store's state.
   */
  baselinePosts: Record<string, ProfilePost[]>;
  /**
   * Implements ADR 03-004: Model Profiles — the per-model image map
   * (each `public/images/profiles/<slug>/` folder's sorted image
   * paths) the avatar select indexes by slug. Picker only — no upload
   * path exists.
   */
  availableImages: Record<string, string[]>;
}

/**
 * The Profiles section body: the folder selector (display name derived
 * from the slug), the selected profile's read-only identity, its
 * enabled flag and avatar picker, and its post list — one row per
 * image file in the folder (read-only thumbnail, post id, per-Locale
 * caption inputs prefilled with the effective sidecar-or-override
 * caption, base likes, and the per-post `visible` toggle), each with
 * a live feed-card preview. One Save button persists ONLY the
 * selected profile through `saveProfile`, which diffs the draft
 * against server-recomputed filesystem baselines into the sparse
 * overlay.
 *
 * @param props - Store status, the profile folders, the merged
 *   profiles, the per-folder baseline posts, and the per-model image
 *   map.
 * @returns The Profiles section markup.
 */
export default function ProfilesSection({
  status,
  statusDetail,
  folders,
  profiles: initialProfiles,
  baselinePosts,
  availableImages,
}: ProfilesSectionProps) {
  /**
   * Implements ADR 03-004: Model Profiles — the editor's state.
   * `selectedSlug` picks the folder the editor shows; `drafts` holds
   * every folder's edited overlay (edits survive switching folders —
   * the Save button still persists only the selected one). Post rows
   * key on the deterministic `pp-<slug>-<basename>` id — stable
   * across edits by construction, so no separate row-key bookkeeping
   * exists.
   *
   * `initialDraftMap` is computed ONCE (lazy state initializer) and
   * seeds `drafts`. The seeds intentionally do not resync when
   * `initialProfiles` changes after a server revalidation — accepted
   * for a single-operator console; a reload re-seeds them.
   */
  const [initialDraftMap] = useState<Record<string, ModelProfile>>(() =>
    initialDrafts(folders, initialProfiles, baselinePosts)
  );
  const [selectedSlug, setSelectedSlug] = useState(folders[0] ?? '');
  const [drafts, setDrafts] =
    useState<Record<string, ModelProfile>>(initialDraftMap);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<SaveResult | null>(null);

  const selectedProfileData = drafts[selectedSlug];

  /**
   * Implements ADR 03-004: the avatar picker enumerates
   * `public/images/profiles/<slug>/` — the same listing the
   * server-side avatar fallback applies, so the select's options are
   * exactly the images the folder offers.
   */
  const selectedProfileImages = availableImages[selectedSlug] ?? [];

  /**
   * Implements ADR 03-004: the preview's avatar mirrors the
   * server-side read's `''` resolution — the first sorted image whose
   * basename (extension stripped) starts with `profile`,
   * case-insensitive, else the folder's first sorted image — so the
   * header shows what publishing the current draft would. A selected
   * avatar renders verbatim, including a stored path the folder no
   * longer enumerates.
   */
  const previewAvatarSrc =
    selectedProfileData !== undefined && selectedProfileData.avatar !== ''
      ? selectedProfileData.avatar
      : (selectedProfileImages.find((src) =>
          (src.split('/').pop() ?? '')
            .replace(/\.[^./]*$/, '')
            .toLowerCase()
            .startsWith('profile')
        ) ??
        selectedProfileImages[0] ??
        '');

  /**
   * Implements ADR 03-004: when the selected folder holds no images,
   * the avatar picker offers only the empty option plus this hint
   * telling the operator where to drop assets.
   */
  const imageFolderHint =
    selectedProfileData !== undefined && selectedProfileImages.length === 0 ? (
      <span className="mt-1 block text-xs text-text-secondary">
        Drop images into <code>public/images/profiles/{selectedSlug}/</code> to
        pick them here
      </span>
    ) : null;

  /**
   * The single draft-mutation primitive every updater funnels
   * through: replaces the selected folder's draft with `mutate`'s
   * result inside the drafts map.
   */
  const patchDraft = (mutate: (draft: ModelProfile) => ModelProfile): void =>
    setDrafts((prev) => {
      const current = prev[selectedSlug];
      return current === undefined
        ? prev
        : { ...prev, [selectedSlug]: mutate(current) };
    });

  const updateProfile = (patch: Partial<ModelProfile>): void =>
    patchDraft((draft) => ({ ...draft, ...patch }));

  /**
   * Per-post edits address the post by its deterministic id — the
   * file-derived identity the server-side sparse diff matches
   * against, stable across caption/likes/visible edits.
   */
  const updateProfilePost = (
    postId: string,
    patch: Partial<ProfilePost>
  ): void =>
    patchDraft((draft) => ({
      ...draft,
      posts: draft.posts.map((post) =>
        post.id === postId ? { ...post, ...patch } : post
      ),
    }));

  const updatePostCaption = (
    postId: string,
    locale: 'pt' | 'en',
    value: string
  ): void =>
    patchDraft((draft) => ({
      ...draft,
      posts: draft.posts.map((post) =>
        post.id === postId
          ? { ...post, caption: { ...post.caption, [locale]: value } }
          : post
      ),
    }));

  /**
   * Implements ADR 03-004: Model Profiles — the post's optional
   * per-Locale alt override. Blanking both Locales drops the `alt`
   * field entirely — the schema's "absent means fall back to the
   * profile's derived display name" form.
   */
  const updatePostAlt = (
    postId: string,
    locale: 'pt' | 'en',
    value: string
  ): void =>
    patchDraft((draft) => ({
      ...draft,
      posts: draft.posts.map((post) => {
        if (post.id !== postId) return post;
        const alt = {
          pt: post.alt?.pt ?? '',
          en: post.alt?.en ?? '',
          [locale]: value,
        };
        const next = { ...post };
        if (alt.pt === '' && alt.en === '') {
          delete next.alt;
        } else {
          next.alt = alt;
        }
        return next;
      }),
    }));

  /**
   * Implements ADR 03-004: Model Profiles — the SELECTED profile's
   * draft travels to `saveProfile` as a serializable server-action
   * argument; the action recomputes the filesystem baselines, diffs
   * each submitted post into the sparse overlay, rejects a post id
   * naming no folder image (`unknown_post`), and rejects a slug the
   * filesystem does not define (`unknown_profile`) before the
   * single-document write.
   */
  const onSave = (): void => {
    const draft = drafts[selectedSlug];
    if (draft === undefined) return;
    setSaveStatus(null);
    startTransition(async () => {
      setSaveStatus(await saveProfile(draft));
    });
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-1 text-xl font-semibold text-text-primary">Profiles</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Model profiles — an enabled profile publishes at{' '}
        <code>/u/&lt;slug&gt;</code> and mixes its posts into the landing feed
        after the authored posts. Posts are the folder&apos;s image files:
        drop an image into <code>public/images/profiles/&lt;slug&gt;/</code> to
        publish it (a <code>&lt;name&gt;.txt</code> sidecar with{' '}
        <code>[PT]</code>/<code>[EN]</code> sections supplies its caption), and
        uncheck Visible to hide one without deleting it.
      </p>

      {/* Store health banner — connected, unconfigured, or a failed
          read, with the error surfaced rather than silent (the same
          posture as the Likes and Stock Notifications sections). */}
      {status === 'connected' && (
        <p className="mb-4 text-sm text-green-700" role="status">
          Profile store: connected.
        </p>
      )}
      {status === 'unconfigured' && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          Profile store: not configured — profiles cannot load or save.
        </p>
      )}
      {status === 'error' && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          Profile store: read failed
          {statusDetail ? ` — ${statusDetail}` : ''}. Editing folder defaults.
        </p>
      )}

      {/* Implements ADR 03-004: Model Profiles — the selector lists
          the FOLDERS, the profile set itself: the display name shown
          is derived from the slug (`deslugifyProfileName`), and there
          is no add/remove — creating `public/images/profiles/<slug>/`
          is how a model is added. */}
      <label className="block">
        <span className={fieldLabelClass}>Profile</span>
        <select
          value={selectedSlug}
          onChange={(event) => setSelectedSlug(event.target.value)}
          disabled={folders.length === 0}
          className={inputClass}
        >
          {folders.map((slug) => (
            <option key={slug} value={slug}>
              {deslugifyProfileName(slug)} (@{slug})
            </option>
          ))}
        </select>
      </label>

      {selectedProfileData === undefined ? (
        <p className="mt-4 text-sm text-text-secondary">
          No profile folders yet — create{' '}
          <code>public/images/profiles/&lt;slug&gt;/</code> to add a model.
        </p>
      ) : (
        <div className="mt-4 space-y-4 rounded-lg border border-border bg-background px-4 py-4">
          {/* Implements ADR 03-004: Model Profiles — the identity is
              read-only: the slug IS the folder name, and the display
              name is derived from it — nothing here is editable
              because nothing here is stored. */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <input
                type="checkbox"
                checked={selectedProfileData.enabled}
                onChange={(event) =>
                  updateProfile({ enabled: event.target.checked })
                }
                className="h-5 w-5 accent-primary"
              />
              Enabled
            </label>
            <div className="min-w-40 flex-1">
              <span className={fieldLabelClass}>Slug · display name</span>
              <p className="text-sm text-text-primary">
                <code className="font-medium">{selectedSlug}</code>
                {' · '}
                {profileDisplayName(selectedProfileData)}
              </p>
              <span className="mt-1 block text-xs text-text-secondary">
                Profile folders live in{' '}
                <code>public/images/profiles/&lt;slug&gt;/</code> — create the
                folder to add a model.
              </span>
            </div>
          </div>

          <label className="block">
            <span className={fieldLabelClass}>Avatar</span>
            <div className="flex items-center gap-3">
              <select
                value={selectedProfileData.avatar}
                onChange={(event) =>
                  updateProfile({ avatar: event.target.value })
                }
                className={`${inputClass} flex-1`}
              >
                {/* `''` means "unset": the server-side read resolves it
                    to the folder's profile image — the first sorted
                    `profile*` file, else the first sorted image — the
                    picker states that honestly. */}
                <option value="">— auto (profile image) —</option>
                {/* A stored path the picker can't enumerate (asset
                    renamed, record hand-edited, or `public/` not
                    traced into the deployed function) stays selectable
                    — never silently cleared on save. */}
                {selectedProfileData.avatar !== '' &&
                  !selectedProfileImages.includes(
                    selectedProfileData.avatar
                  ) && (
                    <option value={selectedProfileData.avatar}>
                      {selectedProfileData.avatar} (not in this folder)
                    </option>
                  )}
                {selectedProfileImages.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
              {selectedProfileData.avatar !== '' && (
                <Image
                  src={selectedProfileData.avatar}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border border-border object-cover"
                />
              )}
            </div>
            {imageFolderHint}
          </label>

          {/* Implements ADR 03-004: Model Profiles — one row per POST
              FILE: the post set is the folder's non-`profile*` image
              files, so rows enumerate automatically — no add/remove
              buttons and no media picker exist; the file is the post.
              Editable per row: caption overrides (prefilled with the
              effective caption — the sidecar's sections unless the
              operator already overrode), optional alt, base likes, and
              the `visible` toggle. */}
          <div className="space-y-4">
            {selectedProfileData.posts.map((post) => (
              <div
                key={post.id}
                className="space-y-3 rounded-md border border-border px-3 py-3"
              >
                <div className="flex flex-wrap items-end gap-3">
                  {/* The post's media is its file — shown, never
                      picked: the filename is the post's identity. */}
                  <div className="min-w-40 flex-1">
                    <span className={fieldLabelClass}>Image</span>
                    <div className="flex items-center gap-3">
                      <Image
                        src={post.media}
                        alt=""
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded border border-border object-cover"
                      />
                      <code className="truncate text-xs text-text-secondary">
                        {post.media.split('/').pop()}
                      </code>
                    </div>
                  </div>
                  <label className="block w-28">
                    <span className={fieldLabelClass}>Base likes</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={post.likes}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        updateProfilePost(post.id, {
                          likes: Number.isFinite(value)
                            ? Math.max(0, Math.floor(value))
                            : 0,
                        });
                      }}
                      className={inputClass}
                    />
                  </label>
                  {/* Implements ADR 03-004: the post's `visible`
                      toggle — `false` hides the post from the feed and
                      the profile route without deleting its file. */}
                  <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <input
                      type="checkbox"
                      checked={post.visible}
                      onChange={(event) =>
                        updateProfilePost(post.id, {
                          visible: event.target.checked,
                        })
                      }
                      className="h-5 w-5 accent-primary"
                    />
                    Visible
                  </label>
                </div>
                <p className="text-xs text-text-secondary">
                  <code>{post.id}</code>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={fieldLabelClass}>Caption (PT)</span>
                    <textarea
                      rows={3}
                      value={post.caption.pt}
                      onChange={(event) =>
                        updatePostCaption(post.id, 'pt', event.target.value)
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={fieldLabelClass}>Caption (EN)</span>
                    <textarea
                      rows={3}
                      value={post.caption.en}
                      onChange={(event) =>
                        updatePostCaption(post.id, 'en', event.target.value)
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
                {/* Implements ADR 03-004: the optional per-Locale
                    alt override — both blank drops `alt` so the
                    Media Slot falls back to the derived display
                    name. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={fieldLabelClass}>
                      Alt text (PT, optional)
                    </span>
                    <input
                      type="text"
                      value={post.alt?.pt ?? ''}
                      onChange={(event) =>
                        updatePostAlt(post.id, 'pt', event.target.value)
                      }
                      placeholder="Falls back to the profile name"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={fieldLabelClass}>
                      Alt text (EN, optional)
                    </span>
                    <input
                      type="text"
                      value={post.alt?.en ?? ''}
                      onChange={(event) =>
                        updatePostAlt(post.id, 'en', event.target.value)
                      }
                      placeholder="Falls back to the profile name"
                      className={inputClass}
                    />
                  </label>
                </div>
                {/* Live feed-card preview of the current draft — pure
                    derived markup, updated by every edit above. */}
                <PostCardPreview
                  profile={selectedProfileData}
                  post={post}
                  avatarSrc={previewAvatarSrc}
                />
              </div>
            ))}
          </div>
          {selectedProfileData.posts.length === 0 && (
            <p className="text-sm text-text-secondary">
              This folder holds no post images — drop image files into{' '}
              <code>public/images/profiles/{selectedSlug}/</code> and they
              publish automatically (files named <code>profile*</code> are
              avatars, not posts).
            </p>
          )}
        </div>
      )}

      {/* The section's own Save row — the selected profile's sparse
          overlay write goes to the managed store through
          `saveProfile`, outside the Site Config form. */}
      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={onSave}
          disabled={isPending || selectedProfileData === undefined}
          className="btn-primary px-6 py-3 shadow disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save profile'}
        </button>
        {saveStatus?.ok === true && (
          <span className="text-sm text-green-700" role="status">
            Saved. Changes take effect on the next request.
          </span>
        )}
        {saveStatus && saveStatus.ok === false && (
          <span className="text-sm text-red-600" role="alert">
            {saveStatus.error}
          </span>
        )}
      </div>
    </section>
  );
}
