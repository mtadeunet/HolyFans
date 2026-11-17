# ADR 00-004: Commerce and Checkout — In-Repo Product Data, Client Cart, Stripe Hosted Checkout

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-002 (Rendering and Hosting Model)
ADR 00-006 (Media and Asset Pipeline)
ADR 00-009 (WhatsApp Deep-Link Channels)
ADR 00-010 (Pre-order and Stock Notification)
ADR 00-011 (Page Model and Product Routes)

## Context

The business sells a small Product Catalog of premium items in EUR to a
Portuguese-first market. Payment must support the methods Portuguese customers
expect — cards plus local methods such as MB Way and Multibanco — as well as
common wallets. The operator is small; order volume will be modest, and
Fulfillment is manual. There is no need for customer accounts, subscriptions,
or a large inventory system at launch. PCI scope, payment-page security, and
receipt communication should be outsourced to a specialist provider. The
checkout experience must feel premium and trustworthy — an off-brand or clunky
payment step would damage the positioning. Product Data changes are developer-
driven and infrequent, matching a code-managed catalog. The storefront already
has a Cart and a purchase UI whose order submission is not connected to any
payment provider; connecting it to a real PSP is the remaining work, and it
must happen without widening the dynamic surface beyond the boundary in
ADR 00-002.

## Decision

Commerce is implemented as **in-repo Product Data, a client-side Cart, and a
PSP Hosted Checkout**:

- **Product Data** lives in the repository as structured, versioned content
  (names, descriptions, EUR prices, Variants — including optional per-Variant
  Purchase Caps for small handmade runs — imagery references,
  Availability Flags, and the item's canonical slug — the brand-owned,
  locale-neutral identifier segmenting its Product Page route,
  ADR 00-011). An item may carry an optional **Compare-At Price**: a
  display-only regular price shown struck-through next to the effective
  price — the charged amount remains the listed price, and the compare-at
  value is never submitted to the checkout path or the PSP. There is no CMS
  and no commerce-platform catalog.
- **Cart** is a client-side Island: it lives in the shopper's browser, holds
  selected Variants and quantities clamped to their Purchase Caps, and
  persists across visits on the same device. There are no customer accounts.
- **Checkout** is delegated to the PSP's Hosted Checkout. The shopper's Cart
  is submitted to the Storefront's single checkout Route Handler (Node
  runtime, per ADR 00-002), which:
  - re-validates every Cart line server-side against Product Data — prices,
    Variants, Availability Flags, and Purchase Caps are NEVER taken from the
    client;
  - creates a Checkout Session describing the validated Cart and the
    fulfillment details the PSP must collect (shipping address and shipping
    options, so total cost is shown before payment);
  - resolves the origin of every URL the Session hands the PSP — the
    shopper's post-payment return destinations and the Storefront asset
    references embedded in line items — server-side and deployment-aware:
    the configured canonical base URL, else the Hosting Platform's
    per-deployment origin, so a checkout started on a preview deployment
    returns the shopper to that same deployment. The resolution never
    trusts request-supplied headers and never enters client bundles,
    which emit only the canonical URL on the Store Domain — deliberately
    deployment-unaware so every client-visible and shared link stays
    canonical (ADR 00-009);
  - creates Sessions idempotently — retries never produce duplicate
    Checkout Sessions;
  - refuses checkout on any Cart/Product Data divergence, surfacing a
    review-and-correct state to the shopper;
  then redirects the shopper to the PSP-hosted payment page. The localized
  post-checkout success page distinguishes a paid outcome from an
  asynchronous pending-payment state (e.g., a Multibanco reference awaiting
  payment) through the session-status read enumerated in ADR 00-002's
  dynamic surface.
- **PSP: Stripe.** Chosen for EUR support, Portuguese-relevant payment
  methods (cards, MB Way, Multibanco, plus wallets and SEPA instruments),
  hosted PCI-compliant payment pages with strong premium branding controls,
  and first-rate developer tooling — with no platform markup beyond standard
  processing fees.
