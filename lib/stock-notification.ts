import { findVariant } from '@/lib/constants';

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "Captured
 * emails persist in the same managed Redis store provisioned through
 * the Hosting Platform's marketplace for like counts (ADR 00-002) ...
 * in a dedicated keyspace scoped per Variant, never joined to the like
 * dedup records, the anonymous Like Token, or any analytics surface.
 * Repeat submissions of the same email for the same Variant dedupe
 * naturally; the list is an operator-held record the operator can
 * export and clear."
 *
 * Pure, side-effect-free helpers shared by the stock-notification Route
 * Handler, the Admin Console's Stock Notifications view, and unit
 * tests: the managed-store key convention, the consent record shape,
 * and narrowing validation of the capture body. No Redis or framework
 * imports so the module stays testable in Node (the same
 * route-vs-logic split as `lib/likes.ts` and
 * `lib/checkout-validation.ts`).
 */

/**
 * Maximum accepted email length — the RFC 5321 path bound; the
 * stock-notification Route Handler applies it as an input cap (ADR
 * 00-010: "email shape and length bound").
 */
export const STOCK_NOTIFICATION_EMAIL_MAX_LENGTH = 254;

/**
 * Redis key holding one Variant's Stock Notification List: a HASH whose
 * fields are normalized visitor emails and whose values are the JSON
 * `StockNotificationRecord` captured at consent time. Hash-field
 * uniqueness is what makes repeat submissions of the same email for
 * the same Variant dedupe naturally (ADR 00-010); `HGETALL` is the
 * operator's export path and `DEL` the purge path.
 *
 * @param variantId - A real Product Data Variant id (validated
 *   upstream — arbitrary strings would mint unmanaged keys).
 * @returns The per-Variant key, in the `likes:<postId>` convention.
 */
export function stockNotificationKey(variantId: string): string {
  return `stock-notifications:${variantId}`;
}

/**
 * The consent record stored as the HASH value for each captured email.
 * Persisting when the consent was given and in which Locale the consent
 * statement was rendered satisfies the ADR 00-008 posture that
 * collection be "consented, purpose-bound" — the record is the only
 * evidence retained, and it joins to no token or analytics surface.
 */
export interface StockNotificationRecord {
  /** ISO timestamp of the accepted capture. */
  consentedAt: string;
  /** The Locale the consent statement was rendered in (`pt` | `en`). */
  locale: string;
}

/**
 * The validated body of a stock-notification POST: the visitor's email
 * (normalized to lowercase for dedup), their Locale, and the Variant
 * the capture was scoped to — the three fields ADR 00-010 enumerates.
 */
export interface StockNotificationBody {
  /** Normalized (trimmed, lowercased) visitor email — never logged. */
  email: string;
  /** The visitor's Locale, validated against the supported set by the
   *  caller (kept a `string` here so this module stays framework-free). */
  locale: string;
  /** A real Product Data Variant id the capture is scoped to. */
  variantId: string;
}

/**
 * Pragmatic email-shape check (ADR 00-010: "email shape ... bound").
 * Rejects whitespace, missing/doubled `@`, and a missing TLD dot —
 * the honest bound for a notification list without claiming RFC
 * completeness; the length cap applies separately.
 *
 * @param email - Candidate address (already trimmed/lowercased).
 * @returns `true` when the shape is acceptable.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Narrow parsed JSON to the stock-notification body shape.
 *
 * Validation rules: `email` a string within
 * `STOCK_NOTIFICATION_EMAIL_MAX_LENGTH` matching `isValidEmail`;
 * `locale` a non-empty string within a sane bound (membership in the
 * supported set is checked by the caller, which owns the Locale list);
 * `variantId` a string naming a real Product Data Variant — "a Variant
 * identifier that must name a real Product Data Variant" (ADR 00-010).
 * The email is normalized (trim + lowercase) so repeat submissions
 * dedupe on the HASH field.
 *
 * @param body - `JSON.parse` output (untrusted).
 * @returns The typed body, or `null` when any field is malformed.
 */
export function parseStockNotificationBody(
  body: unknown
): StockNotificationBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const candidate = body as Record<string, unknown>;

  if (typeof candidate.email !== 'string') {
    return null;
  }
  const email = candidate.email.trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > STOCK_NOTIFICATION_EMAIL_MAX_LENGTH ||
    !isValidEmail(email)
  ) {
    return null;
  }

  if (
    typeof candidate.locale !== 'string' ||
    candidate.locale.length === 0 ||
    candidate.locale.length > 16
  ) {
    return null;
  }

  if (
    typeof candidate.variantId !== 'string' ||
    findVariant(candidate.variantId) === undefined
  ) {
    return null;
  }

  return {
    email,
    locale: candidate.locale,
    variantId: candidate.variantId,
  };
}
