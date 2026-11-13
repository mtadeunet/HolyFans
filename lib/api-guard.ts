import type { NextRequest } from 'next/server';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "the Request-Time
 * Middleware and the Route Handlers are the attack surface; each must be
 * hardened (input caps, rate limiting, fail-closed auth)".
 *
 * Shared route-hardening primitives for the enumerated Route Handlers
 * (checkout, like counter, stock-notification): the per-IP rate-window
 * check, the client-IP extraction that feeds it, and the capped
 * request-body read plus JSON parse. Each endpoint's posture stays
 * local to its handler — its own request log, rate limit, and body cap
 * legitimately differ; only the mechanism is shared.
 */

/**
 * The shared rate window for the in-memory per-IP limit: one minute.
 * Per-instance state — on a serverless fleet each instance enforces
 * its own window, the bound the ADR accepts for these endpoints.
 */
const RATE_WINDOW_MS = 60_000;

/**
 * Check whether a client IP is within a rate window. Expired entries
 * are pruned in place; the log is reset when it grows past an arbitrary
 * bound so hostile IP churn cannot exhaust memory.
 *
 * @param ip - Client IP (first `x-forwarded-for` hop, or 'unknown').
 * @param log - The endpoint's request log being enforced.
 * @param limit - Maximum requests allowed inside `RATE_WINDOW_MS`.
 * @returns `true` when the request may proceed.
 */
export function allowRequest(
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
export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  );
}

/**
 * Input cap: read and parse a JSON request body only when it fits the
 * endpoint's cap. The declared `content-length` is checked first, then
 * the actual body length after reading, so oversized bodies are
 * rejected both before and after the read.
 *
 * @param request - The incoming request.
 * @param maxBytes - The endpoint's body cap in bytes.
 * @returns The `JSON.parse` output (untrusted), or `null` when the body
 *   is oversized or not valid JSON.
 */
export async function readCappedJson(
  request: NextRequest,
  maxBytes: number
): Promise<unknown | null> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) {
    return null;
  }
  const raw = await request.text();
  if (raw.length > maxBytes) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
