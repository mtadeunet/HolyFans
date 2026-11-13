import { NextRequest, NextResponse } from 'next/server';
import { allowRequest, clientIp, readCappedJson } from '@/lib/api-guard';
import { locales } from '@/lib/i18n';
import { getManagedStore } from '@/lib/managed-store';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import {
  parseStockNotificationBody,
  stockNotificationKey,
  type StockNotificationRecord,
} from '@/lib/stock-notification';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "the
 * stock-notification Route Handler on the Node runtime, which records a
 * visitor's consented email into the Stock Notification List when the
 * Simplified Purchase Surface's Pre-order state is submitted (ADR
 * 00-010) — writes against the managed store below in a dedicated
 * per-Variant keyspace, hardened like the checkout and like counter
 * endpoints (input caps, IP rate limiting, fail-closed) and sharing the
 * Purchase-Surface Gate posture of ADR 00-004". This handler is part of
 * the enumerated dynamic surface; no other request-time endpoints may
 * be added without a new ADR.
 */
export const runtime = 'nodejs';

/**
 * Request-body cap (~1 KB): the capture payload is a small JSON object
 * (`email`, `locale`, `variantId`) — anything larger is abuse input.
 */
const MAX_BODY_BYTES = 1024;

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "each must be
 * hardened (input caps, rate limiting, fail-closed auth)".
 *
 * Basic in-memory rate limit, same approach as the checkout Route
 * Handler: at most `RATE_LIMIT` capture POSTs per client IP per
 * the shared rate window (`lib/api-guard.ts`). This is per-instance
 * state — on a serverless fleet each instance enforces its own
 * window, which is the accepted bound
 * for garbage entries the ADR notes; throttled requests surface to the
 * Pre-order state as the graceful unavailable message.
 */
const RATE_LIMIT = 10;
const requestLog = new Map<string, number[]>();

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — the
 * stock-notification Route Handler "accepts the visitor's email, the
 * visitor's Locale, and the Variant identifier the capture was scoped
 * to" and "when the managed store is unconfigured or unreachable it
 * answers a graceful 'unavailable' state and never reports a success it
 * did not persist. It shares the checkout handler's gated posture:
 * while the Purchase-Surface Gate (ADR 00-004) is closed, the endpoint
 * answers unavailable."
 *
 * Records the consented email in the per-Variant Stock Notification
 * List: `HSET stock-notifications:<variantId> <email> <consent
 * record>` — hash-field uniqueness makes repeat submissions of the
 * same email for the same Variant dedupe naturally (ADR 00-010). The
 * handler validates that the identifier is real; it does not gate on
 * whether that Variant is currently purchasable — an email captured
 * against an in-stock Variant is harmless. The email is never logged
 * (ADR 00-008).
 *
 * Error contract (consumed by `components/sections/buy-now.tsx`):
 * - `404 {error: 'stock_notification_unavailable'}` — Purchase-Surface
 *   Gate closed (fail-closed, same as the checkout Route Handler).
 * - `400 {error: 'invalid_request'}` — malformed/oversized body, bad
 *   email shape, an unsupported Locale, or a `variantId` that is not a
 *   real Product Data Variant.
 * - `429 {error: 'stock_notification_unavailable'}` — rate-limited.
 * - `503 {error: 'stock_notification_unavailable'}` — store
 *   unconfigured.
 * - `502 {error: 'stock_notification_unavailable'}` — store
 *   unreachable/write failure.
 *   Any non-200 surfaces the graceful unavailable state in the
 *   Pre-order UI — honest failure, never a fake success (ADR 00-010).
 *
 * @param request - The POST request.
 * @returns `{ok: true}` once the email is persisted.
 */
export async function POST(request: NextRequest) {
  // Purchase-Surface Gate (ADR 00-004 / ADR 00-010): while the gate is
  // closed the capture surface does not render and this endpoint
  // answers unavailable — checked first, before rate limiting or any
  // body work, exactly like the checkout Route Handler.
  if (!isPurchaseSurfaceEnabled()) {
    return NextResponse.json(
      { error: 'stock_notification_unavailable' },
      { status: 404 }
    );
  }

  if (!allowRequest(clientIp(request), requestLog, RATE_LIMIT)) {
    return NextResponse.json(
      { error: 'stock_notification_unavailable' },
      { status: 429 }
    );
  }

  // Input cap: reject oversized bodies before parsing.
  const parsed = await readCappedJson(request, MAX_BODY_BYTES);
  if (parsed === null) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const body = parseStockNotificationBody(parsed);
  // "a Locale that must be a supported Locale" (ADR 00-010): the pure
  // parser bounds the field's shape; membership in the supported set is
  // enforced here where the Locale list lives (same split as the
  // checkout Route Handler's `parseBody`).
  if (!body || !(locales as readonly string[]).includes(body.locale)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Fail-closed (ADR 00-010): with no store configured the capture
  // cannot be persisted — answer a graceful unavailable, never a
  // success that was not persisted.
  const store = getManagedStore();
  if (!store) {
    return NextResponse.json(
      { error: 'stock_notification_unavailable' },
      { status: 503 }
    );
  }

  try {
    const record: StockNotificationRecord = {
      consentedAt: new Date().toISOString(),
      locale: body.locale,
    };
    // Repeat submissions of the same email for the same Variant dedupe
    // naturally on the HASH field; a re-capture refreshes the consent
    // record's timestamp and Locale.
    await store.hset(stockNotificationKey(body.variantId), {
      [body.email]: JSON.stringify(record),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // The email is deliberately not logged — only the store failure.
    console.error('[stock-notification] capture write failed:', error);
    return NextResponse.json(
      { error: 'stock_notification_unavailable' },
      { status: 502 }
    );
  }
}
