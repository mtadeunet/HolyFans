import type { VariantStockNotifications } from '@/lib/stock-notification-server';
import ClearListButton from './clear-list-button';
import NotifyListButton from './notify-list-button';
import { formatStoreTimestamp } from './format-timestamp';
import type { StoreStatus } from './types';

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "the list
 * is an operator-held record the operator can export and clear", and
 * ADR 00-008: "an operator export-and-clear path exists as the
 * deletion mechanism".
 *
 * The Admin Console's Stock Notifications section: one card per
 * Product Data Variant listing the captured emails with their consent
 * records (Locale + timestamp) — the operator's export view — plus a
 * per-Variant clear control (the purge path) and a banner reporting
 * the managed store's health, the same surfacing posture as the Likes
 * section. Shown only inside the password-gated Admin Console: the
 * operator is the list's owner; no email ever leaves this surface to
 * the storefront or analytics.
 */

interface StockNotificationsSectionProps {
  /** Store health: connected, unconfigured, or a failed read. */
  status: StoreStatus;
  /** The store's error message when `status` is `'error'`. */
  statusDetail?: string;
  /** One list per Product Data Variant; empty lists when the store is
   *  down. */
  lists: VariantStockNotifications[];
}

/**
 * The Stock Notifications section body — a presentational server
 * component; the page supplies the store read's outcome as props.
 *
 * @param props - Store status plus the per-Variant lists.
 * @returns The Stock Notifications section markup.
 */
export default function StockNotificationsSection({
  status,
  statusDetail,
  lists,
}: StockNotificationsSectionProps) {
  const total = lists.reduce((sum, list) => sum + list.entries.length, 0);

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-1 text-xl font-semibold text-text-primary">
        Stock Notifications
      </h2>
      <p className="mb-4 text-sm text-text-secondary">
        Consented pre-order captures per variant — the operator-held
        export-and-clear list (emails are personal data: export, notify, then
        clear; never reuse for marketing).
      </p>

      {/* Store health banner — same surfacing posture as the Likes
          section: explicit in every state, never silent. */}
      {status === 'connected' && (
        <p className="mb-4 text-sm text-green-700" role="status">
          Notification store: connected — {total} email
          {total === 1 ? '' : 's'} captured.
        </p>
      )}
      {status === 'unconfigured' && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          Notification store: not configured — captures cannot persist.
        </p>
      )}
      {status === 'error' && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          Notification store: read failed
          {statusDetail ? ` — ${statusDetail}` : ''}. Lists shown empty.
        </p>
      )}

      <ul className="space-y-2">
        {lists.map((list) => (
          <li
            key={list.variantId}
            className="rounded-lg border border-border bg-background px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text-primary">
                  {list.label}
                </span>
                <code className="block truncate text-xs text-text-secondary">
                  {list.variantId}
                </code>
              </div>
              <span className="text-sm font-semibold text-text-primary">
                {list.entries.length} email
                {list.entries.length === 1 ? '' : 's'}
              </span>
              {status === 'connected' && list.entries.length > 0 && (
                <>
                  {/* Implements ADR 00-015: the operator-triggered
                      Restock Notification send-and-clear beside the
                      purge control (ADR 00-010). */}
                  <NotifyListButton
                    variantId={list.variantId}
                    count={list.entries.length}
                  />
                  <ClearListButton variantId={list.variantId} />
                </>
              )}
            </div>
            {/* The export view: each captured email with the consent
                record stored beside it (Locale + UTC timestamp); a
                missing record marks an unreadable stored value. */}
            {list.entries.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3">
                {list.entries.map((entry) => (
                  <li
                    key={entry.email}
                    className="flex flex-wrap items-baseline gap-x-3 text-sm"
                  >
                    <code className="text-text-primary">{entry.email}</code>
                    <span className="text-xs text-text-secondary">
                      {entry.record === null
                        ? 'consent record unreadable'
                        : `${entry.record.locale} · ${formatStoreTimestamp(entry.record.consentedAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
