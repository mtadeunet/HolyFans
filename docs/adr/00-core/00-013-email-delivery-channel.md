# ADR 00-013: Email Delivery Channel — Transactional Sending via the Operator's Mailbox Vendor

## Status

Proposed

## Related

ADR 00-002 (Rendering and Hosting Model)
ADR 00-004 (Commerce and Checkout)
ADR 00-005 (Internationalization)
ADR 00-007 (Quality Tooling and CI)
ADR 00-008 (Analytics and Consent)
ADR 00-010 (Pre-order and Stock Notification)
ADR 00-014 (Contact Channel)
ADR 00-015 (Transactional Notifications)

## Context

The Storefront needs outbound email for three purposes: relaying
Contact Form messages to the operator (ADR 00-014), delivering the
order-lifecycle emails decided in ADR 00-015 (the customer thank-you
and the Operator Order Alert), and sending the Restock Notification
to the Stock Notification List — the send ADR 00-010 explicitly
deferred pending a provider choice.

The operator already runs mailboxes on the Store Domain with Zoho
Mail (EU data center); replies to app-sent mail and inbound customer
mail belong in that mailbox. The architecture constrains the shape
of any solution: ADR 00-002 confines request-time compute to an
enumerated dynamic surface and forecloses inbound channels, so the
delivery channel must be outbound-only — API calls made from Route
Handlers and the Admin Console's write paths. ADR 00-007 forbids
real-world identifiers and secrets in tracked files, so the token,
sender identity, and destination mailbox are all environment
configuration. ADR 00-008's consent posture applies to the personal
data the sends touch. The mailbox provider's own SMTP is ruled out
for programmatic sending: its usage terms prohibit bulk, burst, and
automated sends, its per-hour limits are reputation-shaped and small,
its credentials are mailbox passwords or app-passwords, and mixing
application traffic with the human mailbox endangers the mailbox's
deliverability and the account itself.

The provider must also be honest about scope: the chosen service is
transactional-only — its terms prohibit marketing and promotional
sends — so a marketing or promotions list is out of this decision's
reach entirely.

## Decision

Outbound email is sent through the **Transactional Email Provider —
Zoho CPaaS (ZeptoMail)**, the transactional sending service of the
operator's existing mailbox vendor. The channel is outbound-only:
server-side code calls the provider's send API over HTTPS; nothing
is received, stored, or brokered by the provider on the Storefront's
behalf.

- **Division of labor.** The provider carries every send the
  Storefront originates — the Contact Form relay, the customer
  Thank-You Email, the Operator Order Alert, and the Restock
  Notification. The operator's Zoho mailbox on the Store Domain
  remains the read-and-reply side: every app-sent message carries a
  `Reply-To` of either the visitor's address (contact relays) or the
  **Support Inbox** (customer-facing notifications), so replies land
  where the operator already works. The provider is a pipe, not a
  mailbox.
- **Sending identity.** Sends authenticate with a provider-issued
  API token and originate from an operator-owned address on a domain
  verified with the provider — `EMAIL_FROM` environment
  configuration. The domain's verification records (DKIM, and any
  SPF/bounce records the provider requires) are added to the Store
  Domain's DNS alongside the existing mailbox records; a single
  merged `v=spf1` policy is maintained — a domain may carry only
  one SPF record, so the provider's include is merged into the
  existing record rather than added as a second one.
- **Configuration and fail-closed posture.** Four environment
  variables configure the channel: `ZEPTOMAIL_TOKEN` (server-only
  secret), `ZEPTOMAIL_API_BASE` (the account's data-center API
  endpoint), `EMAIL_FROM` (the verified sender identity — the
  operator's general-information mailbox), `SUPPORT_INBOX` (the
  destination for contact relays and the `Reply-To` on
  customer-facing sends), and `ADMIN_INBOX` (the destination for
  the Operator Order Alert). Real values live only in platform
  environment configuration and untracked local env files
  (identifier hygiene, ADR 00-007). The client is lazy and
  fail-closed like the managed-store client: unconfigured → every
  dependent surface degrades to its graceful-unavailable state and
  no send is attempted.
- **Placement.** The delivery client lives server-side only —
  Route Handlers and the Admin Console's server-side write paths on
  the Node runtime. It never enters a client bundle; the visitor
  surface only ever sees the success or unavailable state.
- **Templates.** Every send's content is an in-repo, localized
  template (both Locales, ADR 00-005): plain text with light branded
  HTML, no external template service, no provider-side template
  storage. Recipient-visible strings render in the recipient's
  Locale — the visitor's submitted Locale for contact
  acknowledgments, the Checkout Session's Locale for the Thank-You
  Email, and the Locale stored in each consent record for the
  Restock Notification.
