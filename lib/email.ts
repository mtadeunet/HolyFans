/**
 * Implements ADR 00-013: Email Delivery Channel — "Outbound email is
 * sent through the Transactional Email Provider (Zoho CPaaS /
 * ZeptoMail) ... outbound-only: server-side code calls the provider's
 * send API over HTTPS; nothing is received, stored, or brokered."
 *
 * The delivery channel's lazy, fail-closed client — the same posture
 * as `lib/managed-store.ts`: `getEmailConfig()` returns `null` when
 * the channel is unconfigured so every consumer degrades to its
 * graceful-unavailable state rather than crashing or reporting a send
 * it did not perform. Server-side only: the token never enters a
 * client bundle. Configuration: `ZEPTOMAIL_TOKEN`,
 * `ZEPTOMAIL_API_BASE`, `EMAIL_FROM` (the verified sender identity —
 * the operator's general-information mailbox), `SUPPORT_INBOX` (the
 * Support Inbox — destination for contact relays and the `Reply-To`
 * on customer-facing sends), and `ADMIN_INBOX` (the Admin Inbox —
 * destination for the Operator Order Alert) (ADR 00-007: real values
 * live only in platform env and untracked local files).
 */

/** One resolved delivery-channel configuration. */
export interface EmailConfig {
  /** Provider send endpoint — `ZEPTOMAIL_API_BASE` joined with the
   *  API path. */
  sendUrl: string;
  /** The Mail Agent's Send Mail Token (`Zoho-enczapikey` auth). */
  token: string;
  /** The verified sender identity (`EMAIL_FROM`). */
  from: string;
  /** The Support Inbox (`SUPPORT_INBOX`) — the operator-held support
   *  mailbox that receives Contact Form relays; also the `Reply-To`
   *  on every customer-facing send (ADR 00-013, ADR 00-014). */
  supportInbox: string;
  /** The Admin Inbox (`ADMIN_INBOX`) — the operator-held
   *  administration mailbox that receives the Operator Order Alert
   *  (ADR 00-015). */
  adminInbox: string;
}

/**
 * The payload shape the provider's `/v1.1/email` endpoint accepts —
 * the fields the Storefront uses; `textbody` is always set,
 * `htmlbody` when the template carries HTML.
 */
export interface ZeptoMailPayload {
  from: { address: string };
  to: { email_address: { address: string; name?: string } }[];
  reply_to?: { address: string }[];
  subject: string;
  textbody: string;
  htmlbody?: string;
}

/** One send request through the delivery channel. */
export interface SendEmailInput {
  /** Recipient address — a single destination per send. */
  to: string;
  /** Optional display name on the recipient. */
  toName?: string;
  /** `Reply-To` — the visitor's address on contact relays, the
   *  Support Inbox on outbound notifications. */
  replyTo?: string;
  /** The message subject (template-produced). */
  subject: string;
  /** Plain-text body — always present. */
  text: string;
  /** Optional branded HTML body. */
  html?: string;
}

let config: EmailConfig | null | undefined;

/**
 * Resolve the channel's environment configuration, memoized like the
 * managed-store client so `next build` and unconfigured requests
 * never touch the network.
 *
 * @returns The `EmailConfig`, or `null` when any required variable is
 *   unset/empty — the fail-closed signal every consumer honors.
 */
export function getEmailConfig(): EmailConfig | null {
  if (config === undefined) {
    const token = process.env.ZEPTOMAIL_TOKEN?.trim();
    const apiBase = process.env.ZEPTOMAIL_API_BASE?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    const supportInbox = process.env.SUPPORT_INBOX?.trim();
    const adminInbox = process.env.ADMIN_INBOX?.trim();
    config =
      token && apiBase && from && supportInbox && adminInbox
        ? {
            sendUrl: `${apiBase.replace(/\/+$/, '')}/v1.1/email`,
            token,
            from,
            supportInbox,
            adminInbox,
          }
        : null;
  }
  return config;
}

/**
 * Build the provider request body from a send input — pure and
 * unit-testable; the fetch wrapper carries the transport.
 *
 * @param input - The send request.
 * @param from - The verified sender identity.
 * @returns The provider payload.
 */
export function buildZeptoMailPayload(
  input: SendEmailInput,
  from: string
): ZeptoMailPayload {
  return {
    from: { address: from },
    to: [
      {
        email_address: {
          address: input.to,
          ...(input.toName ? { name: input.toName } : {}),
        },
      },
    ],
    ...(input.replyTo ? { reply_to: [{ address: input.replyTo }] } : {}),
    subject: input.subject,
    textbody: input.text,
    ...(input.html ? { htmlbody: input.html } : {}),
  };
}

/**
 * Send one email through the delivery channel. Never logs message
 * content or recipient addresses — only the failure fact (ADR
 * 00-008's personal-data posture applies to payloads too).
 *
 * @param input - The send request.
 * @returns `true` when the provider accepted the send; `false` when
 *   the channel is unconfigured or the send failed — callers surface
 *   their graceful-unavailable state.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const resolved = getEmailConfig();
  if (!resolved) {
    return false;
  }
  try {
    const response = await fetch(resolved.sendUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${resolved.token}`,
      },
      body: JSON.stringify(buildZeptoMailPayload(input, resolved.from)),
    });
    if (!response.ok) {
      console.error(`[email] provider rejected send: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[email] send failed:', error);
    return false;
  }
}
