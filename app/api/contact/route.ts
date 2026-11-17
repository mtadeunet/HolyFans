import { NextRequest, NextResponse } from 'next/server';
import { allowRequest, clientIp, readCappedJson } from '@/lib/api-guard';
import { parseContactBody } from '@/lib/contact';
import { getEmailConfig, sendEmail } from '@/lib/email';
import { contactRelay } from '@/lib/email-templates';
import { locales } from '@/lib/i18n';

/**
 * Implements ADR 00-002: Rendering and Hosting Model — "One new Route
 * Handler joins the enumerated dynamic surface ... on the Node
 * runtime" (ADR 00-014): the contact Route Handler relaying the
 * Contact Form to the Operator Inbox through the delivery channel of
 * ADR 00-013. This handler is part of the enumerated dynamic surface;
 * no other request-time endpoints may be added without a new ADR.
 */
export const runtime = 'nodejs';

/**
 * Request-body cap (~4 KB): the payload is a small JSON object
 * (`name`, `email`, `subject`, `message`, `locale`, `website`) —
 * anything larger is abuse input.
 */
const MAX_BODY_BYTES = 4 * 1024;

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "each must be
 * hardened (input caps, rate limiting, fail-closed auth)".
 *
 * Basic in-memory rate limit, same approach as the sibling Route
 * Handlers: at most `RATE_LIMIT` contact POSTs per client IP per the
 * shared rate window (`lib/api-guard.ts`). Per-instance state — on a
 * serverless fleet each instance enforces its own window, which is
 * the accepted bound the ADR notes; throttled requests surface to the
 * form as the graceful unavailable state.
 */
const RATE_LIMIT = 5;
const requestLog = new Map<string, number[]>();

/**
 * Implements ADR 00-014: Contact Channel — "On success it performs
 * exactly one send through the delivery channel: the message body and
 * the visitor's name and address to the Operator Inbox, with
 * `Reply-To` set to the visitor's email so the operator answers by
 * replying. The submitted content is never logged and never written
 * to the managed store — the delivered email in the Operator Inbox is
 * the record."
 *
 * Gate posture (ADR 00-014): "it is NOT behind the Purchase-Surface
 * Gate and must work pre-launch" — unlike the checkout and
 * stock-notification handlers, no `isPurchaseSurfaceEnabled` check
 * gates this endpoint.
 *
 * Error contract (consumed by `components/sections/contact-form.tsx`):
 * - `400 {error: 'invalid_request'}` — malformed/oversized body, bad
 *   email shape, over-cap fields, or an unsupported Locale.
 * - `429 {error: 'contact_unavailable'}` — rate-limited.
 * - `503 {error: 'contact_unavailable'}` — delivery channel
 *   unconfigured (fail-closed, never a fake success).
 * - `502 {error: 'contact_unavailable'}` — the provider rejected the
 *   send.
 *   A filled honeypot answers `{ok: true}` — the silent success the
 *   trap requires (ADR 00-014: "a honeypot that must be empty").
 *
 * @param request - The POST request.
 * @returns `{ok: true}` once the relay is accepted by the provider.
 */
export async function POST(request: NextRequest) {
  if (!allowRequest(clientIp(request), requestLog, RATE_LIMIT)) {
    return NextResponse.json(
      { error: 'contact_unavailable' },
      { status: 429 }
    );
  }

  // Input cap: reject oversized bodies before parsing.
  const parsed = await readCappedJson(request, MAX_BODY_BYTES);
  if (parsed === null) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const result = parseContactBody(parsed, locales);

  // Honeypot hit (ADR 00-014): acknowledge silently — the form's
  // success state reveals nothing about what the trap caught, and no
  // send is attempted.
  if (result.kind === 'honeypot') {
    return NextResponse.json({ ok: true });
  }
  if (result.kind === 'invalid') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const submission = result.submission;

  // Fail-closed (ADR 00-013): with no delivery channel configured the
  // relay cannot happen — answer the graceful unavailable state and
  // never report a send that did not occur.
  const config = getEmailConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'contact_unavailable' },
      { status: 503 }
    );
  }

  // Exactly one send (ADR 00-014): visitor content to the Operator
  // Inbox, Reply-To set to the visitor's address.
  const sent = await sendEmail({
    to: config.operatorInbox,
    replyTo: submission.email,
    ...contactRelay({
      name: submission.name ?? '',
      email: submission.email,
      subject: submission.subject,
      message: submission.message,
      locale: submission.locale,
    }),
  });
  if (!sent) {
    return NextResponse.json(
      { error: 'contact_unavailable' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
