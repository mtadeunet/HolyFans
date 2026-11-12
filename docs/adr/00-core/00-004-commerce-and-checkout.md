# ADR 00-004: Commerce and Checkout — In-Repo Product Data, Client Cart, Stripe Hosted Checkout

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-002 (Rendering and Hosting Model)
ADR 00-006 (Media and Asset Pipeline)

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
  Purchase Caps for small handmade runs — imagery references, and
  Availability Flags). An item may carry an optional **Compare-At Price**: a
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
- **Pricing and tax:** all prices are presented and charged in EUR, and the
  displayed price remains VAT-inclusive — the shopper always sees the
  final total before payment, as required for EU consumer sales. The
  Compare-At Price, when present, follows the same VAT-inclusive display
  convention but is presentation-only — it is never part of the charged
  total. Tax
  computation is delegated to the PSP: the checkout Route Handler creates
  Checkout Sessions with automatic tax enabled and line items marked with
  inclusive tax behavior, so the PSP computes the VAT portion inside the
  displayed total rather than adding tax at payment time. This carries a
  hard operational dependency: an active Stripe Tax registration covering
  the applicable jurisdiction(s) MUST exist in the PSP Dashboard — without
  it, no tax is computed or recorded. That registration is an owner
  prerequisite, configured and maintained outside the codebase.

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
- Automatic tax keeps displayed prices VAT-inclusive while the PSP
  computes and reports the VAT portion — no rate tables or tax logic in
  the codebase.
- The PSP's hosted payment page carries brand-consistent styling, keeping
  the premium experience coherent.
- Promotional pricing ships entirely inside Product Data: the Compare-At
  Price is display-only, so discounts are presented without touching the
  checkout contract, server-side re-validation, or tax computation.

**Negative / trade-offs:**
- No automated inventory enforcement: a Variant can be oversold between
  Availability Flag updates. Accepted at launch volumes; must be revisited
  if volume or sell-through speed grows.
- The checkout Route Handler is custom server-side code holding a PSP
  secret — the one place the Storefront keeps a credential and performs
  outbound payment work; it must be hardened (input caps, rate limiting,
  graceful failure) and its runtime requirement (Node) fixes part of the
  dynamic surface.
- Manual Fulfillment does not scale to high order volume; a future ADR would
  be needed to introduce inventory/order management.
- Any PSP outage blocks purchases entirely (single-provider dependency);
  checkout must degrade gracefully.
- Delayed-confirmation methods (Multibanco) can complete or fail after the
  shopper leaves; without an event receiver the operator must rely on
  PSP-native notifications — a deliberately accepted constraint, since the
  alternative would violate the ADR 00-002 boundary.
- Automatic tax depends on an owner-maintained Stripe Tax registration in
  the PSP Dashboard; a missing or lapsed registration means no tax is
  computed — an operational prerequisite the codebase cannot enforce.
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
- **VAT-inclusive pricing without a PSP tax service** — Rejected: presents
  VAT-inclusive prices but leaves the VAT portion uncomputed and
  unrecorded on the payment — no tax data is produced for the business's
  obligations. Delegating tax computation to the PSP preserves the required
  VAT-inclusive display while the tax portion is computed and reported by
  the provider.
