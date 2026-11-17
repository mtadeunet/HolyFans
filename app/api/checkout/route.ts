import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { allowRequest, clientIp, readCappedJson } from '@/lib/api-guard';
import { PRODUCT, SITE_CONFIG } from '@/lib/constants';
import {
  CheckoutLineInput,
  MAX_CART_LINES,
  validateCart,
} from '@/lib/checkout-validation';
import { locales, type Locale } from '@/lib/i18n';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import {
  COMPLIMENTARY_SHIPPING_OPTIONS,
  SHIPPING_COUNTRIES,
  SHIPPING_OPTIONS,
} from '@/lib/shipping';
import { getSiteConfig } from '@/lib/site-config-server';
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
 * Basic in-memory rate limit: at most `RATE_LIMIT` Session-creation
 * POSTs per client IP per the shared rate window (`lib/api-guard.ts`).
 * This is per-instance state — on a serverless fleet each instance
 * enforces its own window, which is
 * adequate for a single-product launch (plan M3); throttled requests
 * surface to the shopper as the "checkout unavailable" state.
 */
const RATE_LIMIT = 10;
const requestLog = new Map<string, number[]>();

/**
 * Stripe Price IDs per Variant, env-configured — test-mode ids locally,
 * live ids in production. When a Variant's id is unset the handler falls
 * back to inline `price_data` built from Product Data, so prices are
 * server-authoritative either way (ADR 00-004).
 */
const STRIPE_PRICE_IDS: Record<string, string | undefined> = {
  'nsr-female-m': process.env.STRIPE_PRICE_ID_FEMALE,
};

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
 * Error contract (consumed by `components/sections/buy-now.tsx`):
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

  if (!allowRequest(clientIp(request), requestLog, RATE_LIMIT)) {
    return NextResponse.json(
      { error: 'checkout_unavailable' },
      { status: 429 }
    );
  }

  // Input cap: reject oversized bodies before parsing.
  const parsed = await readCappedJson(request, MAX_BODY_BYTES);
  if (parsed === null) {
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

  const siteConfig = await getSiteConfig();

  /**
   * Implements ADR 00-004: Commerce and Checkout - amounts derive only
   * from server-side Product Data — and ADR 03-003: Promotion Bar -
   * "the checkout swap": a server-validated subtotal at/above
   * `siteConfig.shipping.freeShippingThresholdCents` upgrades both
   * shipping options to the complimentary pair (amount 0, same
   * delivery estimates) — the fulfillment of the `belowFreeShipping`
   * offer the Promotion Bar advertises off the same Site Config value.
   * A threshold of `0` disables the swap.
   *
   * The subtotal derives from Product Data `PRODUCT.price` — under the
   * current single-price catalog this equals the charged total; if a
   * Variant ever resolves to a Stripe Price ID carrying a different
   * amount, this comparison must key on the priced total instead.
   */
  const unitCents = Math.round(PRODUCT.price * 100);
  const subtotalCents = validation.lines.reduce(
    (sum, { quantity }) => sum + unitCents * quantity,
    0
  );
  const complimentary =
    siteConfig.shipping.freeShippingThresholdCents > 0 &&
    subtotalCents >= siteConfig.shipping.freeShippingThresholdCents;
  const shippingOptions = complimentary
    ? COMPLIMENTARY_SHIPPING_OPTIONS
    : SHIPPING_OPTIONS;

  // Absolute URLs are resolved server-side with per-deployment
  // precedence: `NEXT_PUBLIC_BASE_URL` > the server-only `VERCEL_URL`
  // system variable (auto-exposed on every deployment, never inlined
  // into client bundles — so share surfaces keep the canonical URL
  // while checkout gets the real deployment origin) > `SITE_CONFIG.url`
  // (canonical/localhost fallback; see lib/constants.ts) — never the
  // client-controlled Host header in `request.nextUrl.origin`. `||` is
  // used rather than `??` so a set-but-empty `NEXT_PUBLIC_BASE_URL`
  // falls through.
  const origin =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : SITE_CONFIG.url);

  /**
   * Implements ADR 00-004: Commerce and Checkout - "creates a Checkout
   * Session describing the validated Cart and the fulfillment details the
   * PSP must collect (shipping address and shipping options, so total
   * cost is shown before payment)".
   *
   * Implements ADR 00-004: Commerce and Checkout - "No tax is computed
   * or collected at checkout: the checkout Route Handler creates
   * Checkout Sessions with automatic tax disabled, and no PSP tax
   * service is used". Sessions carry no
   * `automatic_tax` and line items/shipping rates carry no
   * `tax_behavior`; VAT determination, reporting, and remittance are an
   * out-of-band accounting responsibility handled by the owner's
   * accountant outside the PSP.
   *
   * Note (owner decision): Checkout Sessions cannot scope shipping
   * options per country — both rates are offered to every allowed
   * country; the shopper picks the matching label (see lib/shipping.ts).
   */
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    integration_identifier: integrationIdentifier(),
    locale: body.locale,
    /**
     * Implements ADR 00-004: Commerce and Checkout - "all payment
     * notifications are PSP-native — the PSP confirms the order and
     * delivers the receipt to the customer, and notifies the operator of
     * new orders". `customer_creation: 'always'` upgrades every
     * payment-mode Session from a guest checkout to a persisted Stripe
     * Customer carrying the email collected on the hosted page, so the
     * PSP-native receipt has a deterministic recipient — Stripe's
     * automatic-receipt path falls back to the Customer's email when no
     * `receipt_email` is set — for immediate methods and for
     * delayed-confirmation methods (e.g. Multibanco) whose receipt is
     * emitted when the async payment settles, and so orders group under
     * Customers in the Dashboard for the operator's manual Fulfillment.
     */
    customer_creation: 'always',
    line_items: validation.lines.map(({ variant, quantity }) => {
      const priceId = STRIPE_PRICE_IDS[variant.id];
      return priceId
        ? { quantity, price: priceId }
        : {
            quantity,
            price_data: {
              currency: 'eur',
              unit_amount: unitCents,
              product_data: {
                name: `${PRODUCT.name} — ${variant.name} (${variant.size})`,
                images: variant.images[0]
                  ? [`${origin}${variant.images[0]}`]
                  : undefined,
              },
            },
          };
    }),
    shipping_address_collection: {
      allowed_countries: SHIPPING_COUNTRIES.map(
        (country) =>
          country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry
      ),
    },
    shipping_options: shippingOptions.map((option) => ({
      shipping_rate_data: {
        display_name: option.displayName,
        type: 'fixed_amount',
        fixed_amount: { amount: option.amountCents, currency: 'eur' },
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
