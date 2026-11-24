import type { Redis } from '@upstash/redis';
import type Stripe from 'stripe';
import { defaultLocale, locales, type Locale } from '@/lib/i18n';

/**
 * Implements ADR 00-015: Transactional Notifications — the **Order
 * Ledger**: "Every retrieved Checkout Session is persisted to the
 * managed store: one `order:<sessionId>` document carrying the
 * fulfillment-and-audit detail ... plus a companion `orders` sorted
 * set maintained newest-first as the index of recorded orders,
 * session ids scored by session creation time. The documents carry
 * no TTL: retention is indefinite and
 * operator-managed." The Order Ledger adds a dedicated keyspace to the
 * shared store of ADR 00-002 — never joined to the like,
 * stock-notification, send-dedupe, or profile keys:
 *
 * - `order:<sessionId>` — a STRING holding the order's JSON document:
 *   `{id, created, paymentStatus, currency, amountTotalCents, locale,
 *   customer: {name?, email?, phone?}, shipping: {name?, address?,
 *   option?}, items: [{name, quantity, unitAmountCents}], status?,
 *   trackingId?}` — "the
 *   session id and creation time, the payment status, the currency
 *   and total amount in cents, the session Locale, the customer's
 *   name and email, the customer phone when the PSP collected it
 *   (carriers require a recipient phone for fulfillment labels), the
 *   shipping name, address, and chosen option,
 *   and the line items with their names, quantities, and unit
 *   amounts" (ADR 00-015) — the same field resolution the order
 *   emails already use.
 * - `orders` — a ZSET of Checkout Session ids scored by the session's
 *   `created` (unix seconds), so the set enumerates newest-first:
 *   "the index of recorded orders" (ADR 00-015).
 *
 * The record carries customer PII (email, phone, shipping address) by
 * design — "retained intentionally ... the detail manual Fulfillment
 * ships against" (ADR 00-015) — and never payment-instrument data (the
 * PSP's payloads do not carry it; "the PSP remains the payment system
 * of record and the ledger is the fulfillment/audit copy" — the
 * document IS the record). The write
 * is a read-modify-write: `persistOrder` `GET`s the previous document,
 * merges the session-built record with the preserved operator fields
 * and the paid-regression guard in memory, and lands the result in a
 * single `SET` — a crash before the `SET` leaves the previous
 * document intact so a retry heals, and a stored `'paid'` status can
 * never regress under a late-arriving `completed` retrieve whose own
 * write already merged the guard. The index entry is `ZADD`ed
 * unconditionally, sorted-set member uniqueness doing the dedupe a
 * separate existence check cannot: a retry after a mid-write crash
 * self-heals the gap and concurrent writers can never duplicate, so
 * the PSP's retries and the
 * `checkout.session.completed` →
 * `checkout.session.async_payment_succeeded` pair update rather than
 * duplicate — "A delayed settlement
 * (`checkout.session.async_payment_succeeded`) updates the stored
 * payment status without duplicating the index entry" (ADR 00-015).
 *
 * Server-side writes consumed by the webhook Route Handler, over the
 * shared fail-closed client from `lib/managed-store.ts`
 * (`getManagedStore()`) — the same posture as
 * `lib/profiles-server.ts`.
 */

/**
 * The Checkout Session event types the receiver accepts — the two the
 * Order Ledger persists (ADR 00-015: "accepts exactly two event
 * types, and ignores everything else").
 * `checkout.session.async_payment_succeeded` is the settlement
 * signal: persisting it records `paymentStatus: 'paid'` even when a
 * lagging retrieve still shows the pending status.
 */
export type OrderEventType =
  'checkout.session.completed' | 'checkout.session.async_payment_succeeded';

/**
 * The Redis ZSET key indexing every persisted order — Checkout
 * Session ids scored by the session's `created` (unix seconds) so the
 * set enumerates newest-first for operator reads. `ZADD` member
 * uniqueness makes the index idempotent under retries — no existence
 * check is needed (or sufficient) around the write.
 */
export const ORDERS_INDEX_KEY = 'orders';

