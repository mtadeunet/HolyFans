import type { Redis } from '@upstash/redis';
import { FEED_POSTS } from '@/lib/feed-posts';
import { likeKey, likeLastKey } from '@/lib/likes';

/** The structural shape every like-counted post shares: an anchor/key
 *  id plus its authored base count. `FeedPost` and `ProfilePost` both
 *  satisfy it, so the like helpers stay post-domain agnostic (ADR
 *  03-004's `pp-` ids join the same base+delta semantics). */
export interface LikeablePost {
  id: string;
  likes: number;
}

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "Small shared
 * request-time state persists in a managed Redis store provisioned
 * through the Hosting Platform's marketplace ... When the store is
 * unconfigured or unreachable, the Interaction Row degrades to authored
 * base counts with toggling disabled" and the Admin Console's
 * "request-time read of the like store's aggregate state — per-post
 * totals, per-post last-like timestamps, and store health — aggregates
 * only, never Like Token membership (ADR 00-008)".
 *
 * Server-side reads for the managed like store: the read helpers
 * consumed by the like counter Route Handler and the Admin Console's
 * likes view, over the shared fail-closed client from
 * `lib/managed-store.ts` (`getManagedStore()`). Kept out of
 * `lib/likes.ts` so that module stays pure (no Redis import) and
 * unit-testable in Node. Every helper here returns aggregates only —
 * Like Token membership is never read or exposed (ADR 00-008).
 */

/**
 * The live like total for every Post Card: the authored base count plus
 * the managed store's deduped toggle delta (`SCARD likes:<postId>` —
 * the count of distinct Like Tokens recorded for that Post Card). An
 * aggregate read only — no Like Token membership is touched (ADR
 * 00-008).
 *
 * Implements ADR 03-004: Model Profiles — `profilePosts` extends the
 * served domain to Model Profile posts: their authored base counts
 * resolve from the `profile:<slug>` overlays merged onto the
 * folders' post files (`post.likes`), their deltas share the same
 * `likes:<postId>` managed-store key convention.
 *
 * @param store - The configured Redis client.
 * @param profilePosts - Model Profile posts to include alongside
 *   `FEED_POSTS` (`allProfilePosts` over the read profiles); empty
 *   by default so existing callers are unchanged.
 * @returns `{ <postId>: <live total> }` for every `FEED_POSTS` entry
 *   and every given profile post.
 * @throws Propagates store read failures; callers degrade per their
 *   fail-closed posture.
 */
export async function readLiveCounts(
  store: Redis,
  profilePosts: readonly LikeablePost[] = []
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    [...FEED_POSTS, ...profilePosts].map(
      async (post) =>
        [post.id, post.likes + (await store.scard(likeKey(post.id)))] as const
    )
  );
  return Object.fromEntries(entries);
}

/**
 * One Post Card's operator-facing like aggregate: the live total
 * (authored base + deduped delta) and the ISO timestamp of the most
 * recently recorded like event (`likes:last:<postId>`), or `null` when
 * no like event has been recorded since the record existed.
 */
export interface PostLikesAggregate {
  /** Post Card id — a real `FEED_POSTS` entry or a `pp-` profile post
   *  id (ADR 03-004). */
  postId: string;
  /** Live total: authored base + `SCARD likes:<postId>`. */
  count: number;
  /** ISO timestamp of the last recorded like event, or `null`. */
  lastLikeAt: string | null;
}

/**
 * The Admin Console's per-post like aggregates: live totals plus
 * last-like timestamps, one entry per `FEED_POSTS` Post Card in feed
 * order. An aggregate read only — Like Token membership is never read
 * (ADR 00-008).
 *
 * Implements ADR 03-004: Model Profiles — `profilePosts` appends one
 * aggregate per Model Profile post after the authored `FEED_POSTS`
 * entries; profile posts are listed by their `pp-` ids as-is.
 *
 * @param store - The configured Redis client.
 * @param profilePosts - Model Profile posts to include after the
 *   `FEED_POSTS` entries; empty by default.
 * @returns One `PostLikesAggregate` per Post Card, in feed order then
 *   profile-post order.
 * @throws Propagates store read failures; the Admin Console surfaces
 *   them as the store-error state with authored base counts.
 */
export async function readPostAggregates(
  store: Redis,
  profilePosts: readonly LikeablePost[] = []
): Promise<PostLikesAggregate[]> {
  return Promise.all(
    [...FEED_POSTS, ...profilePosts].map(async (post) => {
      const [delta, lastLikeAt] = await Promise.all([
        store.scard(likeKey(post.id)),
        store.get<string>(likeLastKey(post.id)),
      ]);
      return { postId: post.id, count: post.likes + delta, lastLikeAt };
    })
  );
}

/**
 * The degraded counterpart of `readPostAggregates`: authored base
 * counts with no timestamps, so the Admin Console still lists every
 * Post Card when the store is unconfigured or failing (fail-closed
 * degradation, ADR 00-002).
 *
 * @param profilePosts - Model Profile posts to include after the
 *   `FEED_POSTS` entries (ADR 03-004); empty by default.
 * @returns One `PostLikesAggregate` per Post Card with `lastLikeAt`
 *   `null`.
 */
export function basePostAggregates(
  profilePosts: readonly LikeablePost[] = []
): PostLikesAggregate[] {
  return [...FEED_POSTS, ...profilePosts].map((post) => ({
    postId: post.id,
    count: post.likes,
    lastLikeAt: null,
  }));
}
