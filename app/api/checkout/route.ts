import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PRODUCT, SITE_CONFIG } from '@/lib/constants';
import {
  CheckoutLineInput,
  MAX_CART_LINES,
  validateCart,
} from '@/lib/checkout-validation';
import { locales, type Locale } from '@/lib/i18n';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import { SHIPPING_COUNTRIES, SHIPPING_OPTIONS } from '@/lib/shipping';
import { getStripeClient } from '@/lib/stripe';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "the single checkout
 * Route Handler on the **Node runtime** (required by the PSP SDK), which
 * creates Checkout Sessions (ADR 00-004)". This handler is part of the
 * enumerated dynamic surface; no other request-time endpoints may be added
 * without a new ADR.
 */
export const runtime = 'nodejs';

/**
 * Request-body cap (~8 KB): the payload is a small JSON object of Cart
 * lines — anything larger is abuse input.
 */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "each must be
 * hardened (input caps, rate limiting, fail-closed auth)".
 *
 * Basic in-memory rate limit: at most `RATE_LIMIT` Session-creation POSTs
 * per client IP per `RATE_WINDOW_MS`. This is per-instance state — on a
 * serverless fleet each instance enforces its own window, which is
 * adequate for a single-product launch (plan M3); throttled requests
 * surface to the shopper as the "checkout unavailable" state.
 */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const requestLog = new Map<string, number[]>();

/**
 * Check whether a client IP is within the Session-creation rate window.
 * Expired entries are pruned in place; the map is reset when it grows past
 * an arbitrary bound so hostile IP churn cannot exhaust memory.
 *
 * @param ip - Client IP (first `x-forwarded-for` hop, or 'unknown').
 * @returns `true` when the request may proceed.
 */
function allowRequest(ip: string): boolean {
  const now = Date.now();
  if (requestLog.size > 10_000) {
    requestLog.clear();
  }
  const hits = (requestLog.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS
  );
  if (hits.length >= RATE_LIMIT) {
    requestLog.set(ip, hits);
    return false;
  }
  hits.push(now);
  requestLog.set(ip, hits);
  return true;
}

/**
 * JSON body the client posts: Cart lines (identifiers + quantities only —
 * prices are NEVER taken from the client, ADR 00-004), the shopper's
 * Locale, and an idempotency key unique per checkout attempt.
 */
interface CheckoutRequestBody {
  items: CheckoutLineInput[];
  locale: Locale;
  attemptId: string;
}

/**
 * Narrow parsed JSON to the expected body shape.
 *
 * @param body - `JSON.parse` output (untrusted).
 * @returns The typed body, or `null` when any field is malformed.
 */
function parseBody(body: unknown): CheckoutRequestBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const candidate = body as Record<string, unknown>;

  if (
    !Array.isArray(candidate.items) ||
    candidate.items.length === 0 ||
    candidate.items.length > MAX_CART_LINES
  ) {
    return null;
  }
  for (const item of candidate.items) {
    if (typeof item !== 'object' || item === null) {
      return null;
    }
    const line = item as Record<string, unknown>;
    if (
      typeof line.variantId !== 'string' ||
      line.variantId.length === 0 ||
      line.variantId.length > 128 ||
      typeof line.quantity !== 'number'
    ) {
      return null;
    }
  }

  if (
    typeof candidate.locale !== 'string' ||
    !(locales as readonly string[]).includes(candidate.locale)
  ) {
    return null;
  }

  if (
    typeof candidate.attemptId !== 'string' ||
    candidate.attemptId.length === 0 ||
    candidate.attemptId.length > 255
  ) {
    return null;
  }

  return candidate as unknown as CheckoutRequestBody;
}

/**
 * Implements ADR 00-004: Commerce and Checkout - "creates Sessions
 * idempotently — retries never produce duplicate Checkout Sessions".
 *
 * `integration_identifier` is optional on the API version the SDK pins
 * (2026-09-30.endive): an opaque marker grouping this integration's
 * Checkout Sessions in the Stripe Dashboard. The `holyfans-m3-` prefix
 * plus a random 8-letter suffix is the prescribed pattern for tagging
 * checkout flows.
 *
 * @returns A `holyfans-m3-xxxxxxxx` identifier with 8 random letters.
 */
function integrationIdentifier(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const suffix = Array.from(randomBytes(8))
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
  return `holyfans-m3-${suffix}`;
}