- **Order receipt and Fulfillment:** all payment notifications are
  PSP-native — the PSP confirms the order and delivers the receipt to the
  customer, and notifies the operator of new orders and of asynchronous
  payment outcomes (delayed-confirmation methods such as Multibanco). The
  operator performs Fulfillment manually at the expected volumes. Webhook
  or event-receiving endpoints are out of scope: no inbound communication
  channel exists beyond the enumerated Route Handlers in ADR 00-002, and all
  payment lifecycle signals are consumed through the PSP's own notification
  and reporting surfaces.
- **Availability:** sold-out state is expressed through Availability Flags in
  Product Data (small handmade runs); no automated stock counters at launch.
  A non-purchasable item is never hidden from the purchase surface: it
  presents the Pre-order state of ADR 00-010 — purchasability composes
  every Availability Flag applying to the item with the item's own
  Stock Flag in Site Config — while server-side re-validation keeps
  Product Data the hard purchase backstop.
- **Pricing and tax:** all prices are presented and charged in EUR, and the
  displayed price is the final total — the shopper always sees the full
  amount before payment, as required for EU consumer sales. The
  Compare-At Price, when present, follows the same display convention but
  is presentation-only — it is never part of the charged total. **No tax
  is computed or collected at checkout:** the checkout Route Handler
  creates Checkout Sessions with automatic tax disabled, and no PSP tax
  service is used — there is no Stripe Tax registration requirement or
  dependency. Any VAT-inclusive framing of displayed prices is purely a
  pricing and display decision, not tax semantics: the checkout produces
  no tax data and PSP receipts carry no tax line. VAT determination,
  reporting, and remittance are an out-of-band accounting responsibility
  handled by the owner's accountant outside the PSP.
- **Purchase-Surface Gate (interim).** Until launch, the purchase
  surface — the Product Page routes (ADR 00-011) — and its endpoints
  stay hidden behind a code-level **Purchase-Surface Gate** — a
  fail-closed environment switch,
  deliberately not a Site Config toggle: Site Config reads fail open
  to defaults, which would silently re-expose the surface on an Edge
  Config outage. The gate is transitional — it exists to keep the
  unlaunched purchase flow invisible and is removed at launch, after
  which the surface is permanently open.

## Consequences

**Positive:**
- No commerce platform fees or lock-in; total payment cost is the PSP's
  processing fee alone.
- Checkout inherits the PSP's PCI compliance, fraud tooling, and localized
  payment methods — including the Portuguese methods that materially affect
  conversion.
- Server-side re-validation makes the client Cart untrusted input: tampered
  prices, over-cap quantities, and sold-out items can never become Sessions.
- Product Data in the repository means catalog changes ship through the same
  review/deploy pipeline as everything else; zero external dependencies to
  render the catalog.
- The payment dynamic surface is exactly one checkout Route Handler plus
  the post-checkout session-status read — minimal attack area, minimal ops.
- Preview deployments run the complete checkout flow end-to-end: Session
  URLs resolve to the deployment's own origin server-side, so
  hosted-payment returns and Session-embedded assets work per preview —
  while the canonical URL stays the only client-emittable origin.
- No tax logic, rate tables, or tax-service registration exists in the
  codebase or the PSP configuration — the charged amount is exactly the
  displayed price, and tax compliance never gates checkout availability.
- The PSP's hosted payment page carries brand-consistent styling, keeping
  the premium experience coherent.
- Promotional pricing ships entirely inside Product Data: the Compare-At
  Price is display-only, so discounts are presented without touching the
  checkout contract, server-side re-validation, or tax computation.

**Negative / trade-offs:**
- No automated inventory enforcement: a Variant can be oversold between
  Availability Flag updates. Accepted at launch volumes; must be revisited
  if volume or sell-through speed grows. The Stock Flags (ADR 00-010)
  are a presentation-level override — while a Variant's flag is on, a
  stale page or direct POST can still reach the checkout Route
  Handler, so a hard stop requires the Product Data Availability Flags
  that re-validation enforces.
- The Purchase-Surface Gate is a transitional code-level switch:
  unlike Site Config toggles it needs a redeploy to flip — deliberate,
  because a fail-open toggle could silently re-expose the unlaunched
  surface.