/**
 * The Redis STRING key holding one order's JSON Order Ledger
 * document.
 *
 * @param sessionId - The Checkout Session id — the order's identity.
 * @returns `order:<sessionId>`.
 */
export function orderKey(sessionId: string): string {
  return `order:${sessionId}`;
}

/**
 * The order's operator-side fulfillment states, in lifecycle order —
 * the vocabulary the Admin Console's Orders section edits. Distinct
 * from `paymentStatus` (the PSP's report, owned by the webhook):
 * `status` is the operator's own fulfillment bookkeeping on the
 * ledger record.
 */
export const ORDER_STATUSES = [
  'pending',
  'processing',
  'shipped',
  'complete',
] as const;

/** One fulfillment state of `ORDER_STATUSES`. */
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * The order's effective fulfillment status: a record with no `status`
 * field — every order persisted before operator tracking existed —
 * reads as `'pending'`, matching the editor's initial state so the
 * console never displays a blank.
 *
 * @param record - The order document (status possibly absent).
 * @returns The stored status, or `'pending'`.
 */
export function orderStatusOf(record: OrderRecord): OrderStatus {
  return record.status ?? 'pending';
}

/** The shipping block on either API shape (see `shippingAddressOf`). */
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
 * Render the shipping address as one operator-readable line — the
 * Order Ledger's `shipping.address` and the Order Alert's
 * `Envio: <line>` read the same resolution.
 *
 * @param session - The retrieved Checkout Session.
 * @returns The formatted `name, line1, line2, postal city, state,
 *   country` string, or `undefined` when nothing was collected.
 */
