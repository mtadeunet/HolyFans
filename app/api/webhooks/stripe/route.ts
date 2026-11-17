import { NextRequest, NextResponse } from 'next/server';
import type { Redis } from '@upstash/redis';
import type Stripe from 'stripe';
import { getEmailConfig, sendEmail } from '@/lib/email';
import {
  orderAlertEmail,
  thankYouEmail,
  type OrderAlertLine,
} from '@/lib/email-templates';
import { defaultLocale, locales, type Locale } from '@/lib/i18n';
import { getManagedStore } from '@/lib/managed-store';
import { getStripeClient } from '@/lib/stripe';

/**
 * Implements ADR 00-002: Rendering and Hosting Model (as amended by
 * ADR 00-015) — "One new enumerated Route Handler joins the dynamic
 * surface ... on the Node runtime: a webhook endpoint the PSP calls
 * with signed events." This handler is part of the enumerated dynamic
 * surface; no other request-time endpoints may be added without a new
 * ADR.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Input cap (~256 KB): a Checkout Session event payload with expanded
 * line items stays well under this bound — anything larger is abuse
 * input ("hardened to the sibling norm (input caps ...)", ADR 00-015).
 */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * Implements ADR 00-015: Transactional Notifications — "Sends are
 * deduplicated against the managed store — an event id / session-keyed
 * record marks each send kind so the PSP's retries can never
 * double-send." Each send kind gets a `SET ... NX` marker per Checkout
 * Session; the TTL bounds the keyspace (the PSP's retry window is far
 * shorter).
 */
const DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

/** The send kinds the receiver can emit per Checkout Session. */
type SendKind = 'thank-you' | 'order-alert';

/** What one send attempt resolved to — sent, already-sent (dedupe
 *  skip), or failed (marker released for the PSP's retry). */
type SendOutcome = 'sent' | 'skipped' | 'failed';

/**
 * The dedupe marker for one send kind of one Checkout Session —
 * `email-sent:<sessionId>:<kind>` in the shared managed store (the
 * `likes:<postId>` keyspace convention).
 *
 * @param sessionId - The Checkout Session id.
 * @param kind - The send kind (`thank-you` | `order-alert`).
 * @returns The marker key.
 */
function dedupeKey(sessionId: string, kind: SendKind): string {
  return `email-sent:${sessionId}:${kind}`;
}

/**
 * Implements ADR 00-015: Transactional Notifications — "Each send kind
 * ... is recorded per Checkout Session in the managed store before
 * reporting success; a repeated event for an already recorded kind is
 * acknowledged without re-sending."
 *
 * Claim-then-send: `SET marker NX` wins the send exactly once across
 * PSP retries and concurrent redeliveries. A failed send releases the
 * marker so the PSP's next delivery retry can attempt it again — the
 * honest posture (the endpoint never keeps a marker for a send that
 * did not happen, and answers 502 so the PSP retries).
 *
 * The release itself is guarded: when `DEL` fails the marker persists
 * and a redelivery may report 'skipped' for a send that never
 * happened, but the outcome is still `'failed'` — the handler answers
 * 502 and the PSP retries, which beats silence. The held key is
 * logged for operator follow-up; the marker key carries no PII (a
 * session id and send kind).
 *
 * @param store - The shared managed-store client.
 * @param sessionId - The Checkout Session id the send belongs to.
 * @param kind - The send kind being claimed.
 * @param send - The actual send (`sendEmail` → `Promise<boolean>`).
 * @returns `'sent'`, `'skipped'` (marker already held), or `'failed'`.
 * @throws Propagates store errors from the claim — the caller surfaces
 *   them as 502 so the PSP retries. Marker-release failures are caught
 *   and logged instead.
 */
async function sendOnce(
  store: Redis,
  sessionId: string,
  kind: SendKind,
  send: () => Promise<boolean>
): Promise<SendOutcome> {
  const key = dedupeKey(sessionId, kind);
  const claimed = await store.set(key, '1', {
    ex: DEDUPE_TTL_SECONDS,
    nx: true,
  });
  if (claimed === null) {
    return 'skipped';
  }
  if (!(await send())) {
    try {
      await store.del(key);
    } catch (error) {
      // The marker stays held — a redelivery may skip a send that never
      // happened, but 'failed' still answers 502 so the PSP retries:
      // a retry is better than silence. The key carries no PII.
      console.error(
        '[webhooks/stripe] dedupe marker release failed:',
        key,
        error
      );
    }
    return 'failed';
  }
  return 'sent';
}