- **Transactional-only scope — hard constraint.** The provider's
  terms prohibit marketing and promotional sends. No marketing,
  promotional, or newsletter email is sent under this decision; a
  subscriber list or promotion-announcement capability requires a
  future ADR choosing a marketing-capable mechanism.
- **Outbound only.** No inbound email channel, no delivery, bounce,
  or complaint webhooks — the enumerated-boundary posture of
  ADR 00-002 is preserved. Bounce, complaint, and delivery health
  monitoring is an operator responsibility through the provider's
  console.

## Consequences

**Positive:**
- One provider covers every transactional need — contact relay,
  order lifecycle, and restock — behind a single env-configured
  client, keeping the code-side surface small and uniform.
- The operator stays inside the vendor they already operate: the
  mailbox, the sender domain, and billing live under one account,
  and paid Zoho Mail plans may bundle provider credits.
- Verified-domain sends with Reply-To routing keep the brand's
  sender identity coherent while replies flow into the operator's
  existing mailboxes — no new mailbox, no forwarding rules.
- Effectively free at the Storefront's volume (a no-cost first
  credit at launch scale) and EU data-center endpoints match the
  primary market.
- Fail-closed by construction: an unconfigured deployment degrades
  every email-dependent surface gracefully rather than erroring.
- Purely outbound HTTPS calls preserve ADR 00-002's enumerated
  dynamic surface — no inbound channel, no new request-time
  capability beyond the enumerated senders.

**Negative / trade-offs:**
- Transactional-only by contract: the promotions/marketing email
  the owner wants eventually cannot ride this pipe — it is deferred
  to a future provider decision, recorded here so the constraint is
  never discovered mid-implementation.
- Bounce, complaint, and suppression handling are invisible to the
  Storefront: repeated hard bounces silently degrade the sender
  reputation unless the operator watches the provider console.
- The send is a live external dependency for the contact and
  notification paths; a provider outage surfaces as the
  unavailable state (bounded by fail-closed design, not eliminated).
- Sender-domain verification is an out-of-band DNS step the code
  cannot perform or check; an unverified or misconfigured domain
  fails at send time, not at build time.
- A second outbound credential (`ZEPTOMAIL_TOKEN`) joins
  `STRIPE_SECRET_KEY` as a server-side secret — same management
  burden, same leak consequences if mishandled.

## Alternatives Considered

- **Zoho Mail SMTP relay (the mailbox's own submission server)** —
  Rejected: the mailbox service prohibits bulk, burst, and automated
  sends under its usage policy; its external limits are
  reputation-shaped and small; authentication exposes mailbox
  credentials or app-passwords to environment config; and
  application traffic would drag the human mailbox's deliverability
  and risk the account. Person-to-person mail is its job — not this.
- **Resend** — Rejected for now, recorded as the designated
  alternative: clean developer experience, React Email branded
  templates, Hosting-Platform marketplace provisioning, and —
  unlike the chosen provider — marketing/broadcast capability that
  would un-defer the promotions list. Chosen provider was preferred
  for vendor consolidation and near-zero cost; Resend remains the
  first candidate if marketing lands or delivery disappoints.
- **Brevo (EU marketing + transactional platform)** — Rejected for
  now: EU-resident with genuine free marketing campaigns and
  double opt-in tooling, but a heavier dashboard-driven platform
  than the Storefront needs while the marketing feature is deferred.
- **Postmark** — Rejected: best-in-class transactional deliverability
  but paid from the first meaningful volume, and its broadcast
  stream does not change the marketing picture enough to justify it.
- **AWS SES** — Rejected: cheapest per-message pricing and EU
  regions, but DIY everything — templates, bounce/suppression
  handling, and no marketing product — an ops burden for pennies
  saved at this volume.
- **Self-hosted MTA on operator-owned infrastructure** — Rejected:
  the operator's on-premises servers sit behind ISP address space
  receivers distrust by default (residential/dynamic ranges are
  broadly blocklisted, PTR control is limited or absent, outbound
  port 25 is commonly filtered), deliverability would take weeks of
  IP warm-up at best, and the Storefront's serverless email path
  would become hostage to a single premises' power, ISP, and
  patching — maximum operations burden for an identity the
  provider already delivers.
- **Provider marketing products (Zoho Campaigns or ESP-managed
  lists)** — Deferred, not rejected: the promotions-notification
  requirement is real but out of scope while no marketing-capable
  pipe exists; a future ADR chooses between the vendor's own
  campaigns product and a different provider.