export function shippingAddressOf(
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
 * Resolve the chosen shipping option's display name: the expanded
 * `shipping_cost.shipping_rate` object when the expand resolved, else
 * the rate id as a last resort. Shared by the Order Ledger's
 * `shipping.option` and the Order Alert.
 *
 * @param session - The retrieved Checkout Session.
 * @returns The display name or rate id, or `undefined`.
 */
export function shippingOptionOf(
  session: Stripe.Checkout.Session
): string | undefined {
  const rate = session.shipping_cost?.shipping_rate;
  if (rate && typeof rate === 'object') {
    return rate.display_name ?? undefined;
  }
  return typeof rate === 'string' ? rate : undefined;
}

/**
 * Resolve the customer email across payload shapes: the collected
 * `customer_details.email`, else the legacy top-level
 * `customer_email` field. Shared by the Order Ledger's
 * `customer.email`, the Thank-You recipient, and the Order Alert's
 * customer line — one resolution, three readers.
 *
 * @param session - The retrieved Checkout Session.
 * @returns The customer email, or `undefined` when none was collected.
 */
export function customerEmailOf(
  session: Stripe.Checkout.Session
): string | undefined {
  return session.customer_details?.email ?? session.customer_email ?? undefined;
}

/**
 * Implements ADR 00-015: Transactional Notifications — "The Thank-You
 * Email renders in the Checkout Session's Locale"; the Order Ledger
 * records
 * the same resolved Locale so the purchase record carries the
 * customer-facing language.
 *
 * Resolve the customer-facing Locale: the `metadata.locale` recorded
 * at Session creation (the checkout Route Handler sets it, ADR 00-004)
 * when it is a supported Locale; else the hosted-page `session.locale`
 * when supported; else the Primary Locale.
 *
 * @param session - The retrieved Checkout Session.
 * @returns A supported `Locale`.
 */
export function sessionLocale(session: Stripe.Checkout.Session): Locale {
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
 * One purchased line of the Order Ledger document — name, quantity,
 * and unit price in cents. Structurally identical to the Operator
 * Order Alert's `OrderAlertLine`, so the alert email and the Order
 * Ledger describe the same items.
 */
export interface OrderItem {
  /** The line item's description (product + variant label), or `'—'`
   *  when the PSP payload carried none. */
  name: string;
  /** The purchased quantity. */
  quantity: number;
  /** The unit price in cents — `price.unit_amount`, else derived from
   *  the line total. */
  unitAmountCents: number;
}

/**
 * Map the session's expanded line items into Order Ledger/alert
 * lines: the
 * description falls back to `'—'`, and the unit amount falls back to
 * a per-quantity division of the line total when `price.unit_amount`
 * is absent (the same resolution the Order Alert has always used).
 *
 * @param session - The retrieved Checkout Session (line items
 *   expanded).
 * @returns One `OrderItem` per line item, in payload order.
 */
export function orderItemsOf(session: Stripe.Checkout.Session): OrderItem[] {
  return (session.line_items?.data ?? []).map((item) => ({
    name: item.description ?? '—',
    quantity: item.quantity ?? 0,
    unitAmountCents:
      item.price?.unit_amount ??
      (item.quantity
        ? Math.round(item.amount_total / item.quantity)
        : item.amount_total),
  }));
}

/**
 * The `order:<sessionId>` Order Ledger document — the purchase record
 * the receiver persists per accepted event. Optional fields are absent
 * from the stored JSON when the session did not collect them.
 */
export interface OrderRecord {
  /** The Checkout Session id — the order's identity. */
  id: string;
  /** Session creation time (unix seconds) — the order date. */
  created: number;
  /** The payment status at persist time; the settlement event always
   *  records `'paid'`. */
  paymentStatus: Stripe.Checkout.Session.PaymentStatus;
  /** The session's ISO currency code (e.g. `'eur'`), or `null`. */
  currency: string | null;
  /** The order total in cents, or `null`. */
  amountTotalCents: number | null;
  /** The customer-facing Locale resolved for the session. */
  locale: Locale;
  /** The customer detail (PII — the purchase record's point). */
  customer: {
    /** The customer's name, when collected. */
    name?: string;
    /** The customer's email — `customer_details.email`, else the
     *  legacy `customer_email` field. */
    email?: string;
    /** The customer's phone — `customer_details.phone`; carriers
     *  require it for fulfillment. */
    phone?: string;
  };
  /** The fulfillment detail: recipient name, the formatted address
   *  line, and the chosen shipping option. */
  shipping: {
    /** The shipping recipient's name, when collected. */
    name?: string;
    /** The formatted one-line address, when collected. */
    address?: string;
    /** The chosen shipping option's display name or rate id. */
    option?: string;
  };
  /** The purchased lines. */
  items: OrderItem[];
  /** The operator's fulfillment status — absent on records no
   *  operator has touched (reads as `'pending'` via
   *  `orderStatusOf`). Never written by the webhook: `persistOrder`
   *  preserves the stored value across event rewrites. */
  status?: OrderStatus;
  /** The operator's carrier tracking id — absent when unset. Never
   *  written by the webhook: `persistOrder` preserves the stored
   *  value across event rewrites. */
  trackingId?: string;
}

/**
 * Narrow a stored `order:<sessionId>` value to its parsed document.
 * The SDK's automatic deserialization may already have parsed the
 * JSON into an object; a raw string is parsed here. Anything else —
 * or unparseable JSON — yields `undefined` (the same drop-malformed
 * posture stored-document readers apply).
 *
 * @param value - The stored value as returned by `get`
 *   (untrusted).
 * @returns The parsed document as a plain record, or `undefined`.
 */
function parseStoredOrder(value: unknown): Record<string, unknown> | undefined {
  let doc: unknown = value;
  if (typeof doc === 'string') {
    try {
      doc = JSON.parse(doc);
    } catch {
      return undefined;
    }
  }
  if (doc !== null && typeof doc === 'object' && !Array.isArray(doc)) {
    return doc as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Read the operator-owned fields (`status`, `trackingId`) off a parsed
 * `order:<sessionId>` document so `persistOrder` can carry them across
 * webhook rewrites — the record built from the session never carries
 * them. Each field validates on its own: `status` only when it is a
 * member of `ORDER_STATUSES`, `trackingId` only when it is a string —
 * a hand-corrupted field is dropped rather than carried.
 *
 * @param doc - The previous document, already parsed through
 *   `parseStoredOrder` (`undefined` when absent or corrupt).
 * @returns The preservable operator fields.
 */
function storedOperatorFields(doc: Record<string, unknown> | undefined): {
  status?: OrderStatus;
  trackingId?: string;
} {
  const status =
    doc !== undefined &&
    typeof doc.status === 'string' &&
    (ORDER_STATUSES as readonly string[]).includes(doc.status)
      ? (doc.status as OrderStatus)
      : undefined;
  const trackingId =
    doc !== undefined && typeof doc.trackingId === 'string'
      ? doc.trackingId
      : undefined;
  return { status, trackingId };
}

/**
 * Implements ADR 00-015: Transactional Notifications — the Order
 * Ledger write: "the Order Ledger write ... performed before any
 * send, so the record survives a send failure", and "A delayed
 * settlement (`checkout.session.async_payment_succeeded`) updates
 * the stored payment status without duplicating the index entry."
 *
 * The previous document is `GET`ed first and parsed once; the record
 * built from the retrieved session (the same field resolution the
 * order emails use) merges it in memory — the operator's `status` and
 * `trackingId` carry forward, and a stored `'paid'` payment status
 * holds against a late-arriving `completed` retrieve — then the
 * merged record lands in a single `SET`. A redelivery, or the
 * `completed` → `async_payment_succeeded` settlement pair, updates in
 * place. `checkout.session.async_payment_succeeded` IS the settlement
 * signal: it records `paymentStatus: 'paid'` even when a lagging
 * retrieve still reports the pending status.
 *
 * The single-write shape is deliberate: a crash before the `SET`
 * leaves the previous document intact, so the PSP's retry heals the
 * write completely — there is no corrective second write whose own
 * crash window could strand a half-merged record (dropped operator
 * fields, a regressed payment status the guard can no longer see).
 * Two concurrent writes for the same session that both read before
 * either writes are last-writer-wins within that narrow window —
 * accepted, since the PSP's redeliveries are sequential in practice.
 *
 * The `orders` index entry is `ZADD`ed unconditionally — sorted-set
 * member uniqueness makes the index idempotent end-to-end: a retry
 * after a mid-write crash self-heals the gap and concurrent writers
 * can never duplicate the session id (score = the session's
 * `created`, so the set enumerates newest-first).
 *
 * @param store - The shared managed-store client.
 * @param session - The retrieved Checkout Session (expanded).
 * @param eventType - The accepted event type being persisted.
 * @throws Propagates store failures; the caller answers 502 so the
 *   PSP retries — the write is idempotent.
 */
export async function persistOrder(
  store: Redis,
  session: Stripe.Checkout.Session,
  eventType: OrderEventType
): Promise<void> {
  const key = orderKey(session.id);
  // Read-merge-write: the previous document parses ONCE and feeds both
  // the operator-field carry-over and the paid-regression guard —
  // a single `SET` then lands the fully merged record, so no corrective
  // second write can strand a half-merged document on crash.
  const previous = parseStoredOrder(await store.get(key));
  const shipping = shippingDetailsOf(session);
  const record: OrderRecord = {
    id: session.id,
    created: session.created,
    // The settlement event IS the paid signal — record 'paid' even if
    // a lagging retrieve still shows the pending status.
    paymentStatus:
      eventType === 'checkout.session.async_payment_succeeded'
        ? 'paid'
        : session.payment_status,
    currency: session.currency,
    amountTotalCents: session.amount_total,
    locale: sessionLocale(session),
    customer: {
      name: session.customer_details?.name ?? undefined,
      email: customerEmailOf(session),
      phone: session.customer_details?.phone ?? undefined,
    },
    shipping: {
      name: shipping?.name ?? undefined,
      address: shippingAddressOf(session),
      option: shippingOptionOf(session),
    },
    items: orderItemsOf(session),
  };
  // Operator-owned fields survive webhook rewrites: the session-built
  // record never carries `status`/`trackingId`, so they are carried
  // forward from the previous document — a settlement or redelivery
  // refreshes the purchase detail without clobbering the operator's
  // fulfillment bookkeeping.
  const operator = storedOperatorFields(previous);
  if (operator.status !== undefined) {
    record.status = operator.status;
  }
  if (operator.trackingId !== undefined) {
    record.trackingId = operator.trackingId;
  }
  // Regression guard: a settled order never returns to a pending
  // status — "a record once settled (`paid`) never regresses on a
  // later-arriving event" (ADR 00-015). Every other field still
  // refreshes with the late-arriving values.
  if (previous?.paymentStatus === 'paid' && record.paymentStatus !== 'paid') {
    record.paymentStatus = 'paid';
  }
  await store.set(key, JSON.stringify(record));
  // Unconditional `ZADD`: member uniqueness makes the index entry
  // idempotent — a retry after a mid-write crash self-heals the gap.
  await store.zadd(ORDERS_INDEX_KEY, {
    score: session.created,
    member: session.id,
  });
}

/**
 * Materialize a stored `order:<sessionId>` document into a clean
 * `OrderRecord` for operator reads — the drop-malformed posture the
 * profiles readers apply: a document without a usable identity (`id`,
 * `created`) is corrupt and drops; every other field resolves
 * leniently because the webhook's own writer produced it. The
 * operator fields validate individually — a non-`ORDER_STATUSES`
 * status or a non-string tracking id reads as absent rather than
 * surfacing corruption into the console.
 *
 * @param value - The stored value (untrusted — the SDK may have
 *   already deserialized it).
 * @returns The order record, or `undefined` when the document is
 *   missing or corrupt.
 */
function parseOrderRecord(value: unknown): OrderRecord | undefined {
  const doc = parseStoredOrder(value);
  if (doc === undefined) return undefined;
  // The identity pair is the corruption gate: a document that cannot
  // name itself or its moment is not an order record.
  if (typeof doc.id !== 'string' || doc.id === '') return undefined;
  if (typeof doc.created !== 'number' || !Number.isFinite(doc.created)) {
    return undefined;
  }

  const customer =
    doc.customer !== null &&
    typeof doc.customer === 'object' &&
    !Array.isArray(doc.customer)
      ? (doc.customer as Record<string, unknown>)
      : {};
  const shipping =
    doc.shipping !== null &&
    typeof doc.shipping === 'object' &&
    !Array.isArray(doc.shipping)
      ? (doc.shipping as Record<string, unknown>)
      : {};
  const items: OrderItem[] = (Array.isArray(doc.items) ? doc.items : [])
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
    )
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : '—',
      quantity: typeof item.quantity === 'number' ? item.quantity : 0,
      unitAmountCents:
        typeof item.unitAmountCents === 'number' ? item.unitAmountCents : 0,
    }));

  const record: OrderRecord = {
    id: doc.id,
    created: doc.created,
    paymentStatus:
      typeof doc.paymentStatus === 'string'
        ? (doc.paymentStatus as Stripe.Checkout.Session.PaymentStatus)
        : 'unpaid',
    currency: typeof doc.currency === 'string' ? doc.currency : null,
    amountTotalCents:
      typeof doc.amountTotalCents === 'number' ? doc.amountTotalCents : null,
    locale:
      typeof doc.locale === 'string' &&
      (locales as readonly string[]).includes(doc.locale)
        ? (doc.locale as Locale)
        : defaultLocale,
    customer: {
      ...(typeof customer.name === 'string' ? { name: customer.name } : {}),
      ...(typeof customer.email === 'string' ? { email: customer.email } : {}),
      ...(typeof customer.phone === 'string' ? { phone: customer.phone } : {}),
    },
    shipping: {
      ...(typeof shipping.name === 'string' ? { name: shipping.name } : {}),
      ...(typeof shipping.address === 'string'
        ? { address: shipping.address }
        : {}),
      ...(typeof shipping.option === 'string'
        ? { option: shipping.option }
        : {}),
    },
    items,
  };
  const operator = storedOperatorFields(doc);
  if (operator.status !== undefined) record.status = operator.status;
  if (operator.trackingId !== undefined) {
    record.trackingId = operator.trackingId;
  }
  return record;
}