/** The shipping block on either API shape (see `shippingAddress`). */
interface ShippingDetailsLike {
  name?: string | null;
  address?: Stripe.Address | null;
}

/**
 * Resolve the session's shipping details across API versions: newer
 * payloads carry them at `collected_information.shipping_details`;
 * legacy payloads at `shipping_details` — read defensively since the
 * pinned SDK type drops the legacy field.
 *
 * @param session - The retrieved Checkout Session.
 * @returns The shipping details block, or `null`.
 */
function shippingDetailsOf(
  session: Stripe.Checkout.Session
): ShippingDetailsLike | null {
  const collected = session.collected_information?.shipping_details;
  if (collected) {
    return collected;
  }
  return (
    (session as { shipping_details?: ShippingDetailsLike | null })
      .shipping_details ?? null
  );
}

/**
 * Render the shipping address as one operator-readable line for the
 * Order Alert (`Envio: <line>` in the template).
 *
 * @param session - The retrieved Checkout Session.
 * @returns The formatted `name, line1, line2, postal city, state,
 *   country` string, or `undefined` when nothing was collected.
 */
function shippingAddressOf(
  session: Stripe.Checkout.Session
): string | undefined {
  const details = shippingDetailsOf(session);
  if (!details) {
    return undefined;
  }
  const address = details.address;
  const locality = [address?.postal_code, address?.city]
    .filter((part): part is string => Boolean(part))
    .join(' ');
  const parts = [
    details.name,
    address?.line1,
    address?.line2,
    locality || undefined,
    address?.state,
    address?.country,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Resolve the chosen shipping option's display name for the Order
 * Alert: the expanded `shipping_cost.shipping_rate` object when the
 * expand resolved, else the rate id as a last resort.
 *
 * @param session - The retrieved Checkout Session.
 * @returns The display name or rate id, or `undefined`.
 */
function shippingOptionOf(
  session: Stripe.Checkout.Session
): string | undefined {
  const rate = session.shipping_cost?.shipping_rate;
  if (rate && typeof rate === 'object') {
    return rate.display_name ?? undefined;
  }
  return typeof rate === 'string' ? rate : undefined;
}

/**
 * Implements ADR 00-015: Transactional Notifications — "The Thank-You
 * Email renders in the Checkout Session's Locale."
 *
 * Resolve the customer-facing Locale: the `metadata.locale` recorded
 * at Session creation (the checkout Route Handler sets it, ADR 00-004)
 * when it is a supported Locale; else the hosted-page `session.locale`
 * when supported; else the Primary Locale.
 *
 * @param session - The retrieved Checkout Session.
 * @returns A supported `Locale`.
 */
function sessionLocale(session: Stripe.Checkout.Session): Locale {
  const meta = session.metadata?.locale;
  if (meta && (locales as readonly string[]).includes(meta)) {
    return meta as Locale;
  }
  const hosted = session.locale;
  if (hosted && (locales as readonly string[]).includes(hosted)) {
    return hosted as Locale;
  }
  return defaultLocale;
}

/**
 * Implements ADR 00-015: Transactional Notifications — the **PSP
 * Event Receiver**: "It verifies each request's signature against
 * `STRIPE_WEBHOOK_SECRET` (environment configuration; unconfigured →
 * the endpoint fails closed), accepts exactly two event types, and
 * ignores everything else."
 *
 * Routing (ADR 00-015): `checkout.session.completed` on a paid
 * outcome sends both order emails; on a pending asynchronous payment
 * it sends only the Operator Order Alert marked awaiting payment.
 * `checkout.session.async_payment_succeeded` sends the Thank-You and,
 * when the dedupe marker is unclaimed, the Order Alert. Every other
 * event type is acknowledged without work. A verified signature stands
 * in for the rate limit visitor-facing endpoints carry — "the
 * signature IS the auth".
 *
 * Degrade posture: "When the managed store is unconfigured the
 * endpoint still verifies signatures and acknowledges events without
 * sending — degrading rather than failing the PSP's delivery." The
 * same holds for an unconfigured delivery channel.
 *
 * Error contract: `503` — PSP client or webhook secret unconfigured
 * (fail-closed); `400` — missing/invalid signature or oversized body;
 * `502` — session retrieve or a claimed send failed (the PSP retries;
 * dedupe markers keep retries single-send).
 *
 * @param request - The POST request carrying the signed event.
 * @returns `{ok: true}` on acknowledgment.
 */
export async function POST(request: NextRequest) {
  // Fail-closed (ADR 00-015): "unconfigured → the endpoint fails
  // closed" — both the PSP client and the signing secret must exist.
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: 'webhook_unavailable' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // The raw body is required for signature verification — read it
  // capped, then verify before any event work.
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const payload = await request.text();
  if (payload.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      secret
    );
  } catch (error) {
    console.error('[webhooks/stripe] signature verification failed:', error);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  // "accepts exactly two event types, and ignores everything else"
  // (ADR 00-015): all other events get a bare acknowledgment.
  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return NextResponse.json({ ok: true });
  }

  const eventSession = event.data.object as Stripe.Checkout.Session;

  // Degrade, don't fail (ADR 00-015): with no dedupe store or no
  // delivery channel, acknowledge the event without sending — a 5xx
  // would put the PSP into an endless retry loop for a condition that
  // cannot self-heal.
  const store = getManagedStore();
  const emailConfig = getEmailConfig();
  if (!store || !emailConfig) {
    console.warn(
      '[webhooks/stripe] managed store or email channel unconfigured — event acknowledged without sends'
    );
    return NextResponse.json({ ok: true });
  }

  // The Order Alert needs the fulfillment detail; the Thank-You reads
  // the same retrieved Session (customer details, Locale).
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(eventSession.id, {
      expand: [
        'line_items',
        'customer_details',
        'collected_information',
        'shipping_cost.shipping_rate',
      ],
    });
  } catch (error) {
    console.error('[webhooks/stripe] session retrieve failed:', error);
    return NextResponse.json(
      { error: 'webhook_unavailable' },
      { status: 502 }
    );
  }

  const paid = session.payment_status === 'paid';
  // Thank-You only on settled payment: a paid `completed`, or the
  // delayed-confirmation settlement event (ADR 00-015). A pending
  // `completed` (e.g. a Multibanco reference) gets the alert marked
  // awaiting payment and no customer email yet.
  const wantThankYou =
    event.type === 'checkout.session.async_payment_succeeded' || paid;

  const outcomes: SendOutcome[] = [];

  try {
    if (wantThankYou) {
      const recipient =
        session.customer_details?.email ?? session.customer_email ?? null;
      if (recipient) {
        const locale = sessionLocale(session);
        const customerName = session.customer_details?.name ?? undefined;
        outcomes.push(
          await sendOnce(store, session.id, 'thank-you', () =>
            sendEmail({
              to: recipient,
              toName: customerName,
              replyTo: emailConfig.operatorInbox,
              ...thankYouEmail(locale, customerName),
            })
          )
        );
      }
      // No recipient address → nothing to send; the send kind stays
      // unclaimed and the event is still acknowledged (the email
      // cannot exist, so retries would fail forever).
    }

    const lines: OrderAlertLine[] = (session.line_items?.data ?? []).map(
      (item) => ({
        name: item.description ?? '—',
        quantity: item.quantity ?? 0,
        unitAmountCents:
          item.price?.unit_amount ??
          (item.quantity
            ? Math.round(item.amount_total / item.quantity)
            : item.amount_total),
      })
    );

    outcomes.push(
      await sendOnce(store, session.id, 'order-alert', () =>
        sendEmail({
          to: emailConfig.operatorInbox,
          ...orderAlertEmail({
            sessionId: session.id,
            lines,
            totalCents: session.amount_total ?? 0,
            customerEmail:
              session.customer_details?.email ??
              session.customer_email ??
              undefined,
            customerName: session.customer_details?.name ?? undefined,
            shippingAddress: shippingAddressOf(session),
            shippingOption: shippingOptionOf(session),
            paymentState: paid ? 'paid' : 'awaiting',
          }),
        })
      )
    );
  } catch (error) {
    // Store failure mid-event: already-claimed markers hold, so the
    // PSP's retry only re-attempts the unclaimed kinds.
    console.error('[webhooks/stripe] event handling failed:', error);
    return NextResponse.json(
      { error: 'webhook_unavailable' },
      { status: 502 }
    );
  }

  // A failed send released its marker for the PSP's retry — answer
  // 502 so the retry actually comes.
  if (outcomes.includes('failed')) {
    return NextResponse.json(
      { error: 'webhook_unavailable' },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
