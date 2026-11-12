'use client';

import { SITE_CONFIG } from '@/lib/constants';
import { LIKE_TOKEN_MAX_LENGTH } from '@/lib/likes';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

/** localStorage key holding the visitor's Like Token — a self-generated
 *  UUID, never a cookie (ADR 00-008). */
const LIKE_TOKEN_KEY = 'holyfans:like-token';
/** localStorage key holding the visitor's liked Post Card ids. */
const LIKED_POSTS_KEY = 'holyfans:liked-posts';

/** Shape of the like counter Route Handler's GET response. */
interface LikeCountsResponse {
  counts?: Record<string, number>;
  live?: boolean;
}

/**
 * The page's single count fetch: every Post Card's Interaction Row
 * shares one memoized GET so a feed of N rows costs exactly one request
 * per page load. `null` means the request failed — the same degraded
 * outcome as `live: false`.
 */
let countsPromise: Promise<LikeCountsResponse | null> | null = null;
function fetchLikeCounts(): Promise<LikeCountsResponse | null> {
  countsPromise ??= fetch('/api/likes')
    .then((response) =>
      response.ok
        ? (response.json() as Promise<LikeCountsResponse>)
        : null
    )
    .catch(() => null);
  return countsPromise;
}

/**
 * Read the visitor's Like Token from client-side storage, minting one
 * with `crypto.randomUUID()` on first use (ADR 00-008: self-generated,
 * per-browser, never a cookie, never server-issued). Storage failures
 * (private mode, disabled storage) yield an ephemeral in-memory token —
 * the toggle still works for the session, dedup just can't persist.
 *
 * @returns The visitor's Like Token.
 */
