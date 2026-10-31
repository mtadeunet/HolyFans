# TERMINOLOGY — HolyFans Canonical Glossary

This glossary is the canonical terminology source for the project. Terms defined
here MUST be used verbatim in ADRs, implementation plans, code comments, and
user-facing documentation.

## Domain Terms

- **Storefront** — the public-facing HolyFans website: all pages a visitor can
  reach, including the catalog, product pages, brand content, and support pages.
- **Product Catalog** — the complete set of sellable items offered by the
  Storefront.
- **Product Data** — the structured, versioned description of each catalog item:
  name, description, price in EUR, imagery, Variants, and its Availability Flag.
- **Variant** — a purchasable configuration of a product (e.g., a fit or size
  option), sharing the product's base price unless overridden.
- **Purchase Cap** — an optional per-Variant limit on the quantity orderable in
  a single Checkout Session, used for small handmade runs.
- **Availability Flag** — a per-product or per-Variant indicator in Product Data
  marking an item as purchasable or sold out. Managed manually.
- **Cart** — the shopper-held collection of selected Variants and quantities,
  maintained entirely on the shopper's device.
- **Checkout Session** — a single payment transaction created with the PSP,
  describing the Cart contents, totals, and redirect targets.
- **PSP** — Payment Service Provider: the third party that processes payments,
  hosts the payment page, and handles PCI scope. The chosen PSP is Stripe.
- **Hosted Checkout** — the payment page hosted by the PSP, to which the shopper
  is redirected to complete payment.
- **Fulfillment** — the manual process of receiving order notifications,
  producing/sourcing the item, and shipping it to the customer.
- **Site Config** — the operator-controlled configuration record holding
  Storefront section visibility, chrome visibility, and the QR Redirect Route
  destination. Stored in Edge Config and editable via the Admin Console.
- **Admin Console** — the password-gated `/admin` surface used by the operator
  to read and write Site Config.

## Technical Terms

- **Static Site Generation (SSG)** — producing storefront pages as static
  output at build time; no per-request rendering for storefront content.
- **Hosting Platform** — the deployment platform for the Storefront (Vercel):
  serves statically generated pages, runs Route Handlers, hosts Edge Config,
  and provides preview deployments driven by the repository's Git integration.
- **Route Handler** — a request-time HTTP endpoint provided by the application
  framework on the Hosting Platform. The Storefront's enumerated dynamic
  compute surface consists of the Request-Time Middleware plus three Route
  Handlers: the QR Redirect Route read, the Admin Console write path, and the
  single checkout endpoint. The checkout and Admin Console write paths run on
  the Node runtime; the QR Redirect Route is Edge-capable.
- **Request-Time Middleware** — the single middleware layer that runs on every
  inbound request to a non-static path and performs exactly three duties:
  Locale routing and browser-language detection, the fail-closed password gate
  on the Admin Console, and canonicalization of Locale-prefixed QR paths to
  the bare QR Redirect Route. Enumerated as part of the dynamic surface in
  ADR 00-002.
- **Edge Config** — the Hosting Platform's low-latency, edge-replicated
  key-value store, read at request time. It holds Site Config.
- **Island** — a small, independently interactive client-side component
  embedded in an otherwise server-rendered or static page, hydrated on the
  client only where interactivity is required.
- **Locale** — a language/market version of the Storefront. The Primary Locale
  is Portuguese (`pt`); the secondary supported Locale is English (`en`).
- **Primary Locale** — the default Locale (`pt`). Both Locales are served
  under their own URL prefix (`/pt/`, `/en/`); the site root resolves the
  visitor's Locale by browser-language detection, defaulting to `pt`.
- **QR Redirect Route** — the permanent route `/qrcoderedirect` on
  `<store-domain>` that printed QR codes encode; it must always resolve to a
  working destination.
- **Design Token** — a named, reusable design value (color, spacing, typography
  scale step, radius, elevation) that forms the single source of truth for the
  visual system.
- **Brand Palette** — the canonical set of brand colors defined by the
  implemented Design Tokens: deep navy primary (`#1e3a5f`), gold accent
  (`#d4af37`), near-white surface (`#f8fafc`), dark primary text (`#1a202c`),
  secondary text (`#4a5568`), light borders (`#e2e8f0`), plus product-design
  accent colors reserved for garment artwork rather than UI chrome.
- **Cookieless Analytics** — visitor measurement that sets no cookies and
  collects no personal data, requiring no consent banner.
- **Store Domain** — the store's canonical domain, referred to in tracked
  documents only as `<store-domain>` (identifier hygiene rule).

## Tooling Terms

- **QR Generator** — the repository's retained Python tooling that renders
  branded QR images (module color, logo overlay, shape). Located under
  `scripts/`; used offline, not part of the Storefront runtime.
