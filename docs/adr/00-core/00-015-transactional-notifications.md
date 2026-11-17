# ADR 00-015: Transactional Notifications — PSP-Event Order Emails and the Restock Send

## Status

Proposed

## Related

ADR 00-002 (Rendering and Hosting Model)
ADR 00-004 (Commerce and Checkout)
ADR 00-005 (Internationalization)
ADR 00-007 (Quality Tooling and CI)
ADR 00-008 (Analytics and Consent)
ADR 00-010 (Pre-order and Stock Notification)
ADR 00-011 (Page Model and Product Routes)
ADR 00-013 (Email Delivery Channel)

## Context

Two notification needs now meet a working delivery channel
(ADR 00-013). The first is order lifecycle: the owner wants the
customer to receive a branded thank-you — a blessing in the
brand's voice — after a completed purchase, and wants an
operator-facing purchase notification carrying the order detail
manual Fulfillment needs. ADR 00-004 deliberately kept all payment
lifecycle signals PSP-native and explicitly rejected a webhook
receiver — but that ruling predates this requirement: the PSP's
native receipts and operator alerts cannot carry the brand's
message or the store's order layout. A branded send needs a real
lifecycle signal, and the only correct one for every payment
method — including delayed-confirmation Multibanco references that
settle after the shopper has left — is the PSP's event stream.

The second need closes ADR 00-010's deferred half: the Pre-order
state captures consented emails into the Stock Notification List,
but no send existed. Restock is a manual operator decision — a
Stock Flag flip, a Product Data Availability change, or a new
small run arriving — so the send should be an operator action,
not an automatic reaction to a flag that flips for other reasons
too.

All sends sit inside established boundaries: the delivery channel
is outbound-only per ADR 00-013; personal-data handling follows the
ADR 00-008 consent posture — the Stock Notification List's entries
are used only for the purpose consented to, and retention ends when
the notification is sent or the operator purges; the webhook
receiver is a new enumerated Route Handler, which requires amending
ADR 00-002's boundary and ADR 00-004's no-webhook ruling — both are
amended by this decision.

## Decision

Two transactional notification mechanisms ship on the delivery
channel of ADR 00-013: a **PSP event receiver** that sends the
order-lifecycle emails, and an **operator-triggered Restock
Notification send** in the Admin Console.

- **PSP Event Receiver.** One new enumerated Route Handler joins
  the dynamic surface of ADR 00-002 on the Node runtime: a webhook
  endpoint the PSP calls with signed events. It verifies each
  request's signature against `STRIPE_WEBHOOK_SECRET` (environment
  configuration; unconfigured → the endpoint fails closed), accepts
  exactly two event types, and ignores everything else:
  - `checkout.session.completed` — on a paid outcome it sends both
    order emails; on a pending asynchronous payment (a Multibanco
    reference awaiting settlement) it sends the Operator Order
    Alert marked as awaiting payment and no customer email yet.
  - `checkout.session.async_payment_succeeded` — a delayed method
    has settled: it sends the customer Thank-You Email and, if the
    settled session was not already alerted, the Operator Order
    Alert.
  Sends are deduplicated against the managed store — a
  session-keyed record marks each send kind so the PSP's retries
  can never double-send; the record's retention is bounded well
  beyond the PSP's own redelivery horizon, so retries inside the
  horizon are the only window that matters. The handler does
  bounded work and answers
  quickly; it is hardened to the sibling norm (input caps, and a
  verified signature in place of the rate limit that visitor-facing
  endpoints carry — the signature IS the auth).
- **Thank-You Email.** The customer-facing order email — a branded
  thank-you/blessing in the session's own Locale — sent once per
  paid order to the session's customer email, through the delivery
  channel. It complements, never replaces, the PSP's native receipt
  (which remains the payment record).
- **Operator Order Alert.** The owner-facing notification sent to
  the Operator Inbox: the order's line items, quantities, the
  shipping address and option the customer chose, and the payment
  state — the detail manual Fulfillment needs in one place. It
  supersedes the PSP's native operator alert, which the operator
  disables to avoid duplicate notifications.
- **Capture Acknowledgment.** The stock-notification Route Handler's
  success path sends the visitor a localized acknowledgment — the
  product and Variant identified, the promise that the Restock
  Notification follows — in the submission's own Locale, through the
  delivery channel. It is best-effort by design: the stored list
  entry is the record, the send happens after the store write, and a
  failed acknowledgment never loses or reports against a capture.
- **Restock Notification send.** A new enumerated capability on the
  Admin Console's write path: a per-Variant notify action in the
  Stock Notifications view. It reads that Variant's Stock
  Notification List, sends each entry the localized Restock
  Notification — the product and Variant identified, a link to the
  Product's purchase surface in the recipient's Locale (the route of
  ADR 00-011 as it stands at send time), a why-you-got-this line,
  and the operator identity/legal footer — in the Locale stored in
  its consent record, and **deletes each successfully sent
  address**. Send-and-clear is the deletion mechanism completing
  ADR 00-010's retention rule: the list entry's purpose ends when
  its notification is sent. Failed sends keep their entries so the
  action is retryable; the action reports per-Variant sent/failed
  counts. Captured emails are never logged.