/**
 * Implements ADR 00-015: Transactional Notifications — the Order
 * Ledger read the Admin Console's Orders section performs: "the index
 * of recorded orders" enumerates every `order:<sessionId>` document
 * newest-first — "the ledger is the fulfillment/audit copy" the
 * operator's manual Fulfillment ships against.
 *
 * `ZRANGE orders 0 -1 REV` yields the session ids newest-first (score
 * = the session's `created`), then one pipelined `GET` batch fetches
 * every document in a single round-trip — the same pipeline pattern
 * `readProfiles` applies. A member whose document is missing or
 * corrupt drops from the list rather than taking the whole read down.
 *
 * Scale note: `0 -1` loads the WHOLE index and the pipeline fetches
 * every document — bounded by the operator-console audience (a
 * single-operator fulfillment view, not a hot path). If the ledger
 * reaches thousands of orders, a `ZRANGE` limit/cursor window becomes
 * the relevant change.
 *
 * @param store - The shared managed-store client.
 * @returns The order records, newest-first.
 * @throws Propagates store read failures; callers degrade per their
 *   fail-closed posture.
 */
export async function readOrders(store: Redis): Promise<OrderRecord[]> {
  const ids = await store.zrange<string[]>(ORDERS_INDEX_KEY, 0, -1, {
    rev: true,
  });
  if (ids.length === 0) return [];

  const pipeline = store.pipeline();
  for (const id of ids) {
    pipeline.get(orderKey(id));
  }
  const docs: unknown[] = await pipeline.exec();

  const orders: OrderRecord[] = [];
  for (const doc of docs) {
    const record = parseOrderRecord(doc);
    if (record !== undefined) orders.push(record);
  }
  return orders;
}

