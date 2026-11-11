/**
 * Implements ADR 00-009: WhatsApp Deep-Link Channels — Client-Resolved
 * Vendor Deep Links for Customer Messaging - "the vendor's published
 * click-to-chat / share deep-link mechanism, resolved entirely
 * client-side".
 *
 * Pure, dependency-free builders for the vendor's deep links. The
 * Storefront only constructs URLs; the visitor's device opens them — no
 * server-side messaging, no inbound channel, no third-party script.
 */

/** Origin of the vendor's click-to-chat / share deep-link mechanism. */
const WHATSAPP_DEEP_LINK_BASE = 'https://wa.me';

/**
 * Implements ADR 00-009: WhatsApp Deep-Link Channels — Client-Resolved
 * Vendor Deep Links for Customer Messaging - "a persistent floating
 * control on every Storefront page opens a chat addressed to the Store
 * Messaging Number ... When no Store Messaging Number is configured, the
 * surface renders nothing — it fails closed".
 *
 * Build a click-to-chat deep link addressed to `phoneNumber` with
 * `message` preloaded into the visitor's chat composer. The number is
 * normalized to digits-only (the vendor's required format), defensively
 * stripping `+`, whitespace, and punctuation from operator-supplied
 * configuration.
 *
 * @param phoneNumber - Store Messaging Number in any common format; only
 *   the digits are used.
 * @param message - Text preloaded into the chat; URI-encoded into the
 *   `text` query parameter.
 * @returns The `https://wa.me/<digits>?text=<encoded>` deep link, or
 *   `null` when the normalized number is empty so callers can fail
 *   closed.
 */
export function whatsappChatUrl(
  phoneNumber: string,
  message: string
): string | null {
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return `${WHATSAPP_DEEP_LINK_BASE}/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Implements ADR 00-009: WhatsApp Deep-Link Channels — Client-Resolved
 * Vendor Deep Links for Customer Messaging - "a control on the canonical
 * purchase block lets a visitor compose a message containing the
 * Storefront's canonical URL".
 *
 * Build a share deep link that opens the vendor's composer with `text`
 * preloaded and no fixed recipient — the visitor picks their own
 * contacts.
 *
 * @param text - Message text (translated share copy plus the canonical
 *   store URL); URI-encoded into the `text` query parameter.
 * @returns The `https://wa.me/?text=<encoded>` share deep link.
 */
export function whatsappShareUrl(text: string): string {
  return `${WHATSAPP_DEEP_LINK_BASE}/?text=${encodeURIComponent(text)}`;
}
