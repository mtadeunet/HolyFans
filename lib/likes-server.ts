import { Redis } from '@upstash/redis';
import { FEED_POSTS } from '@/lib/feed-posts';
import { likeKey, likeLastKey } from '@/lib/likes';

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
 * Server-side access to the managed like store: the lazily initialized
 * Redis client shared by the like counter Route Handler and the Admin
 * Console's likes view, plus the read helpers each consumes. Kept out
 * of `lib/likes.ts` so that module stays pure (no Redis import) and
 * unit-testable in Node. Every helper here returns aggregates only —
 * Like Token membership is never read or exposed (ADR 00-008).
 */

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "Small shared
 * request-time state persists in a managed Redis store provisioned
 * through the Hosting Platform's marketplace ... when the store is
 * unconfigured or unreachable, the Interaction Row degrades to
 * authored base counts with toggling disabled and a visible
 * unavailable indicator."
 *
 * Lazily initialized Redis client, memoized so `next build` and every
 * unconfigured request never construct one. `Redis.fromEnv()` reads
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` but — in the
 * pinned SDK version — only logs a warning and yields a broken client
 * when they are unset, so the env check happens here first: `null`
 * means genuinely unconfigured, not "a client whose every command
 * fails". The defensive try/catch stays so a future SDK throw degrades
 * the same way. Callers then take their fail-closed path.
 *
 * @returns The Redis client, or `null` when the store is unconfigured.
 */
let redis: Redis | null | undefined;
export function getLikesStore(): Redis | null {
  if (redis === undefined) {
    try {
      redis =
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
          ? Redis.fromEnv()
          : null;
    } catch {
      redis = null;
    }
  }
  return redis;
}

/**
 * The live like total for every Post Card: the authored base count plus
 * the managed store's deduped toggle delta (`SCARD likes:<postId>` —
 * the count of distinct Like Tokens recorded for that Post Card). An
 * aggregate read only — no Like Token membership is touched (ADR
 * 00-008).
 *
 * @param store - The configured Redis client.
 * @returns `{ <postId>: <live total> }` for every `FEED_POSTS` entry.
 * @throws Propagates store read failures; callers degrade per their
 *   fail-closed posture.
 */
export async function readLiveCounts(
  store: Redis
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    FEED_POSTS.map(
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
  /** Post Card id — always a real `FEED_POSTS` entry. */
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
 * @param store - The configured Redis client.
 * @returns One `PostLikesAggregate` per Post Card, in feed order.
 * @throws Propagates store read failures; the Admin Console surfaces
 *   them as the store-error state with authored base counts.
 */
export async function readPostAggregates(
  store: Redis
): Promise<PostLikesAggregate[]> {
  return Promise.all(
    FEED_POSTS.map(async (post) => {
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
 * @returns One `PostLikesAggregate` per Post Card with `lastLikeAt`
 *   `null`.
 */
export function basePostAggregates(): PostLikesAggregate[] {
  return FEED_POSTS.map((post) => ({
    postId: post.id,
    count: post.likes,
    lastLikeAt: null,
  }));
}
