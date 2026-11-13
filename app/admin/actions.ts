'use server';

import { revalidatePath } from 'next/cache';
import { writeSiteConfig } from '@/lib/edge-config-write';
import { findVariant } from '@/lib/constants';
import { getManagedStore } from '@/lib/managed-store';
import { getSiteConfig } from '@/lib/site-config-server';
import {
  CHROME_KEYS,
  SECTION_KEYS,
  STOCK_KEYS,
  type SiteConfig,
} from '@/lib/site-config';
import { normalizeCampaigns } from '@/lib/promotions';
import { stockNotificationKey } from '@/lib/stock-notification';

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveSiteConfig(formData: FormData): Promise<SaveResult> {
  const next: SiteConfig = {
    sections: {} as SiteConfig['sections'],
    chrome: {} as SiteConfig['chrome'],
    stock: {} as SiteConfig['stock'],
    // Every path below overwrites both fields — a valid submit, or the
    // stored value on absent/invalid input. Empty placeholders state
    // that honestly; seeding defaults here would never persist.
    promotion: { campaigns: [] },
    shipping: { freeShippingThresholdCents: 0 },
  };

  // Carry-over reads are lazy and shared — the campaigns and threshold
  // fallbacks each need the stored config, and a doubly-malformed
  // submit should not read the config store twice.
  let storedConfig: SiteConfig | null = null;
  const stored = async (): Promise<SiteConfig> =>
    (storedConfig ??= await getSiteConfig());

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

  // Implements ADR 03-003: Promotion Bar — the Promotion Campaign list is
  // "operator-editable Site Config data": the form submits it as one
  // serialized JSON field, normalized through the same rules
  // `normalizeSiteConfig` applies on read. The write path validates
  // strictly and rejects invalid campaigns with a named error —
  // fail-loud for the operator, fail-safe for the visitor.
  const rawCampaigns = formData.get('promotion.campaigns');
  if (typeof rawCampaigns === 'string' && rawCampaigns.length > 0) {
    let parsedCampaigns: unknown;
    try {
      parsedCampaigns = JSON.parse(rawCampaigns);
    } catch {
      return { ok: false, error: 'Campaign data is not valid JSON' };
    }
    if (!Array.isArray(parsedCampaigns)) {
      return { ok: false, error: 'Campaign data is not a campaign list' };
    }
    const normalizedCampaigns = normalizeCampaigns(parsedCampaigns);
    if (normalizedCampaigns.length !== parsedCampaigns.length) {
      // Name the offending entries — a bare count leaves the operator
      // guessing which row is broken. An entry fails when it cannot
      // normalize on its own or when its id duplicates an earlier row.
      const seenIds = new Set<string>();
      const failed = parsedCampaigns
        .map((entry, index) => {
          const record =
            entry && typeof entry === 'object'
              ? (entry as Record<string, unknown>)
              : null;
          const id =
            record && typeof record.id === 'string' && record.id
              ? record.id
              : `#${index + 1}`;
          if (normalizeCampaigns([entry]).length === 0) return id;
          if (record && typeof record.id === 'string' && record.id) {
            if (seenIds.has(record.id)) return id;
            seenIds.add(record.id);
          }
          return null;
        })
        .filter((id): id is string => id !== null);
      return {
        ok: false,
        error: `${failed.length} campaign(s) failed validation (${failed.join(', ')}) — check required fields: unique slug-safe id (a-z, 0-9, hyphens), type, theme, PT + EN label and headline, non-inverted dates`,
      };
    }
    next.promotion.campaigns = normalizedCampaigns;
  } else {
    // The field is absent only on a malformed submit — the form always
    // sends it. Carry the stored list forward rather than seeding
    // defaults over the operator's campaigns.
    next.promotion.campaigns = (await stored()).promotion.campaigns;
  }

  // Implements ADR 03-003: Promotion Bar — the free-shipping threshold
  // is operator-editable Site Config data, submitted in euros and
  // stored in whole cents. A valid non-negative value is applied; an
  // invalid or missing field carries the stored value forward — the
  // same carry-over posture as campaigns: never silently reset
  // operator config.
  const rawThreshold = formData.get('shipping.freeShippingThreshold');
  const thresholdEuros =
    typeof rawThreshold === 'string'
      ? Number.parseFloat(rawThreshold)
      : Number.NaN;
  if (Number.isFinite(thresholdEuros) && thresholdEuros >= 0) {
    next.shipping.freeShippingThresholdCents = Math.round(thresholdEuros * 100);
  } else {
    next.shipping.freeShippingThresholdCents = (
      await stored()
    ).shipping.freeShippingThresholdCents;
  }

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
