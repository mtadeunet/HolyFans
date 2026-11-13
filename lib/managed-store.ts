import { Redis } from '@upstash/redis';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "Small shared
 * request-time state persists in a managed Redis store provisioned
 * through the Hosting Platform's marketplace" — one provisioned store
 * holding the per-post like records (ADR 03-002) and, in a dedicated
 * per-Variant keyspace never joined to them, the Stock Notification
 * List (ADR 00-010), under a single lazy, fail-closed client posture.
 *
 * The shared Redis client for every managed-store consumer — the like
 * counter and stock-notification Route Handlers and the Admin
 * Console's likes and notifications views. Feature-specific reads and
 * writes live beside their domains (`lib/likes-server.ts`,
 * `lib/stock-notification-server.ts`); only the client is shared.
 */

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "when the store
 * is unconfigured or unreachable, the Interaction Row degrades to
 * authored base counts with toggling disabled and a visible
 * unavailable indicator" — the fail-closed posture every consumer
 * takes: `null` means genuinely unconfigured, not "a client whose
 * every command fails".
 *
 * Lazily initialized, memoized so `next build` and every unconfigured
 * request never construct one. `Redis.fromEnv()` reads
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` but — in the
 * pinned SDK version — only logs a warning and yields a broken client
 * when they are unset, so the env check happens here first. The
 * defensive try/catch stays so a future SDK throw degrades the same
 * way; callers then take their fail-closed path.
 *
 * @returns The Redis client, or `null` when the store is unconfigured.
 */
let redis: Redis | null | undefined;
export function getManagedStore(): Redis | null {
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
