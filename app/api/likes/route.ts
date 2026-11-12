import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { FEED_POSTS } from '@/lib/feed-posts';
import {
  baseLikeCounts,
  likeKey,
  parseLikeToggleBody,
} from '@/lib/likes';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "the like counter
 * Route Handler, which serves the Interaction Row's shared like counts
 * and records per-visitor like toggles for Post Cards (ADR 03-002) —
 * reads and writes against the managed store below, deduplicating each
 * toggle per Post Card by the visitor's anonymous client-held Like
 * Token, hardened like the checkout endpoint (input caps, IP rate
 * limiting, fail-closed)". This handler is part of the enumerated
 * dynamic surface; no other request-time endpoints may be added without
 * a new ADR.
 */
export const runtime = 'nodejs';

/**
 * Request-body cap (~1 KB): the toggle payload is a small JSON object
 * (`postId`, `token`, `liked`) — anything larger is abuse input.
 */
const MAX_BODY_BYTES = 1024;

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "each must be
 * hardened (input caps, rate limiting, fail-closed auth)".
 *
 * Basic in-memory rate limit, same approach as the checkout Route
 * Handler: at most `GET_RATE_LIMIT` count reads and `POST_RATE_LIMIT`
 * toggle writes per client IP per `RATE_WINDOW_MS`. This is per-instance
 * state — on a serverless fleet each instance enforces its own window,
 * adequate for the vanity-metric bound the ADR accepts; throttled
 * requests surface to the Interaction Row as the degraded state.
 */
const RATE_WINDOW_MS = 60_000;
const GET_RATE_LIMIT = 60;
const POST_RATE_LIMIT = 30;
const getRequestLog = new Map<string, number[]>();
const postRequestLog = new Map<string, number[]>();

/**
 * Check whether a client IP is within a rate window. Expired entries are
 * pruned in place; the map is reset when it grows past an arbitrary
 * bound so hostile IP churn cannot exhaust memory.
 *
 * @param ip - Client IP (first `x-forwarded-for` hop, or 'unknown').
 * @param log - The per-method request log being enforced.
 * @param limit - Maximum requests allowed inside `RATE_WINDOW_MS`.
 * @returns `true` when the request may proceed.
 */
function allowRequest(
  ip: string,
  log: Map<string, number[]>,
  limit: number
): boolean {
  const now = Date.now();
  if (log.size > 10_000) {
    log.clear();
  }
  const hits = (log.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS
  );
  if (hits.length >= limit) {
    log.set(ip, hits);
    return false;
  }
  hits.push(now);
  log.set(ip, hits);
  return true;
}

/**
 * Extract the client IP for rate limiting (first `x-forwarded-for`
 * hop, or 'unknown').
 *
 * @param request - The incoming request.
 * @returns The client IP string.
 */
