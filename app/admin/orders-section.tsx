'use client';

import { useState, useTransition } from 'react';
import {
  ORDER_STATUSES,
  orderStatusOf,
  type OrderRecord,
  type OrderStatus,
} from '@/lib/orders-server';
import { saveOrder, type SaveResult } from './actions';
import { formatStoreTimestamp } from './format-timestamp';
import { fieldLabelClass, inputClass } from './styles';
import type { StoreStatus } from './types';

/**
 * Implements ADR 00-015: Transactional Notifications — the Admin
 * Console's Orders section: the operator's view of the Order Ledger,
 * "the fulfillment/audit copy" manual Fulfillment ships against — one
 * row per `order:<sessionId>` document, newest-first through the
 * `orders` index, carrying the purchase detail (date, customer,
 * items, total, payment status) plus the operator's own fulfillment
 * bookkeeping (`status`, `trackingId`), edited per order through the
 * `saveOrder` Server Action. The store's health is surfaced in a
 * banner with the same posture as the Likes, Stock Notifications,
 * and Profiles sections.
 */

const badgeClass =
  'rounded border border-border bg-background px-1.5 py-0.5 text-xs font-medium';

/** The fulfillment status badge's tone per state — the lifecycle reads
 *  from neutral pending to green complete. */
const STATUS_BADGE_TONE: Record<OrderStatus, string> = {
  pending: 'text-text-secondary',
  processing: 'text-accent',
  shipped: 'text-primary',
  complete: 'text-green-700',
};

/** One order's editable operator fields — the console's draft form. */
interface OrderDraft {
  /** The fulfillment status draft. */
  status: OrderStatus;
  /** The tracking id draft — `''` clears the stored value. */
  trackingId: string;
}

/**
 * The operator draft for one order, seeded from the record as read
 * (`status` absent resolves to `'pending'` through `orderStatusOf`; a
 * missing tracking id edits as `''`). Every `drafts[order.id]` read
 * falls back to this seed — an order arriving after mount (a new
 * checkout landing between renders) carries no draft entry yet, and
 * the editor must still render and save.
 */
function draftOf(order: OrderRecord): OrderDraft {
  return {
    status: orderStatusOf(order),
    trackingId: order.trackingId ?? '',
  };
}

/**
 * The editor's starting drafts: one per order present at mount —
 * later arrivals seed lazily through `draftOf`.
 */
function initialDrafts(
  orders: readonly OrderRecord[]
): Record<string, OrderDraft> {
  return Object.fromEntries(
    orders.map((order) => [order.id, draftOf(order)])
  );
}

/**
 * Format a cent amount in the session's currency. An unrecognized
 * currency code falls back to a plain `<amount> <CODE>` rendering
 * rather than throwing on a malformed record.
 *
 * @param amountCents - The amount in cents.
 * @param currency - The ISO currency code (already uppercased).
 * @returns The formatted amount.
 */
