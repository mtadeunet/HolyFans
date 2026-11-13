# ADR 00-010: Pre-order and Stock Notification — In-Place Sold-Out Handling with Consented Email Capture

## Status

Proposed

## Related

ADR 00-002 (Rendering and Hosting Model)
ADR 00-004 (Commerce and Checkout)
ADR 00-005 (Internationalization)
ADR 00-007 (Quality Tooling and CI)
ADR 00-008 (Analytics and Consent)
ADR 00-011 (Page Model and Product Routes)
ADR 03-002 (Landing Page Composition)

## Context

The Product Catalog is small-run and deliberately managed: items sell
out, and restocking is a manual operator decision. Today a sold-out
item simply stops being purchasable — the Simplified Purchase Surface
derives its selectable Variants from Product Data's Availability Flags
(ADR 00-004), so an out-of-stock shopper reaches a dead end at the
highest-intent moment and the operator learns nothing about the demand
that was lost. The owner wants the surface to handle out-of-stock in
place: keep the product visible, offer the visitor a way to be told
when stock returns, and give the operator a redeploy-free way to put
the whole catalog into that state.

The architecture constrains the shape of the solution. ADR 00-002
confines request-time compute to an enumerated dynamic surface — the
capture needs a new enumerated Route Handler, and its storage must fit
the existing posture rather than introduce a new platform. The managed
Redis store provisioned for like counts already exists under a lazy,
fail-closed client pattern. ADR 00-008's privacy posture must expand
explicitly: a stored email is personal data — the first the Storefront
persists — so collection must be consented, purpose-bound, retained
only as long as needed, and deletable by the operator. ADR 00-005
requires every user-facing string, including the consent statement, in
both Locales. Email sending is a deferred dependency: the owner will
choose a provider later, so this decision delivers the captured list,
not the notification.

## Decision

When an item cannot be purchased, the Simplified Purchase Surface
presents a **Pre-order** state in place — a sold-out presentation plus
a consented email capture into an operator-held **Stock Notification
List** — instead of hiding the item. Operator control is a **Stock
Flag** in Site Config composing with the Availability Flags
in Product Data. Capture flows through one new hardened
stock-notification Route Handler into the managed Redis store; the
notification email send is a deferred dependency.

- **Pre-order state.** When the visitor's selected Variant is not
  purchasable, the Simplified Purchase Surface keeps rendering in
  place: a localized sold-out message, and the purchase action replaced
  by a notify-me control that asks for the visitor's email. Submitting
  stores the email and shows an in-page confirmation that the visitor
  will be notified when stock returns. A Pre-order is an expression of
  interest — it creates no payment, no Checkout Session, no
  reservation, and no inventory commitment; the Cart and the checkout
  contract of ADR 00-004 are untouched.
- **Purchasability composition.** A Variant is purchasable exactly when
  every Availability Flag applying to it in Product Data is on AND the
  Stock Flag in Site Config is off. The catalog currently carries
  per-Variant Availability Flags only; a per-product flag, if ever
  introduced, composes the same way — conjunctively. The Stock Flag
  therefore forces the entire surface into the Pre-order state — every
  Variant resolves non-purchasable — while an Availability Flag off at
  any level independently triggers the Pre-order state for the items it
  covers.
  Non-purchasable Variants remain visible and selectable so the visitor
  can scope the capture to the specific Variant they want restocked;
  the action for a non-purchasable selection is always the capture
  control, never the purchase action. Server-side re-validation against
  Product Data Availability Flags remains the hard purchase backstop
  (ADR 00-004): the Stock Flag is a presentation-level override, so an
  operator who needs a hard stop also flags the Variants off in Product
  Data.
- **Stock Flag mechanism.** The Stock Flag is a single operator toggle
  in Site Config — the same mechanism as the section and chrome
  toggles: held in Edge Config in production, the local stand-in file
  in development, edited through the Admin Console, applying within
  seconds without a rebuild. Its default is off (items purchasable):
  Site Config reads fail open to defaults, and failing open to the
  purchasable presentation is the bounded direction because the
  checkout path's Product Data re-validation sits behind it.