- **Order emails dedupe contract.** Each send kind (`thank-you`,
  `order-alert`) is recorded per Checkout Session in the managed
  store before reporting success; a repeated event for an already
  recorded kind is acknowledged without re-sending. When the
  managed store is unconfigured the endpoint still verifies
  signatures and acknowledges events without sending — degrading
  rather than failing the PSP's delivery (which would otherwise
  retry forever against a broken endpoint).
- **Localization.** The Thank-You Email renders in the Checkout
  Session's Locale; the Capture Acknowledgment renders in the
  submission's Locale; the Restock Notification renders per consent
  record; the Operator Order Alert renders in the Primary Locale —
  its audience is the operator.
- **Marketing stays out.** No marketing or promotional send is part
  of this decision — ADR 00-013's transactional-only constraint;
  a promotions list requires a future provider decision.

## Consequences

**Positive:**
- The brand's voice reaches the customer at the exact moment money
  settles — immediate methods and delayed-confirmation Multibanco
  alike — something the PSP's generic receipts cannot do.
- The Operator Order Alert puts the full fulfillment picture
  (items, quantities, shipping) in one email instead of dashboard
  archaeology.
- The webhook is the architecturally correct signal: one endpoint
  covers every payment method's lifecycle — no polling, no missed
  async settlement, no render-time side effects.
- Signature verification gives the receiver stronger auth than the
  visitor-facing endpoints' rate limits — only the PSP can trigger
  a send.
- The restock send completes ADR 00-010's promise mechanically:
  send-and-clear IS the retention mechanism — the purpose ends
  exactly when the consented notification lands.
- Operator-triggered sends stay deliberate: no automatic email
  fires from a flag flip; the operator decides when a restock is
  real.
- Both mechanisms reuse the existing delivery channel and managed
  store — no new platform, no new store, two enumerated additions
  to the dynamic surface.

**Negative / trade-offs:**
- The enumerated boundary grows by two: the webhook receiver and
  the Admin Console send action — the corpus's tightest invariant
  is loosened, amended deliberately rather than silently.
- ADR 00-004's explicit no-webhook ruling is reversed: the record
  now shows the requirement changed (branded lifecycle email), not
  that the original reasoning was wrong — readers must see that
  distinction.
- A public webhook endpoint is a new attack surface: signature
  verification bounds it, but a misconfigured or leaked secret
  admits forged "payment" events that send real emails — the
  secret's hygiene is load-bearing.
- Webhook delivery is eventual: PSP retries, endpoint errors, or
  clock skew can delay or drop emails; the dedupe record handles
  retries but a permanently failing endpoint needs operator
  attention (the PSP surfaces delivery failures in its dashboard).
- The order emails carry real customer data (name, address) through
  the provider — acceptable within the transactional posture but a
  wider personal-data surface than the store has had.
- The Operator Order Alert duplicates part of the PSP's native
  notification by design; the operator must actually disable the
  native alert or live with two emails per order.

## Alternatives Considered

- **Send order emails from the success page's session-status read**
  — Rejected: it makes a page render a side-effecting mutation
  (ADR 00-002 enumerates that read as mutating nothing), it
  dedupes awkwardly against refreshes, and — fatally — it cannot
  cover delayed-confirmation methods: the shopper has left before
  a Multibanco reference settles, so the thank-you would never
  fire for an entire payment segment.
- **Keep everything PSP-native (Stripe receipts + operator emails)**
  — Rejected for the requirement as stated: native emails cannot
  carry the brand's message or the order layout fulfillment needs;
  acceptable only if the branded sends are dropped — the owner
  ruled otherwise.
- **Scheduled polling of the PSP for completed sessions** —
  Rejected: a cron adds latency and a second runtime dependency to
  reconstruct a signal the PSP pushes for free; worse latency AND
  worse architecture.
- **Automatic restock send on Stock Flag or Availability change**
  — Rejected: flags flip for presentation reasons too; an email to
  a captured list is a real-world promise that must be a deliberate
  operator act, not a side effect of a toggle.
- **Send-then-delete-all vs send-and-clear-per-address** — The
  per-address clear was chosen: a partial failure keeps only the
  unsent entries for retry; clearing the whole list on any failure
  would silently lose consent records the send never reached.
- **Unsubscribe machinery on the restock email** — Rejected as
  unnecessary: this is a solicited single-purpose notification —
  the recipient asked for exactly this email — so the legal footer
  and purpose statement suffice; a marketing-grade unsubscribe is
  a different feature's obligation.