function formatCents(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Render the order total for the operator: the stored cents in the
 * session's own currency, EUR when the session carried none.
 *
 * @param order - The order record.
 * @returns The formatted total, or `'—'` when the session carried no
 *   amount.
 */
function formatOrderTotal(order: OrderRecord): string {
  if (order.amountTotalCents === null) return '—';
  return formatCents(
    order.amountTotalCents,
    (order.currency ?? 'eur').toUpperCase()
  );
}

interface OrdersSectionProps {
  /** Store health: connected, unconfigured, or a failed read. */
  status: StoreStatus;
  /** The store's error message when `status` is `'error'`. */
  statusDetail?: string;
  /** The Order Ledger's records, newest-first; empty when the store
   *  is down. */
  orders: OrderRecord[];
}

/**
 * The Orders section body: the order list — one expandable card per
 * record with its purchase summary (date, customer, item count,
 * total, payment and fulfillment badges, tracking id) and, expanded,
 * the fulfillment detail (items with quantities and unit prices,
 * shipping name/address/option, phone, locale, session id) plus the
 * per-order editors. One Save button per order persists ONLY that
 * order's operator fields through `saveOrder`.
 *
 * @param props - Store status plus the newest-first order records.
 * @returns The Orders section markup.
 */
export default function OrdersSection({
  status,
  statusDetail,
  orders,
}: OrdersSectionProps) {
  /**
   * The editor's state. `drafts` holds every order's edited operator
   * fields keyed by session id; `expandedId` opens one order's detail
   * at a time. The seeds intentionally do not resync when an order's
   * record changes after a server revalidation — accepted for a
   * single-operator console; a reload re-seeds them (the same
   * posture as the Profiles section). Orders ARRIVING after mount
   * carry no entry at all — every read falls back to `draftOf(order)`
   * so a new checkout's editor still renders and saves.
   */
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>(() =>
    initialDrafts(orders)
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<
    Record<string, SaveResult | null>
  >({});

  const updateDraft = (order: OrderRecord, patch: Partial<OrderDraft>): void =>
    setDrafts((prev) => ({
      ...prev,
      // Seed from the record when no draft exists yet — an order that
      // arrived after mount edits against `draftOf`, never drops the
      // keystroke.
      [order.id]: { ...(prev[order.id] ?? draftOf(order)), ...patch },
    }));

  /**
   * Implements ADR 00-015: the selected order's operator fields
   * travel to `saveOrder` as a serializable server-action argument;
   * the action validates `status` against `ORDER_STATUSES` and merges
   * onto the stored document — the purchase detail itself is
   * webhook-owned and never submitted.
   */
  const onSave = (order: OrderRecord): void => {
    const draft = drafts[order.id] ?? draftOf(order);
    setPendingId(order.id);
    setSaveStatus((prev) => ({ ...prev, [order.id]: null }));
    startTransition(async () => {
      const result = await saveOrder(order.id, draft);
      setSaveStatus((prev) => ({ ...prev, [order.id]: result }));
      setPendingId(null);
    });
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-1 text-xl font-semibold text-text-primary">Orders</h2>
      <p className="mb-4 text-sm text-text-secondary">
        The Order Ledger — every recorded checkout, newest first, with the
        fulfillment detail the order ships against. Set a status and the carrier
        tracking id per order; purchase detail itself comes from the payment
        provider and is read-only.
      </p>

      {/* Store health banner — connected, unconfigured, or a failed
          read, with the error surfaced rather than silent (the same
          posture as the Likes, Stock Notifications, and Profiles
          sections). */}
      {status === 'connected' && (
        <p className="mb-4 text-sm text-green-700" role="status">
          Order store: connected — {orders.length} order
          {orders.length === 1 ? '' : 's'} recorded.
        </p>
      )}
      {status === 'unconfigured' && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          Order store: not configured — orders cannot load or save.
        </p>
      )}
      {status === 'error' && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          Order store: read failed
          {statusDetail ? ` — ${statusDetail}` : ''}. Orders shown empty.
        </p>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No orders recorded yet — completed checkouts land here through the
          payment webhook.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => {
            // Orders arriving after mount carry no draft entry yet —
            // seed from the record so the editor always renders.
            const draft = drafts[order.id] ?? draftOf(order);
            const expanded = expandedId === order.id;
            const result = saveStatus[order.id];
            const itemCount = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0
            );
            return (
              <li
                key={order.id}
                className="rounded-lg border border-border bg-background px-4 py-3"
              >
                {/* The summary row: date, customer, item count, total,
                    the two badges, and the expand toggle. */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text-primary">
                      {order.customer.name ?? order.shipping.name ?? '—'}
                    </span>
                    <span className="block truncate text-xs text-text-secondary">
                      {formatStoreTimestamp(
                        new Date(order.created * 1000).toISOString()
                      )}
                      {order.customer.email ? ` · ${order.customer.email}` : ''}
                    </span>
                  </div>
                  <span className="text-xs text-text-secondary">
                    {itemCount} item{itemCount === 1 ? '' : 's'}
                  </span>
                  <span className="text-sm font-semibold text-text-primary">
                    {formatOrderTotal(order)}
                  </span>
                  {/* The PSP's payment state — read-only here. */}
                  <span
                    className={`${badgeClass} ${
                      order.paymentStatus === 'paid'
                        ? 'text-green-700'
                        : 'text-text-secondary'
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                  {/* The operator's fulfillment status. */}
                  <span
                    className={`${badgeClass} ${
                      STATUS_BADGE_TONE[orderStatusOf(order)]
                    }`}
                  >
                    {orderStatusOf(order)}
                  </span>
                  {order.trackingId !== undefined && (
                    <code className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-text-secondary">
                      {order.trackingId}
                    </code>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : order.id)}
                    aria-expanded={expanded}
                    aria-controls={`order-detail-${order.id}`}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface/60"
                  >
                    {expanded ? 'Hide' : 'Details'}
                  </button>
                </div>

                {/* The expanded fulfillment detail + per-order
                    editors — a labeled region the toggle's
                    `aria-controls` names. */}
                {expanded && (
                  <div
                    id={`order-detail-${order.id}`}
                    role="region"
                    aria-label={`Order detail — ${order.id}`}
                    className="mt-3 space-y-3 border-t border-border pt-3"
                  >
                    <ul className="space-y-1">
                      {order.items.map((item, index) => (
                        <li
                          key={`${order.id}-item-${index}`}
                          className="flex flex-wrap items-baseline gap-x-2 text-sm"
                        >
                          <span className="text-text-primary">{item.name}</span>
                          <span className="text-xs text-text-secondary">
                            × {item.quantity} ·{' '}
                            {formatCents(
                              item.unitAmountCents,
                              (order.currency ?? 'eur').toUpperCase()
                            )}{' '}
                            each
                          </span>
                        </li>
                      ))}
                    </ul>
                    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="inline text-text-secondary">
                          Ship to:{' '}
                        </dt>
                        <dd className="inline text-text-primary">
                          {order.shipping.name ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-text-secondary">
                          Address:{' '}
                        </dt>
                        <dd className="inline text-text-primary">
                          {order.shipping.address ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-text-secondary">Option: </dt>
                        <dd className="inline text-text-primary">
                          {order.shipping.option ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-text-secondary">Phone: </dt>
                        <dd className="inline text-text-primary">
                          {order.customer.phone ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-text-secondary">Locale: </dt>
                        <dd className="inline text-text-primary">
                          {order.locale}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-text-secondary">
                          Session:{' '}
                        </dt>
                        <dd className="inline">
                          <code className="text-xs text-text-primary">
                            {order.id}
                          </code>
                        </dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap items-end gap-3">
                      <label className="block w-40">
                        <span className={fieldLabelClass}>Status</span>
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            updateDraft(order, {
                              status: event.target.value as OrderStatus,
                            })
                          }
                          className={inputClass}
                        >
                          {ORDER_STATUSES.map((orderStatus) => (
                            <option key={orderStatus} value={orderStatus}>
                              {orderStatus}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block min-w-40 flex-1">
                        <span className={fieldLabelClass}>Tracking id</span>
                        <input
                          type="text"
                          value={draft.trackingId}
                          onChange={(event) =>
                            updateDraft(order, {
                              trackingId: event.target.value,
                            })
                          }
                          placeholder="Carrier tracking id — blank clears it"
                          className={inputClass}
                        />
                      </label>
                      <span className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onSave(order)}
                          disabled={isPending}
                          className="rounded-lg border border-accent bg-surface px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
                        >
                          {isPending && pendingId === order.id
                            ? 'Saving…'
                            : 'Save'}
                        </button>
                        {result?.ok === true && (
                          <span
                            className="text-xs text-green-700"
                            role="status"
                          >
                            Saved.
                          </span>
                        )}
                        {result !== null &&
                          result !== undefined &&
                          result.ok === false && (
                            <span
                              className="text-xs text-red-600"
                              role="alert"
                            >
                              {result.error}
                            </span>
                          )}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
