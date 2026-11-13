# ADR 00-011: Page Model and Product Routes — A Landing Page and One Product Page per Product

## Status

Proposed

## Related

ADR 00-002 (Rendering and Hosting Model)
ADR 00-004 (Commerce and Checkout)
ADR 00-005 (Internationalization)
ADR 00-009 (WhatsApp Deep-Link Channels)
ADR 00-010 (Pre-order and Stock Notification)
ADR 03-002 (Landing Page Composition)

## Context

The Storefront's browsing surface has so far been described as the
Locale landing roots plus a single conversion surface: a feed at the
landing root and the Simplified Purchase Surface at a checkout-named
path. The owner has now decided the structural model in user terms:
the site has a landing page and a product page for each product. With
a one-product catalog the "product page" is the existing Simplified
Purchase Surface itself — the owner names that surface the product
page: it carries Variant selection, quantity, the VAT-inclusive
price, the purchase or Pre-order action (ADR 00-010), and the
Outbound Share Surface (ADR 00-009).

"A product page for each product" also settles the multi-product
future the small catalog will grow into: the conversion surface's
canonical route must identify which product it sells, so the route
convention must be per-product rather than a single fixed path. The
decision must reconcile with ADR 00-002's enumerated dynamic surface
(product pages are static catalog content, not request-time compute),
ADR 03-002's Simplified Purchase Surface (its semantics are already
correct — only its host route changes), the post-checkout success and
cancel pages (PSP-return endpoints that must keep working), the
Purchase-Surface Gate of ADR 00-004 (which gates the surface whatever
its path), and identifier hygiene (the route carries a brand-owned
product identifier, never a third-party identifier).

## Decision

The Storefront's page model is **a Landing Page plus one Product Page
per product**, both composed inside the Feed Shell (ADR 03-002). The
Product Page is a per-product route carrying the Simplified Purchase
Surface; its canonical path is a Locale-prefixed, product-namespaced
URL whose final segment is the product's canonical slug carried in
Product Data.

- **Two page kinds.** The Landing Page is the Locale landing root —
  the front door carrying the Post Card feed (ADR 03-002); it is
  unchanged by this decision. A Product Page exists for every product
  in the Product Catalog and is the conversion page for that product.
- **The Product Page IS the Simplified Purchase Surface.** The
  surface defined by ADR 03-002 does not change semantically —
  Variant selection, quantity, the VAT-inclusive EUR price, the
  purchase action or the Pre-order state, and the Outbound Share
  Surface. The composition's conversion route is the Product Page
  route: the surface's canonical host is per-product, and its
  contents are scoped to the product the page names.
- **Product route convention.** Each Product Page is served at a
  Locale-prefixed, product-namespaced path — `/<Locale>/product/
  <slug>` — where the slug is the product's canonical identifier
  carried in Product Data: a stable, lowercase, human-readable,
  brand-owned string that is locale-neutral — the same product
  identifier under both Locale prefixes, so each product has one
  hreflang-paired set of URLs. Product pages are statically generated
  per product per Locale — catalog content inside the SSG model of
  ADR 00-002; they add no request-time compute and no entry to the
  enumerated dynamic surface.
- **Former purchase-path reconciliation.** The post-checkout success
  and cancel pages keep their existing paths as PSP-return endpoints
  (ADR 00-004). The bare former surface path redirects to the single
  product's Product Page through build-configured static redirect
  rules — one per Locale-prefixed path, each preserving the visitor's
  Locale (`/<Locale>/checkout` → `/<Locale>/product/<slug>`) —
  platform routing configuration, not a Route Handler, so the
  enumerated dynamic surface is unchanged. The redirect exists while
  the catalog holds exactly one product and its target is
  unambiguous; it is retired when a second product ships.
- **Link retargeting.** Every in-shell affordance that resolves
  purchase intent — Media Slot links, the Nav Rail purchase
  call-to-action, Suggestions Rail Variant suggestions — resolves to
  the Product Page of the product it features. The Variant
  preselection query parameter that selects a Variant on the surface
  is preserved on the product route, so a suggestion landing on a
  Product Page resolves exactly as it did on the former path.
