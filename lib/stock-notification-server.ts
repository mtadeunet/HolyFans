import type { Redis } from '@upstash/redis';
import { PRODUCT } from '@/lib/constants';
import type { ProductVariant } from '@/types/product';
import {
  stockNotificationKey,
  type StockNotificationRecord,
} from '@/lib/stock-notification';

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — the Stock
 * Notification List "is an operator-held record the operator can export
 * and clear", and ADR 00-008: "an operator export-and-clear path exists
 * as the deletion mechanism".
 *
 * Server-side reads backing the Admin Console's Stock Notifications
 * view: the operator's export path over the same managed store client
 * (`getManagedStore()` from `lib/managed-store.ts`) the like counter
 * uses — the provisioned store is
 * shared, the per-Variant keyspace is not. Kept out of
 * `lib/stock-notification.ts` so that module stays pure (no Redis
 * import) and unit-testable in Node.
 */

/**
 * Every Variant in Product Data, flattened in catalog order — the set
 * the Admin Console's Stock Notifications view iterates for both the
 * live read and its degraded base.
 *
 * @returns All `ProductVariant`s across every fit.
 */
function allVariants(): ProductVariant[] {
  return Object.values(PRODUCT.variants).flat();
}

/**
 * The Variant's operator-facing display label (name + size) — shared
 * by the Admin Console's list view and the Restock Notification send
 * (ADR 00-015) so the Variant is identified the same way everywhere.
 *
 * @param variant - A Product Data Variant.
 * @returns The `'<name> — <size>'` label.
 */
export function variantLabel(variant: ProductVariant): string {
  return `${variant.name} — ${variant.size}`;
}

/**
 * One captured email with the consent record stored beside it — the
 * operator's export row. `record` is `null` when the stored value is
 * corrupt or predates the consent-record shape; the email itself is
 * still exportable either way.
 */
export interface StockNotificationEntry {
  /** The normalized (trimmed, lowercased) captured email — the HASH
   *  field name. */
  email: string;
  /** The consent record parsed from the HASH value, or `null` when the
   *  stored value is not a well-formed record. */
  record: StockNotificationRecord | null;
}

/**
 * One Variant's operator-facing Stock Notification List slice: every
 * captured email plus its consent record, sorted by consent time.
 */
export interface VariantStockNotifications {
  /** A real Product Data Variant id — always carried in the catalog. */
  variantId: string;
  /** The Variant's display label for the operator (name + size). */
  label: string;
  /** The Variant's captured emails — the export view (ADR 00-010). */
  entries: StockNotificationEntry[];
}

/**
 * Read the Stock Notification List for every Variant in Product Data —
 * the Admin Console's export view: `HGETALL
 * stock-notifications:<variantId>` per Variant, in catalog order.
 * Entries sort oldest-consent first so the list reads chronologically.
 *
 * @param store - The configured shared Redis client.
 * @returns One `VariantStockNotifications` per Variant.
 * @throws Propagates store read failures; the Admin Console surfaces
 *   them as the store-error state (the same fail-closed posture as the
 *   Likes view).
 */
export async function readVariantStockNotifications(
  store: Redis
): Promise<VariantStockNotifications[]> {
  return Promise.all(
    allVariants().map(async (variant) => {
      // The SDK auto-deserializes: a JSON-string HASH value comes back
      // as an object, so field values arrive as `unknown` — parseRecord
      // narrows them either way.
      const raw = await store.hgetall<Record<string, unknown>>(
        stockNotificationKey(variant.id)
      );
      const entries: StockNotificationEntry[] = Object.entries(raw ?? {})
        .map(([email, value]) => ({
          email,
          record: parseRecord(value),
        }))
        .sort((a, b) =>
          (a.record?.consentedAt ?? '').localeCompare(
            b.record?.consentedAt ?? ''
          )
        );
      return {
        variantId: variant.id,
        label: variantLabel(variant),
        entries,
      };
    })
  );
}

/**
 * The degraded counterpart of `readVariantStockNotifications`: one
 * empty list per Variant so the Admin Console still renders the
 * section when the store is unconfigured or failing.
 *
 * @returns One `VariantStockNotifications` per Variant with no entries.
 */
export function baseVariantStockNotifications(): VariantStockNotifications[] {
  return allVariants().map((variant) => ({
    variantId: variant.id,
    label: variantLabel(variant),
    entries: [],
  }));
}

/**
 * Parse a stored HASH value into a consent record. The SDK's automatic
 * deserialization may already have parsed a JSON-string value into an
 * object; a raw string is parsed here. Anything else — or a record
 * predating the consent shape — yields `null`.
 *
 * @param value - The HASH field value as returned by `hgetall`
 *   (untrusted — it may be an object, a JSON string, or corrupt).
 * @returns The `StockNotificationRecord`, or `null` when the value is
 *   not a well-formed record.
 */
export function parseRecord(value: unknown): StockNotificationRecord | null {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.consentedAt !== 'string' ||
    typeof candidate.locale !== 'string'
  ) {
    return null;
  }
  return {
    consentedAt: candidate.consentedAt,
    locale: candidate.locale,
  };
}
