'use server';

import { revalidatePath } from 'next/cache';
import { writeSiteConfig } from '@/lib/edge-config-write';
import { findVariant, PRODUCT, SITE_CONFIG } from '@/lib/constants';
import { getEmailConfig, sendEmail } from '@/lib/email';
import {
  EMPTY_EMAIL_OVERRIDES,
  normalizeEmailOverrides,
  restockEmail,
} from '@/lib/email-templates';
import { defaultLocale, locales, type Locale } from '@/lib/i18n';
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
import {
  parseRecord,
  variantLabel,
} from '@/lib/stock-notification-server';

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
    emails: EMPTY_EMAIL_OVERRIDES,
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

  // Implements ADR 00-013: Email Delivery Channel — the `emails` group
  // is "operator-editable Site Config data": the form submits it as one
  // serialized JSON field, normalized through the same rules
  // `normalizeSiteConfig` applies on read. Unlike campaigns there is no
  // fail-loud case — every field is optional and malformed entries drop
  // out — so only unparseable JSON rejects the submit; parsed JSON that
  // is not an overrides object carries the stored group forward like an
  // absent field.
  const rawEmails = formData.get('emails');
  if (typeof rawEmails === 'string' && rawEmails.length > 0) {
    let parsedEmails: unknown;
    try {
      parsedEmails = JSON.parse(rawEmails);
    } catch {
      return { ok: false, error: 'Email template data is not valid JSON' };
    }
    if (
      !parsedEmails ||
      typeof parsedEmails !== 'object' ||
      Array.isArray(parsedEmails)
    ) {
      // Well-formed JSON that is not an overrides object is malformed
      // submit data too — normalizing a scalar or array would produce
      // an all-defaults group and silently wipe the operator's copy,
      // the same reset the absent-field path below refuses to make.
      next.emails = (await stored()).emails;
    } else {
      next.emails = normalizeEmailOverrides(parsedEmails);
    }
  } else {
    // The field is absent only on a malformed submit — the form always
    // sends it. Carry the stored overrides forward rather than wiping
    // the operator's copy.
    next.emails = (await stored()).emails;
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

export type NotifyResult =
  | { ok: true; sent: number; failed: number }
  | { ok: false; error: string };

/**
 * Implements ADR 00-015: Transactional Notifications — the
 * "operator-triggered Restock Notification send ... reads that
 * Variant's Stock Notification List, sends each entry the localized
 * Restock Notification ... in the Locale stored in its consent
 * record, and **deletes each successfully sent address**. Send-and-
 * clear is the deletion mechanism completing ADR 00-010's retention
 * rule ... Failed sends keep their entries so the action is
 * retryable; the action reports per-Variant sent/failed counts.
 * Captured emails are never logged."
 *
 * `HGETALL stock-notifications:<variantId>` — the product link is
 * `<canonical>/<locale>/checkout`, the working purchase URL today;
 * the ADR 00-011 `product/<slug>` redirect keeps it valid when routes
 * migrate. Fail-closed on both dependencies: an unconfigured store or
 * delivery channel reports an error rather than a send it did not
 * perform. One send per list entry — a solicited single-purpose
 * notification, never marketing (ADR 00-013's transactional-only
 * constraint).
 *
 * @param variantId - The Variant whose list is notified; must name a
 *   real Product Data Variant.
 * @returns `{ok: true, sent, failed}` with per-entry counts;
 *   `{ok: false, error}` when the Variant is unknown, a dependency is
 *   unconfigured, or the list read fails.
 */
export async function sendRestockNotifications(
  variantId: string
): Promise<NotifyResult> {
  const variant = findVariant(variantId);
  if (!variant) {
    return { ok: false, error: 'Unknown variant' };
  }

  const store = getManagedStore();
  if (!store) {
    return { ok: false, error: 'Store not configured' };
  }
  const emailConfig = getEmailConfig();
  if (!emailConfig) {
    return { ok: false, error: 'Email delivery not configured' };
  }

  // Implements ADR 00-013: Email Delivery Channel — the Restock
  // Notification's copy is "operator-editable Site Config data": one
  // config read per run feeds the whole `emails` group into every
  // entry's builder (the send kind's fields plus the shared
  // header/footer); a failed read fails open to the in-repo defaults
  // inside `getSiteConfig`.
  const emails = (await getSiteConfig()).emails;

  const key = stockNotificationKey(variantId);
  let entries: Record<string, unknown>;
  try {
    // The SDK auto-deserializes HASH values — entries arrive as
    // objects or JSON strings; `parseRecord` narrows either way.
    entries = (await store.hgetall<Record<string, unknown>>(key)) ?? {};
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown read error';
    return { ok: false, error: message };
  }

  let sent = 0;
  let failed = 0;
  for (const [email, value] of Object.entries(entries)) {
    // The consent record's Locale drives the template's language —
    // an unreadable record falls back to the Primary Locale (ADR
    // 00-005), never blocking the send.
    const record = parseRecord(value);
    const locale: Locale =
      record && (locales as readonly string[]).includes(record.locale)
        ? (record.locale as Locale)
        : defaultLocale;

    const delivered = await sendEmail({
      to: email,
      replyTo: emailConfig.supportInbox,
      ...restockEmail(
        locale,
        {
          productName: PRODUCT.name,
          variantLabel: variantLabel(variant),
          productUrl: `${SITE_CONFIG.url}/${locale}/checkout`,
        },
        emails
      ),
    });

    if (delivered) {
      // Send-and-clear (ADR 00-015): `HDEL` this field only — sibling
      // entries are untouched, and failures keep their entries for
      // retry. An `HDEL` failure leaves the entry for retry (a
      // possible duplicate send on the next run — bounded, and the
      // send itself already happened).
      try {
        await store.hdel(key, email);
      } catch (error) {
        console.error(
          `[admin] restock HDEL failed for ${variantId}:`,
          error
        );
      }
      sent += 1;
    } else {
      failed += 1;
    }
  }

  revalidatePath('/admin');
  return { ok: true, sent, failed };
}