- **Stock-notification Route Handler.** One new Route Handler joins the
  enumerated dynamic surface of ADR 00-002 on the Node runtime. It
  accepts the visitor's email, the visitor's Locale, and the
  Variant identifier the capture was scoped to, and it is
  hardened to the same norm as the checkout and like counter endpoints:
  input caps on body size and field lengths, strict validation (email
  shape and length bound, a Variant identifier that must name a real
  Product Data Variant, a Locale that must be a supported Locale),
  per-IP rate limiting in a time window, and fail-closed behavior —
  when the managed store is unconfigured or unreachable it answers a
  graceful "unavailable" state and never reports a success it did not
  persist. It shares the checkout handler's gated posture: while the
  Purchase-Surface Gate (ADR 00-004) is closed, the endpoint answers
  unavailable. It validates that the identifier is real; it does not
  gate on whether that Variant is currently purchasable — an email
  captured against an in-stock Variant is harmless. The email is never
  logged.
- **Stock Notification List storage.** Captured emails persist in the
  same managed Redis store provisioned through the Hosting Platform's
  marketplace for like counts (ADR 00-002) — reusing its lazy,
  fail-closed client pattern — in a dedicated keyspace scoped per
  Variant, never joined to the like dedup records, the
  anonymous Like Token, or any analytics surface. Repeat submissions of
  the same email for the same Variant dedupe naturally; the list is an
  operator-held record the operator can export and clear.
- **Email sending is deferred — explicitly out of scope.** No
  confirmation or notification email is sent under this decision; the
  confirmation the visitor sees is an in-page state only. Sending
  requires its own follow-up decision covering provider choice (Resend
  is the likely candidate), a verified sender domain, and
  unsubscribe/legal-footer obligations. The stored Stock Notification
  List is the deliverable; a notification campaign or automated send
  consumes it later.
- **Privacy posture.** The Stock Notification List is the first
  personal data the Storefront persists and is collected under the
  expanded per-feature consent posture of ADR 00-008: consent language
  stating the single purpose — stock notification for the Variant the
  visitor asked about — is rendered at the capture point in the
  visitor's Locale; there is no marketing reuse without separate
  consent; retention is until the notification is sent or the operator
  purges the list; and the operator holds an export-and-clear path as
  the deletion mechanism. The email is never joined to the Like Token
  or analytics.
- **Purchase-Surface Gate interaction.** The Pre-order state lives
  inside the Simplified Purchase Surface and shares the
  Purchase-Surface Gate (ADR 00-004): while the gate is closed the
  surface does not render — and with it the Pre-order state — and the
  capture endpoint answers unavailable, matching the gated posture of
  the checkout handler. Collecting Pre-orders before launch means
  opening the gate.
- **Localization.** Every string of the state — the sold-out message,
  the consent statement at the capture point, the confirmation, and the
  unavailable state — is authored in both Locales through the versioned
  message catalogs (ADR 00-005).

## Consequences

**Positive:**
- Out-of-stock stops being a dead end: demand is captured at the
  highest-intent moment as a scoped, actionable signal (which Variant
  to restock, and who asked) instead of being silently lost.
- The Stock Flag gives the operator redeploy-free control through the
  existing Admin Console / Edge Config mechanism — no new
  configuration infrastructure, consistent with every other toggle.
- Exactly one new enumerated Route Handler inside the ADR 00-002
  boundary, on the same store and under the same hardening norm as its
  siblings — minimal new attack surface and no new platform
  dependency.
- Capture first, send later: the feature ships its measurable value
  (the operator-held list) without blocking on the email-provider
  decision, verified sender domain, or legal-footer work.
- Consent rendered at the capture point keeps GDPR defensible without a
  consent banner: single stated purpose, minimal data, operator-held
  records with a clear deletion path.
- The composition rule is one sentence — Availability Flag AND NOT
  Stock Flag — covering whole-catalog and per-Variant out-of-stock
  with no new concepts in Product Data.