/**
 * The operator's per-order update: the fulfillment `status` and
 * `trackingId` — the only fields the Admin Console's Orders section
 * may write. Everything else on the record is PSP-derived purchase
 * detail the webhook owns.
 */
export interface OrderUpdate {
  /** The new fulfillment status — must be a member of
   *  `ORDER_STATUSES`. */
  status?: string;
  /** The carrier tracking id — trimmed on write; an empty or
   *  whitespace value clears the field (absent from the stored
   *  document). A non-string transport value rejects as invalid. */
  trackingId?: string;
}

/**
 * Implements ADR 00-015: Transactional Notifications — the operator
 * half of the Order Ledger write path: the ledger is "the
 * fulfillment/audit copy" the manual Fulfillment works against, so
 * the operator's bookkeeping lands on the same `order:<sessionId>`
 * document the webhook maintains — under the same single-document
 * `SET` posture.
 *
 * Reads the stored document, merges the validated operator fields
 * (`status` only when a member of `ORDER_STATUSES`; `trackingId`
 * trimmed, an empty value clearing the field), and rewrites the
 * record. Fail-closed like every store consumer: a missing or corrupt
 * document throws rather than fabricating a record — a lookup for a
 * session the PSP never delivered can never mint an order.
 *
 * @param store - The shared managed-store client.
 * @param id - The Checkout Session id — the order's identity.
 * @param fields - The operator fields to merge (untrusted).
 * @returns The updated order record.
 * @throws `Error` when the document is missing or corrupt, a
 *   submitted `status` is not a member of `ORDER_STATUSES`, or a
 *   submitted `trackingId` is not a string.
 * @throws Propagates store failures; the caller surfaces the error.
 */
export async function updateOrder(
  store: Redis,
  id: string,
  fields: OrderUpdate
): Promise<OrderRecord> {
  const record = parseOrderRecord(await store.get(orderKey(id)));
  if (record === undefined) {
    throw new Error(`Unknown or corrupt order: ${id}`);
  }
  if (fields.status !== undefined) {
    if (!(ORDER_STATUSES as readonly string[]).includes(fields.status)) {
      throw new Error(`Invalid order status: ${fields.status}`);
    }
    record.status = fields.status as OrderStatus;
  }
  if (fields.trackingId !== undefined) {
    // The field is transport-untrusted: a non-string value (number,
    // object, array) must reject with a named validation error, not a
    // `.trim` TypeError.
    if (typeof fields.trackingId !== 'string') {
      throw new Error('Invalid tracking id: not a string');
    }
    const trackingId = fields.trackingId.trim();
    if (trackingId === '') {
      delete record.trackingId;
    } else {
      record.trackingId = trackingId;
    }
  }
  await store.set(orderKey(id), JSON.stringify(record));
  return record;
}
