# Email Channel Implementation Plan — Contact Form, Order Emails, Restock Send

Implements ADR 00-013 (Email Delivery Channel), ADR 00-014 (Contact
Channel), ADR 00-015 (Transactional Notifications) with amendments to
ADR 00-002, 00-004, 00-008, 00-009, 00-010, 00-011.

## Scope

Three features on one shared delivery channel:

1. **Delivery channel (ADR 00-013)** — lazy fail-closed ZeptoMail REST
   client + localized in-repo email templates.
2. **Contact channel (ADR 00-014)** — `/<locale>/contact` Contact Page
   inside the Feed Shell + `/api/contact` relay handler.
3. **Transactional notifications (ADR 00-015)** — signature-verified
   PSP event receiver (customer Thank-You + Operator Order Alert) and
   the Admin Console's per-Variant Restock Notification send-and-clear.

Out of scope: marketing/promotion emails (deferred per ADR 00-013),
auto-acknowledgment to contact submitters (deferred per ADR 00-014),
WhatsApp surface removal (config-off only — code stays dormant).

## New env vars

`ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_API_BASE`, `EMAIL_FROM`,
`SUPPORT_INBOX`, `ADMIN_INBOX`, `STRIPE_WEBHOOK_SECRET` —
`.env.example` documents
all; real values live in `.env.local` / Vercel env (ADR 00-007).

## Build order

### 1. Delivery channel

- `lib/email.ts` — `getEmailConfig()` (lazy fail-closed env read),
  `buildZeptoMailPayload()` pure builder, `sendEmail()` thin fetch
  wrapper → `Promise<boolean>`. Node-only; never in client bundles.
- `lib/email-templates.ts` — pure localized template builders
  returning `{subject, text, html}`: `contactRelay`, `thankYou`,
  `orderAlert`, `restockNotification`. Plain text + light branded
  HTML shell.

### 2. Contact channel

- `app/[locale]/contact/page.tsx` — server page, `force-dynamic`,
  renders `FeedShell` (`returnToFeed`) with the contact panel as the
  Feed Surface occupant.
- `components/sections/contact-form.tsx` — client Island: name,
  email, optional subject, message, hidden `website` honeypot,
  consent line; states idle → sending → sent | unavailable.
- `app/api/contact/route.ts` — Node handler: 4 KB body cap, per-IP
  rate limit (5/min shared window), `parseContactBody` (pure,
  `lib/contact.ts`), honeypot → silent 200, unconfigured provider →
  503 graceful. Success → one `sendEmail` to `SUPPORT_INBOX`,
  `replyTo` = visitor. Nothing persisted or logged.
- `components/feed/nav-entries.tsx` — `contact` entry → internal
  `/<locale>/contact`, always rendered; WhatsApp deep-link entry
  removed; envelope icon replaces the WhatsApp glyph.
- `components/layout/chrome-frame.tsx` — `SHELL_ROUTES` gains
  `/contact` (header/footer stay suppressed on the shell route).
- `messages/{en,pt}.json` — `contact.*` strings.

### 3. PSP event receiver

- `app/api/webhooks/stripe/route.ts` — `force-dynamic`, Node runtime.
  Raw-body read → `constructEventAsync` signature check against
  `STRIPE_WEBHOOK_SECRET`; unconfigured → 503 fail-closed; bad
  signature → 400. Accepts `checkout.session.completed` and
  `checkout.session.async_payment_succeeded`, acknowledges all else.
- Dedupe via managed store: `SET email-sent:<sessionId>:<kind> 1 NX`
  per send kind (`thank-you`, `order-alert`); store unconfigured →
  acknowledge without sending (degrade, don't fail PSP retries).
- `completed` + `payment_status === 'paid'` → Thank-You + Order
  Alert; unpaid → Order Alert only (marked awaiting payment).
  `async_payment_succeeded` → Thank-You + Order Alert.
- Order Alert content: session line items (retrieve w/ expand),
  totals, shipping name/address/option, payment state.

### 4. Restock send (Admin Console)

- `app/admin/actions.ts` — `sendRestockNotifications(variantId)`:
  validates Variant + store + email config; `HGETALL` the Variant
  keyspace; per entry send `restockNotification` in the consent
  record's Locale (fallback `pt`), `HDEL` the field on success;
  returns `{ok, sent, failed}`.
- `app/admin/notify-list-button.tsx` + wire into
  `stock-notifications-section.tsx` beside `ClearListButton` —
  confirm dialog reports sent/failed inline.
- Product link in the email: `<canonical>/<locale>/checkout` — the
  only live purchase URL today (no `product/<slug>` route exists
  yet); ADR 00-015's wording is "the Product's purchase surface in
  the recipient's Locale", which `/checkout` satisfies while it is
  the surface. When `product/<slug>` ships (ADR 00-011), update the
  URL builder — the `/checkout` redirect keeps already-sent links
  alive until the single-product redirect is retired.

### 5. Tests

- `tests/unit/email.test.ts` — fail-closed config, payload builder.
- `tests/unit/contact.test.ts` — `parseContactBody` bounds.
- `tests/unit/email-templates.test.ts` — per-Locale subjects/body.
- e2e: contact page reachable via nav, happy-path form states
  (mocked transport), unavailable state.

## Verification

`npm run type-check`, `npm run lint`, `npm run test`,
`npm run test:e2e` (targeted specs), `npm run build`.

## Manual/ops checklist

ZeptoMail domain verified + Mail Agent token; Stripe webhook
registered for the two events; env vars in Vercel; Stripe native
operator alert disabled.