**Negative / trade-offs:**
- The Storefront persists personal data for the first time: consent
  copy, purpose limitation, bounded retention, and the operator purge
  path become standing obligations, and the managed store's compromise
  or misconfiguration now touches real data rather than vanity
  counters.
- The Stock Flag is presentation-level: while it is on, a stale page or
  a direct POST can still reach the checkout Route Handler — only the
  Product Data Availability Flags, enforced by server-side
  re-validation, are a hard stop. A fail-open Site Config read likewise
  resolves to purchasable during an Edge Config outage; the Product
  Data backstop bounds both cases.
- The captured list is inert until the deferred email-send decision
  lands — Pre-order confirmations are in-page only, and the "we'll
  notify you" promise is an operator obligation the code cannot
  fulfill alone.
- The key-value store offers no schema or expiry for the list:
  retention enforcement (clear on send, purge on demand) is an
  operator process, not a mechanism.
- The endpoint accepts captures against purchasable Variants too and
  any submitted string that looks like an email — rate limiting and
  input caps bound the abuse, but garbage entries accumulate until the
  operator purges the list.
- Pre-launch collection requires opening the Purchase-Surface Gate,
  which also exposes the rest of the gated surface — the gate is
  all-or-nothing on the Product Page routes (ADR 00-011).

## Alternatives Considered

- **Hide the purchase surface (or the sold-out Variants) when out of
  stock** — Rejected: owner decision — out-of-stock is handled in
  place. Hiding forfeits demand capture at the highest-intent moment
  and erases the product from the funnel exactly when interest is
  proven.
- **True paid pre-orders (charge now, fulfill on restock)** — Rejected:
  creates obligations the small operation cannot bound — fulfillment
  timelines, refunds, and chargebacks on stock that does not yet exist
  — and entangles the notification purpose with payment data. The
  capture expresses interest with zero financial commitment.
- **Automated inventory counters driving the out-of-stock state** —
  Rejected: consistent with ADR 00-004's manual-flag posture —
  disproportionate machinery for a small, deliberately managed
  catalog.
- **A second store or dedicated database for captured emails** —
  Rejected: a second live state dependency and vendor for what will be
  a few dozen records; the provisioned managed store already exists
  under the required fail-closed posture.
- **Third-party form or email-marketing capture widgets** — Rejected:
  external scripts and vendor data-sharing conflict with the
  Cookieless Analytics posture of ADR 00-008 and hand visitor personal
  data to an intermediary; the in-house endpoint keeps the list
  operator-held.
- **Send the confirmation/notification email now** — Deferred as a
  capability, rejected as part of this decision: provider choice
  (Resend likely), a verified sender domain, and unsubscribe/legal-
  footer obligations are a separate decision requiring its own ADR;
  shipping capture first delivers the list without blocking on them.
- **Stock Flag as an environment variable or a Product Data field** —
  Rejected: both require a rebuild and redeploy to flip; an operator
  toggle that applies within seconds without a deploy is exactly Site
  Config's purpose.
- **Checkout-time enforcement of the Stock Flag (the checkout Route
  Handler reads it and refuses Sessions)** — Rejected: it makes the
  fail-open Edge Config read a checkout-path dependency while still
  failing open on outage — added coupling without hard enforcement.
  Product Data Availability Flags remain the enforcement path; a hard
  stop sets them.
- **Per-product Stock Flags in Site Config** — Rejected for now: a
  one-product catalog needs one flag; per-item granularity already
  exists through Product Data Availability Flags, and a per-product
  config shape can be introduced when a second product ships.
- **Double opt-in (a confirmation email before listing an address)** —
  Rejected as the launch posture: it depends on the deferred
  email-send capability, and single-purpose consent rendered at the
  capture point suffices for a notification list of this risk level.
  May be revisited by the email-provider ADR.
- **Pre-order surface rendered while the Purchase-Surface Gate is
  closed** — Rejected: the gate exists to keep the unlaunched purchase
  flow invisible; an ungated capture would expose a purchase-adjacent
  surface and an endpoint posture inconsistent with the gated checkout
  handler. Pre-launch collection opens the gate instead.