/**
 * Implements ADR 00-004: Commerce and Checkout - "the shopper's Cart is
 * submitted to the Storefront's single checkout Route Handler ... then
 * redirects the shopper to the PSP-hosted payment page".
 *
 * Creates a Stripe Checkout Session from the server-side re-validated
 * Cart and returns the Hosted Checkout URL.
 *
 * Error contract (consumed by `components/sections/purchase.tsx`):
 * - `404 {error: 'checkout_unavailable'}` — purchase-surface gate closed
 *   (fail-closed, same as the checkout pages).
 * - `400 {error: 'invalid_request'}` — malformed/oversized body.
 * - `409 {error: 'cart_drift', corrections}` — Cart/Product Data
 *   divergence; the shopper sees "cart updated — review changes".
 * - `429 {error: 'checkout_unavailable'}` — rate-limited.
 * - `502 {error: 'checkout_unavailable'}` — Stripe key unset, Stripe
 *   outage, or Session creation failure; the Cart is preserved.
 *
 * @param request - The POST request.
 * @returns `{url}` pointing at the Hosted Checkout page on success.
 */
export async function POST(request: NextRequest) {
  /**
   * Implements ADR 00-002: Rendering and Hosting Model - "each must be
   * hardened (input caps, rate limiting, fail-closed auth)". The
   * purchase-surface gate applies to this handler exactly like the gated
   * pages: when `PURCHASE_SURFACE_ENABLED` is not `'true'` the endpoint
   * answers 404 — checked first, before rate limiting or any body work.
   */
  if (!isPurchaseSurfaceEnabled()) {
    return NextResponse.json(
      { error: 'checkout_unavailable' },
      { status: 404 }
    );
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!allowRequest(ip)) {
    return NextResponse.json(
      { error: 'checkout_unavailable' },
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

  const body = parseBody(parsed);
  if (!body) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Server-side re-validation: prices, Variants, Availability Flags, and
  // Purchase Caps come only from Product Data (ADR 00-004).
  const validation = validateCart(body.items);
  if (!validation.ok) {
    return NextResponse.json(
      { error: 'cart_drift', corrections: validation.corrections },
      { status: 409 }
    );
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: 'checkout_unavailable' },
      { status: 502 }
    );
  }

  // Absolute URLs are built from the configured Site base URL
  // (`NEXT_PUBLIC_BASE_URL`, localhost fallback) — never the
  // client-controlled Host header in `request.nextUrl.origin`.
  const origin = SITE_CONFIG.url;

  /**
   * Implements ADR 00-004: Commerce and Checkout - "creates a Checkout
   * Session describing the validated Cart and the fulfillment details the
   * PSP must collect (shipping address and shipping options, so total
   * cost is shown before payment)".
   *
   * `automatic_tax` + `tax_behavior: 'inclusive'` implements ADR 00-004's
   * "Tax computation is delegated to the PSP: the checkout Route Handler
   * creates Checkout Sessions with automatic tax enabled and line items
   * marked with inclusive tax behavior, so the PSP computes the VAT
   * portion inside the displayed total rather than adding tax at payment
   * time." Tax only computes once the owner activates a tax registration
   * in the Stripe Dashboard (ADR 00-004's hard operational dependency).
   *
   * Note (owner decision): Checkout Sessions cannot scope shipping
   * options per country — both rates are offered to every allowed
   * country; the shopper picks the matching label (see lib/shipping.ts).
   */
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    integration_identifier: integrationIdentifier(),
    locale: body.locale,
    line_items: validation.lines.map(({ variant, quantity }) => ({
      quantity,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(PRODUCT.price * 100),
        tax_behavior: 'inclusive',
        product_data: {
          name: `${PRODUCT.name} — ${variant.name}`,
          images: variant.images[0]
            ? [`${origin}${variant.images[0]}`]
            : undefined,
        },
      },
    })),
    automatic_tax: { enabled: true },
    shipping_address_collection: {
      allowed_countries: SHIPPING_COUNTRIES.map(
        (country) =>
          country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry
      ),
    },
    shipping_options: SHIPPING_OPTIONS.map((option) => ({
      shipping_rate_data: {
        display_name: option.displayName,
        type: 'fixed_amount',
        fixed_amount: { amount: option.amountCents, currency: 'eur' },
        tax_behavior: 'inclusive',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: option.minBusinessDays },
          maximum: { unit: 'business_day', value: option.maxBusinessDays },
        },
      },
    })),
    success_url: `${origin}/${body.locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${body.locale}/checkout/cancel`,
  };

  try {
    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: body.attemptId,
    });
    if (!session.url) {
      return NextResponse.json(
        { error: 'checkout_unavailable' },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    // Graceful failure posture (ADR 00-002): a PSP outage or credential
    // problem must degrade to the "checkout unavailable" state, never a
    // crash — the shopper's Cart is preserved for retry.
    console.error('[checkout] Session creation failed:', error);
    return NextResponse.json(
      { error: 'checkout_unavailable' },
      { status: 502 }
    );
  }
}
