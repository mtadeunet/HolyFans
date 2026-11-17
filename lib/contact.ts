import {
  isValidEmail,
  STOCK_NOTIFICATION_EMAIL_MAX_LENGTH,
} from '@/lib/stock-notification';

/**
 * Implements ADR 00-014: Contact Channel — "strict validation (email
 * shape and length bound, a Locale that must be supported, a honeypot
 * that must be empty)" and "input caps on body size and field lengths".
 *
 * Pure, side-effect-free narrowing of the contact Route Handler's POST
 * body — the same route-vs-logic split as `lib/stock-notification.ts`:
 * no Redis or framework imports so the module stays unit-testable in
 * Node. Nothing parsed here is persisted or logged by callers (the
 * delivered email is the record, ADR 00-014 / ADR 00-008).
 */

/**
 * Field caps (ADR 00-014: "input caps on ... field lengths"): the
 * visitor's name and subject are optional single-line fields — both
 * feed the relay email's header lines (the subject becomes its Subject
 * header), so a `\r`/`\n` is rejected outright rather than folded; the
 * message is the free-text body; the email carries the RFC 5321 path
 * bound shared with the stock-notification capture.
 */
export const CONTACT_NAME_MAX_LENGTH = 120;
export const CONTACT_EMAIL_MAX_LENGTH = STOCK_NOTIFICATION_EMAIL_MAX_LENGTH;
export const CONTACT_SUBJECT_MAX_LENGTH = 150;
export const CONTACT_MESSAGE_MAX_LENGTH = 4000;

/**
 * The validated body of a contact POST: the visitor's name (optional),
 * their email (required — it is the reply path), an optional subject,
 * the message, and their supported Locale — the fields ADR 00-014
 * enumerates. Optional fields arrive as `undefined` rather than empty
 * strings so the relay template can apply its own defaults.
 */
export interface ContactSubmission {
  /** The visitor's display name, or `undefined` when left blank. */
  name?: string;
  /** Normalized (trimmed, lowercased) visitor email — the `Reply-To`
   *  of the relay; never logged or persisted. */
  email: string;
  /** The visitor's subject line, or `undefined` when left blank. */
  subject?: string;
  /** The message body, trimmed. */
  message: string;
  /** The visitor's supported Locale — relayed so the operator can
   *  reply in kind (ADR 00-014 / ADR 00-005). */
  locale: string;
}

/**
 * The tagged outcome of `parseContactBody`: `'ok'` carries the
 * submission; `'honeypot'` marks a filled trap field the route
 * acknowledges silently (a fake success so bots learn nothing);
 * `'invalid'` marks malformed input the route rejects.
 */
export type ContactParseResult =
  | { kind: 'ok'; submission: ContactSubmission }
  | { kind: 'honeypot' }
  | { kind: 'invalid' };

/**
 * Normalize an optional single-line field: trimmed, capped at `max`,
 * `undefined` when empty after trimming.
 *
 * The single-line contract: `name` and `subject` land in the relay
 * email's header lines — a visitor-supplied `\r`/`\n` would inject a
 * line into the Subject header, so it is malformed input (`null`),
 * not content to sanitize.
 *
 * @param value - The raw field value (already type-checked as string).
 * @param max - The field's length cap.
 * @returns The normalized value, `undefined` when blank, or `null`
 *   when the value exceeds the cap or carries a line break (malformed
 *   input).
 */
function optionalField(
  value: string,
  max: number
): string | undefined | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (/[\r\n]/.test(trimmed)) {
    return null;
  }
  return trimmed.length <= max ? trimmed : null;
}

/**
 * Narrow parsed JSON to the contact body shape.
 *
 * Validation rules (ADR 00-014): `email` required, within
 * `CONTACT_EMAIL_MAX_LENGTH`, matching `isValidEmail` (normalized to
 * trim + lowercase so the `Reply-To` is canonical); `name` and
 * `subject` optional within their caps; `message` required and
 * non-blank within `CONTACT_MESSAGE_MAX_LENGTH`; `locale` membership
 * checked against the caller-supplied supported set (the list lives
 * with the caller so this module stays framework-free — the same
 * split as the stock-notification parser); the `website` honeypot —
 * "a honeypot field invisible to humans" — must be absent or empty,
 * and a filled trap is reported as its own tagged kind so the route
 * can answer a silent success.
 *
 * @param body - `JSON.parse` output (untrusted).
 * @param supportedLocales - The supported Locale set (`locales` from
 *   `lib/i18n.ts`, passed in so this module stays pure).
 * @returns The tagged parse outcome.
 */
export function parseContactBody(
  body: unknown,
  supportedLocales: readonly string[]
): ContactParseResult {
  if (typeof body !== 'object' || body === null) {
    return { kind: 'invalid' };
  }
  const candidate = body as Record<string, unknown>;

  // Honeypot (ADR 00-014): humans never see or fill `website`; a
  // non-empty value marks a bot — the route answers `{ok: true}` so
  // the trap reveals nothing about what it caught.
  if (
    typeof candidate.website === 'string' &&
    candidate.website.trim().length > 0
  ) {
    return { kind: 'honeypot' };
  }

  if (typeof candidate.email !== 'string') {
    return { kind: 'invalid' };
  }
  const email = candidate.email.trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > CONTACT_EMAIL_MAX_LENGTH ||
    !isValidEmail(email)
  ) {
    return { kind: 'invalid' };
  }

  // Optional fields must be absent-or-string; a present non-string or
  // an over-cap value is malformed, not blank.
  if (
    candidate.name !== undefined &&
    typeof candidate.name !== 'string'
  ) {
    return { kind: 'invalid' };
  }
  const name =
    typeof candidate.name === 'string'
      ? optionalField(candidate.name, CONTACT_NAME_MAX_LENGTH)
      : undefined;
  if (name === null) {
    return { kind: 'invalid' };
  }

  if (
    candidate.subject !== undefined &&
    typeof candidate.subject !== 'string'
  ) {
    return { kind: 'invalid' };
  }
  const subject =
    typeof candidate.subject === 'string'
      ? optionalField(candidate.subject, CONTACT_SUBJECT_MAX_LENGTH)
      : undefined;
  if (subject === null) {
    return { kind: 'invalid' };
  }

  if (typeof candidate.message !== 'string') {
    return { kind: 'invalid' };
  }
  const message = candidate.message.trim();
  if (
    message.length === 0 ||
    message.length > CONTACT_MESSAGE_MAX_LENGTH
  ) {
    return { kind: 'invalid' };
  }

  // "a Locale that must be supported" (ADR 00-014): membership in the
  // supported set is enforced here against the caller's list.
  if (
    typeof candidate.locale !== 'string' ||
    !supportedLocales.includes(candidate.locale)
  ) {
    return { kind: 'invalid' };
  }

  return {
    kind: 'ok',
    submission: {
      name,
      email,
      subject,
      message,
      locale: candidate.locale,
    },
  };
}
