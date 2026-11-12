import { FEED_POSTS } from '@/lib/feed-posts';

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "The displayed like count is
 * the sum of an authored base count — part of the Post Card's
 * code-managed content — and a shared delta persisted server-side in
 * the managed store of ADR 00-002" and "deduplicated server-side per
 * Post Card by a Like Token: an anonymous, self-generated per-browser
 * identifier held in client-side storage, never a cookie, sent only
 * with the toggle request".
 *
 * Implements ADR 00-008: Analytics and Consent — Cookieless,
 * Privacy-First Measurement - "a self-generated, per-browser token held
 * in client-side storage — never a cookie, never server-issued — sent
 * only to that feature's own endpoint and feeding aggregate counters
 * only".
 *
 * Pure, side-effect-free helpers shared by the like counter Route
 * Handler and unit tests: the authored base counts, the managed-store
 * key convention, and narrowing validation of the toggle body. No
 * Redis or framework imports so the module stays testable in Node.
 */

/** Maximum accepted Like Token length — client-minted UUIDs are 36
 *  chars; the bound only rejects abusive input. */
export const LIKE_TOKEN_MAX_LENGTH = 128;

/** Redis key holding one Post Card's dedup set of Like Tokens. */
export function likeKey(postId: string): string {
  return `likes:${postId}`;
}

/**
 * The authored base like counts keyed by Post Card id — what the
 * Interaction Row shows when the managed store is unconfigured or
 * unreachable (fail-closed degradation, ADR 00-002).
 *
 * @returns `{ <postId>: <authored base count> }` for every `FEED_POSTS`
 *   entry.
 */
export function baseLikeCounts(): Record<string, number> {
  return Object.fromEntries(FEED_POSTS.map((post) => [post.id, post.likes]));
}

/** The validated body of a like-toggle POST. */
export interface LikeToggleBody {
  /** Post Card id — must name a real `FEED_POSTS` entry. */
  postId: string;
  /** The visitor's Like Token — opaque, never logged (ADR 00-008). */
  token: string;
  /** `true` records the like (SADD); `false` removes it (SREM). */
  liked: boolean;
}

/**
 * Narrow parsed JSON to the like-toggle body shape.
 *
 * Validation rules: `postId` must be a real `FEED_POSTS` id (arbitrary
 * strings would mint unmanaged Redis keys); `token` a non-empty string
 * within `LIKE_TOKEN_MAX_LENGTH`; `liked` a strict boolean.
 *
 * @param body - `JSON.parse` output (untrusted).
 * @returns The typed body, or `null` when any field is malformed.
 */
export function parseLikeToggleBody(body: unknown): LikeToggleBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const candidate = body as Record<string, unknown>;

  if (
    typeof candidate.postId !== 'string' ||
    !FEED_POSTS.some((post) => post.id === candidate.postId)
  ) {
    return null;
  }

  if (
    typeof candidate.token !== 'string' ||
    candidate.token.length === 0 ||
    candidate.token.length > LIKE_TOKEN_MAX_LENGTH
  ) {
    return null;
  }

  if (typeof candidate.liked !== 'boolean') {
    return null;
  }

  return candidate as unknown as LikeToggleBody;
}