- **Purchase-Surface Gate.** The Purchase-Surface Gate (ADR 00-004)
  gates the Product Page routes: while it is closed, no Product Page
  renders and the gated endpoints (the checkout and
  stock-notification Route Handlers) answer unavailable — the gate's
  semantics are unchanged; only the gated routes are now per-product.
- **Product Data becomes a catalog.** The model anticipates multiple
  products: Product Data evolves from a single-product record to a
  keyed collection, and every consumer that today assumes one product
  — Variant resolution, server-side Cart re-validation, suggestion
  relevance, preselection validation, Stock Notification List
  scoping — is scoped to a named product. This is a stated direction
  and consequence, not new machinery for a one-product catalog.
- **Localization.** Product routes live under the Locale prefix per
  ADR 00-005; the slug itself is locale-neutral and is not
  translated.

## Consequences

**Positive:**
- The owner's vocabulary and the architecture now agree: the
  conversion surface is a product page with a product-identifying
  URL — shareable, canonical for SEO, and ready for catalog growth
  without a route redesign.
- Media Slots and suggestions gain stable per-product targets: when a
  second product ships, feed media links resolve correctly by
  construction instead of needing a route migration.
- The model changes routing, not semantics: every existing surface
  rule — Availability Flags, Purchase Caps, the Pre-order state,
  server-side re-validation, the Outbound Share Surface — carries
  over verbatim.
- The enumerated dynamic surface is untouched: Product Pages are
  static output and the compatibility redirect is routing
  configuration — no new Route Handler and no new request-time
  dependency.
- Pre-order capture lands on a durable per-product URL: a Stock
  Notification List entry stays meaningful regardless of catalog
  growth.

**Negative / trade-offs:**
- The canonical conversion URL changes once: the former path is
  preserved only by a single-product redirect, so any external link
  or material using it must be reconciled before a second product
  retires the redirect.
- The single-product store's canonical purchase URL is longer than
  the former path — an accepted cost of a convention that scales.
- Product Data must grow a slug field and, eventually, a catalog
  shape: every consumer currently hard-wired to the singleton —
  Variant lookup, checkout re-validation, suggestions, notify
  scoping — must be scoped per product when the second product
  lands. Deferred work this decision makes mandatory.
- Slug authoring joins Product Data maintenance: slugs must stay
  stable once linked, unique, and brand-owned under identifier
  hygiene.
- Two namespaces now carry "checkout" vocabulary — the post-checkout
  pages keep their paths while the pre-checkout surface moves — a
  potential source of reader confusion until the code catches up.

## Alternatives Considered

- **Keep the surface at its former fixed path** — Rejected: a single
  fixed purchase path cannot express a product page per product;
  per-product URLs need product identity in the path, and keeping the
  checkout-named path conflates the pre-payment presentation with the
  post-checkout namespace.
- **The former path as a payment-step page reached from the Product
  Page** — Rejected: payment is the PSP's Hosted Checkout (ADR
  00-004); an intermediate in-house step adds a hop and a second
  gated page for no capability — the Product Page submits directly
  into the checkout path.
- **Product pages at top-level per-Locale paths (`/<Locale>/<slug>`)**
  — Rejected: collides with present and future top-level sections and
  reserved routes; a product namespace keeps product URLs explicit,
  unambiguous, and extensible.
- **An abbreviated namespace (`/<Locale>/p/<slug>`)** — Rejected:
  opaque and off-brand; the spelled-out namespace is self-describing
  and locale-neutral without translation.
- **Per-Locale translated slugs** — Rejected: two slugs per product
  doubles identifier management and complicates hreflang pairing; a
  single locale-neutral slug keeps each product's identity stable.
- **The internal product identifier as the slug** — Rejected: the
  internal id is not a readable product URL; the slug is a dedicated
  Product Data field decoupled from internal identifiers.
- **A dynamic route or Route Handler serving product pages** —
  Rejected: the catalog is static content; per-product SSG is the
  established model and the enumerated dynamic surface of ADR 00-002
  must not grow for presentation routing.