function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "Shared like
 * counts persist in a managed Redis store provisioned through the
 * Hosting Platform's marketplace ... when the store is unconfigured or
 * unreachable, the Interaction Row degrades to authored base counts
 * with toggling disabled rather than failing."
 *
 * Lazily initialized Redis client, memoized so `next build` and every
 * unconfigured request never construct one. `Redis.fromEnv()` reads
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` but — in the
 * pinned SDK version — only logs a warning and yields a broken client
 * when they are unset, so the env check happens here first: `null`
 * means genuinely unconfigured, not "a client whose every command
 * fails". The defensive try/catch stays so a future SDK throw degrades
 * the same way. Handlers then take their fail-closed path.
 *
 * @returns The Redis client, or `null` when the store is unconfigured.
 */
let redis: Redis | null | undefined;
function getRedis(): Redis | null {
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
 * Implements ADR 03-002: Landing Page Composition - "The displayed like
 * count is the sum of an authored base count ... and a shared delta
 * persisted server-side in the managed store" and "When the store is
 * unconfigured or unreachable, the row degrades to the authored base
 * count with toggling disabled — graceful, never a crash."
 *
 * Serves every Post Card's total like count: the authored base (from
 * `FEED_POSTS`) plus the managed store's deduped toggle delta (`SCARD
 * likes:<postId>` — the count of distinct Like Tokens recorded for that
 * Post Card). Reads nothing client-supplied.
 *
 * Response contract (consumed by `components/feed/interaction-row.tsx`):
 * - `200 {counts: Record<postId, number>, live: true}` — store-backed
 *   totals; the row enables toggling.
 * - `200 {counts: Record<postId, number>, live: false}` — store
 *   unconfigured or unreachable: authored base counts only; the row
 *   disables toggling (fail-closed degradation, ADR 00-002).
 * - `429 {error: 'likes_unavailable'}` — rate-limited; the row treats
 *   this identically to `live: false`.
 *
 * @param request - The GET request.
 * @returns Aggregate counts — never any Like Token or per-visitor data
 *   (aggregate counts only, ADR 00-008).
 */
export async function GET(request: NextRequest) {
  if (!allowRequest(clientIp(request), getRequestLog, GET_RATE_LIMIT)) {
    return NextResponse.json(
      { error: 'likes_unavailable' },
      { status: 429 }
    );
  }

  const store = getRedis();
  if (!store) {
    return NextResponse.json({ counts: baseLikeCounts(), live: false });
  }

  try {
    const entries = await Promise.all(
      FEED_POSTS.map(
        async (post) =>
          [post.id, post.likes + (await store.scard(likeKey(post.id)))] as const
      )
    );
    return NextResponse.json({
      counts: Object.fromEntries(entries),
      live: true,
    });
  } catch (error) {
    // Graceful failure posture (ADR 00-002): a store outage degrades to
    // authored base counts, never a crash — the Interaction Row shows
    // the bases with toggling disabled.
    console.error('[likes] count read failed:', error);
    return NextResponse.json({ counts: baseLikeCounts(), live: false });
  }
}

/**
 * Implements ADR 03-002: Landing Page Composition - "a visitor's toggle
 * persists in client-local storage ... and is deduplicated server-side
 * per Post Card by a Like Token" and the counter endpoint "is hardened
 * like the checkout endpoint — input caps, IP rate limiting,
 * fail-closed."
 *
 * Records a like toggle: `liked: true` adds the visitor's Like Token to
 * the Post Card's dedup set (`SADD`), `false` removes it (`SREM`) — set
 * membership makes dedup inherent, so repeated toggles from one browser
 * count once. Returns the post-toggle total (authored base + `SCARD`).
 * The Like Token is opaque and is never logged (ADR 00-008).
 *
 * Error contract (consumed by `components/feed/interaction-row.tsx`):
 * - `200 {count: number}` — the post's new total; the row adopts it as
 *   authoritative.
 * - `400 {error: 'invalid_request'}` — malformed/oversized body or a
 *   `postId` that is not a real Post Card.
 * - `429 {error: 'likes_unavailable'}` — rate-limited.
 * - `503 {error: 'likes_unavailable'}` — store unconfigured.
 * - `502 {error: 'likes_unavailable'}` — store unreachable/write failure.
 *   Any non-200 rolls back the row's optimistic toggle and disables
 *   further toggling (fail-closed, ADR 00-002).
 *
 * @param request - The POST request.
 * @returns `{count}` on success.
 */
export async function POST(request: NextRequest) {
  if (!allowRequest(clientIp(request), postRequestLog, POST_RATE_LIMIT)) {
    return NextResponse.json(
      { error: 'likes_unavailable' },
      { status: 429 }
    );
  }

  // Input cap: reject oversized bodies before parsing.
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const body = parseLikeToggleBody(parsed);
  if (!body) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Fail-closed (ADR 00-002): with no store configured the toggle cannot
  // be deduplicated or persisted — refuse rather than pretend to count.
  const store = getRedis();
  if (!store) {
    return NextResponse.json(
      { error: 'likes_unavailable' },
      { status: 503 }
    );
  }

  try {
    const key = likeKey(body.postId);
    if (body.liked) {
      await store.sadd(key, body.token);
    } else {
      await store.srem(key, body.token);
    }
    const post = FEED_POSTS.find((entry) => entry.id === body.postId);
    const count = (post?.likes ?? 0) + (await store.scard(key));
    return NextResponse.json({ count });
  } catch (error) {
    // The Like Token is deliberately not logged — only the store failure.
    console.error('[likes] toggle write failed:', error);
    return NextResponse.json(
      { error: 'likes_unavailable' },
      { status: 502 }
    );
  }
}
