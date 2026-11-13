'use server';

import { revalidatePath } from 'next/cache';
import { writeSiteConfig } from '@/lib/edge-config-write';
import { findVariant } from '@/lib/constants';
import { getManagedStore } from '@/lib/managed-store';
import {
  CHROME_KEYS,
  SECTION_KEYS,
  STOCK_KEYS,
  type SiteConfig,
} from '@/lib/site-config';
import { stockNotificationKey } from '@/lib/stock-notification';

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveSiteConfig(formData: FormData): Promise<SaveResult> {
  const next: SiteConfig = {
    sections: {} as SiteConfig['sections'],
    chrome: {} as SiteConfig['chrome'],
    stock: {} as SiteConfig['stock'],
  };

  for (const key of SECTION_KEYS) {
    next.sections[key] = formData.get(`sections.${key}`) === 'on';
  }
  for (const key of CHROME_KEYS) {
    next.chrome[key] = formData.get(`chrome.${key}`) === 'on';
  }
  // Implements ADR 00-010: "Each Stock Flag is an operator toggle in
  // Site Config — one per Variant in Product Data — the same mechanism
  // as the section and chrome toggles ... edited through the Admin
  // Console". `STOCK_KEYS` enumerates the catalog's Variants, so the
  // form's `stock.<variantId>` fields map one-to-one onto the stored
  // record.
  for (const key of STOCK_KEYS) {
    next.stock[key] = formData.get(`stock.${key}`) === 'on';
  }

  const redirectUrl = formData.get('sections.qrcoderedirect');
  next.sections.qrcoderedirect =
    typeof redirectUrl === 'string' ? redirectUrl.trim() : '';

  try {
    await writeSiteConfig(next);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown write error';
    return { ok: false, error: message };
  }

  // Edge Config propagates to readers within ~seconds; invalidate RSC cache so
  // the next request re-renders with the new flags.
  revalidatePath('/', 'layout');
  revalidatePath('/admin');

  return { ok: true };
}

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "the list
 * is an operator-held record the operator can export and clear", the
 * purge half of the "operator export-and-clear path" the ADR 00-008
 * privacy posture requires as the deletion mechanism.
 *
 * Deletes one Variant's entire Stock Notification List
 * (`DEL stock-notifications:<variantId>`) from the shared managed
 * store. Fail-closed like every store consumer: an unconfigured store
 * reports an error rather than a success it did not perform.
 *
 * @param variantId - The Variant whose list is purged; must name a
 *   real Product Data Variant.
 * @returns `{ok: true}` once the key is deleted; `{ok: false, error}`
 *   when the store is unconfigured, the Variant unknown, or the delete
 *   fails.
 */
export async function clearStockNotificationList(
  variantId: string
): Promise<SaveResult> {
  if (!findVariant(variantId)) {
    return { ok: false, error: 'Unknown variant' };
  }

  const store = getManagedStore();
  if (!store) {
    return { ok: false, error: 'Store not configured' };
  }

  try {
    await store.del(stockNotificationKey(variantId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown delete error';
    return { ok: false, error: message };
  }

  revalidatePath('/admin');
  return { ok: true };
}