- The checkout Route Handler is custom server-side code holding a PSP
  secret — the one place the Storefront keeps a credential and performs
  outbound payment work; it must be hardened (input caps, rate limiting,
  graceful failure) and its runtime requirement (Node) fixes part of the
  dynamic surface.
- Origin resolution is two-track: the canonical base URL is deliberately
  deployment-unaware, so any request-time consumer needing the real
  deployment origin must resolve it server-side itself and keep it out
  of client bundles and shared surfaces.
- Manual Fulfillment does not scale to high order volume; a future ADR would
  be needed to introduce inventory/order management.
- Any PSP outage blocks purchases entirely (single-provider dependency);
  checkout must degrade gracefully.
- Delayed-confirmation methods (Multibanco) can complete or fail after the
  shopper leaves; without an event receiver the operator must rely on
  PSP-native notifications — a deliberately accepted constraint, since the
  alternative would violate the ADR 00-002 boundary.
- No tax is computed or recorded on the payment: PSP receipts show no
  tax line and the payment record carries no tax data. VAT reporting and
  remittance rest entirely on the owner's accountant outside the PSP —
  an out-of-band process the architecture neither supports nor enforces,
  and one the storefront produces no data to assist.
- A Compare-At Price is a legal price-reduction claim under EU consumer
  rules — the operator must keep it truthful (a genuine regular or prior
  price); the mechanism cannot verify the claim.

## Alternatives Considered

- **Mollie as the PSP** — Rejected, credibly: strong EU coverage, native
  support for the required Portuguese methods, and good developer tooling.
  Stripe was preferred for the polish of its Hosted Checkout (closer to the
  premium bar out of the box), deeper ecosystem and documentation, and
  broader wallet coverage. Mollie remains the designated fallback if the
  Stripe account cannot serve a Portuguese entity.
- **Portuguese PSPs directly (Ifthenpay, EuPago, easypay)** — Rejected:
  native MB Way/Multibanco but dated integration UX, weaker international
  payment coverage, and heavier integration effort than the chosen PSP,
  which already supports the required local methods.
- **PayPal as the primary PSP** — Rejected: weaker Portuguese local-method
  coverage and a less premium checkout presentation; acceptable only as a
  secondary wallet surfaced through the chosen PSP.
- **Full commerce platform, headless (Shopify headless / Storefront API)** —
  Rejected: subscription cost plus a second build/deploy stack and API
  complexity, all to manage a catalog of a few products; Portuguese local
  payment methods still require extra gateway apps. Disproportionate.
- **Hosted commerce platform, themed storefront (Shopify basic, Big Cartel,
  Ecwid)** — Rejected: template constraints compromise the premium custom
  design; weak control over presentation and localization.
- **Embeddable cart/checkout vendors (e.g., Snipcart)** — Rejected: adds a
  percentage-of-sales fee and a vendor dependency for capabilities Stripe
  already provides; the value is managing catalogs larger than this one.
- **PSP Payment Links only (no Cart, no function)** — Rejected as the target
  mechanism: per-product links cannot express a multi-Variant Cart or a
  coherent premium basket flow; acceptable only as a temporary launch
  expedient, never as the architecture.
- **PSP webhooks / a Storefront event receiver for order lifecycle
  signals** — Rejected: a webhook endpoint is an additional inbound
  request-time channel and dynamic surface, contradicting the enumerated-
  Route-Handler boundary of ADR 00-002; PSP-native notifications cover order
  confirmation and asynchronous payment outcomes without one.
- **Self-hosted commerce (WooCommerce or similar)** — Rejected: introduces a
  server, database, security patching, and plugin maintenance — the opposite
  of the low-operations hybrid model in ADR 00-002.
- **Headless CMS for Product Data (Sanity, Contentful, etc.)** — Rejected:
  recurring cost and an external service dependency to edit a handful of
  products a few times a year; the code-managed catalog is simpler and more
  reviewable.
- **PSP tax service (Stripe Tax automatic tax)** — Rejected: requires an
  owner-maintained Stripe Tax registration covering the applicable
  jurisdiction(s) — an operational prerequisite the codebase cannot
  enforce — and adds a PSP service dependency the business does not
  need, since VAT reporting is discharged by the owner's accountant
  outside the PSP.