function readLikeToken(): string {
  try {
    const stored = window.localStorage.getItem(LIKE_TOKEN_KEY);
    if (
      stored !== null &&
      stored.length > 0 &&
      stored.length <= LIKE_TOKEN_MAX_LENGTH
    ) {
      return stored;
    }
    const token = crypto.randomUUID();
    window.localStorage.setItem(LIKE_TOKEN_KEY, token);
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Read the visitor's liked Post Card ids from client-side storage.
 *
 * @returns The set of liked `postId`s; empty on absent, corrupt, or
 *   unavailable storage.
 */
function readLikedPosts(): Set<string> {
  try {
    const raw = window.localStorage.getItem(LIKED_POSTS_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === 'string')
        : []
    );
  } catch {
    return new Set();
  }
}

/**
 * Persist the visitor's liked Post Card ids. Storage failures are
 * swallowed — the server-side dedup set remains the source of truth
 * for the count.
 *
 * @param likedPosts - The liked `postId` set to persist.
 */
function writeLikedPosts(likedPosts: Set<string>): void {
  try {
    window.localStorage.setItem(
      LIKED_POSTS_KEY,
      JSON.stringify([...likedPosts])
    );
  } catch {
    // Storage unavailable — this mount's state still works.
  }
}

interface InteractionRowProps {
  /** The Post Card's id — its anchor target and its key server-side. */
  postId: string;
  /** The authored base like count — part of the Post Card's
   *  code-managed content, shown immediately and replaced by the live
   *  shared total after hydration (ADR 03-002). */
  likes: number;
  /** The post's localized caption, used as the native share text. */
  caption: string;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "Each Post Card carries a
 * row of social-style affordances that is real but bounded — a like
 * control with its count and a share control."
 *
 * The Post Card's Interaction Row — a client Island (ADR 00-001). The
 * like control shows the shared count (authored base + server-persisted
 * delta): it renders the authored base immediately, hydrates the live
 * total after mount, and toggles optimistically with a POST carrying
 * the visitor's Like Token; on failure it rolls back and disables —
 * "when the store is unconfigured or unreachable, the row degrades to
 * the authored base count with toggling disabled — graceful, never a
 * crash" (ADR 00-002). The share control "invokes the visitor device's
 * native share capability with the Post Card's anchored URL on the
 * Store Domain, falling back to clipboard copy" — it transmits nothing
 * to the Storefront and emits no analytics signal (ADR 00-008).
 */
export default function InteractionRow({
  postId,
  likes,
  caption,
}: InteractionRowProps) {
  const t = useTranslations('feed.post');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(likes);
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  /** Guards the toggle against double-submits while a POST is in flight. */
  const pending = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate after mount: the visitor's local liked state plus the shared
  // counts. Both state writes sit behind the fetch await so the authored
  // base renders first — the Island pattern (ADR 00-001).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const storedLiked = readLikedPosts().has(postId);
      const response = await fetchLikeCounts();
      if (cancelled) {
        return;
      }
      setLiked(storedLiked);
      if (response?.live === true) {
        setLive(true);
        const total = response.counts?.[postId];
        if (typeof total === 'number') {
          setCount(total);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  // Clear the copied-feedback timer on unmount.
  useEffect(
    () => () => {
      if (copiedTimer.current !== null) {
        clearTimeout(copiedTimer.current);
      }
    },
    []
  );

  /**
   * Optimistic like toggle (ADR 03-002): flips local state immediately,
   * then POSTs `{postId, token, liked}` — the Like Token goes only to
   * this feature's own endpoint (ADR 00-008). The handler's returned
   * total is adopted as authoritative; any non-200 or network failure
   * rolls back and disables further toggling (fail-closed, ADR 00-002).
   */
  const toggleLike = async () => {
    if (!live || pending.current) {
      return;
    }
    pending.current = true;
    const next = !liked;
    setLiked(next);
    setCount((current) => current + (next ? 1 : -1));
    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          token: readLikeToken(),
          liked: next,
        }),
      });
      const data: unknown = response.ok ? await response.json() : null;
      const total = (data as { count?: unknown } | null)?.count;
      if (typeof total !== 'number') {
        throw new Error('likes unavailable');
      }
      setCount(total);
      const likedPosts = readLikedPosts();
      if (next) {
        likedPosts.add(postId);
      } else {
        likedPosts.delete(postId);
      }
      writeLikedPosts(likedPosts);
    } catch {
      setLiked(!next);
      setCount((current) => current + (next ? -1 : 1));
      setLive(false);
    } finally {
      pending.current = false;
    }
  };

  /**
   * Client-resolved share (ADR 03-002, ADR 00-009's outbound posture):
   * the device's native share capability with the Post Card's anchored
   * URL on the Store Domain; where unsupported, a clipboard copy with a
   * brief "copied" confirmation. Nothing is transmitted to the
   * Storefront and no analytics signal is emitted (ADR 00-008).
   */
  const share = async () => {
    const url = `${SITE_CONFIG.url}/${locale}#${postId}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: tCommon('brand'),
          text: caption,
          url,
        });
        return;
      } catch (error) {
        // Dismissing the native sheet is not a failure — stop quietly.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        // Any other share failure falls through to the clipboard copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copiedTimer.current !== null) {
        clearTimeout(copiedTimer.current);
      }
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions, insecure context) — the
      // affordance stays inert rather than surfacing an error.
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={() => void toggleLike()}
        aria-pressed={liked}
        aria-label={t('like_aria')}
        disabled={!live}
        className={`flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          liked ? 'text-primary' : 'text-text-secondary hover:text-primary'
        }`}
      >
        <svg
          className="h-6 w-6"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={liked ? 0 : 2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </button>
      <span className="text-sm font-medium text-text-secondary">
        {t('likes', { count })}
      </span>

      {/* Share control — client-resolved, transmits nothing to the
          Storefront (ADR 03-002). `copied` swaps the glyph briefly as
          the visual half of the confirmation; the `role="status"` span
          below announces it to assistive tech. */}
      <button
        type="button"
        onClick={() => void share()}
        aria-label={t('share_aria')}
        className={`ml-auto flex items-center justify-center transition-colors ${
          copied
            ? 'text-primary'
            : 'text-text-secondary hover:text-primary'
        }`}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {copied ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
            />
          )}
        </svg>
      </button>
      <span role="status" className="sr-only">
        {copied ? t('share_copied') : ''}
      </span>
    </div>
  );
}
