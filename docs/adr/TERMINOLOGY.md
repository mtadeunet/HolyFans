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
  name, description, price in EUR, an optional Compare-At Price, imagery,
  Variants, its Availability Flag, and its canonical slug — the
  brand-owned, locale-neutral route segment of the item's Product Page
  (ADR 00-011).
- **Compare-At Price** — an optional, display-only regular price carried in
  Product Data and shown struck-through next to the effective price; it is
  never charged and never enters the checkout path (ADR 00-004).
- **Variant** — a purchasable configuration of a product (e.g., a fit or size
  option), sharing the product's base price unless overridden.
- **Purchase Cap** — an optional per-Variant limit on the quantity orderable in
  a single Checkout Session, used for small handmade runs.
- **Availability Flag** — a per-product or per-Variant indicator in Product Data
  marking an item as purchasable or sold out. Managed manually. Composes
  with the operator Stock Flag to decide the Simplified Purchase
  Surface's state (ADR 00-010); the catalog currently carries
  per-Variant flags only.
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
  Storefront section visibility, chrome visibility, the Stock Flag, and
  the QR Redirect Route destination. Stored in Edge Config and editable
  via the Admin Console.
- **Admin Console** — the password-gated `/admin` surface used by the operator
  to read and write Site Config.
- **Store Messaging Number** — the operator-supplied WhatsApp contact number
  the Inbound Contact Surface opens a chat to; provided via Hosting Platform
  environment configuration and never committed to tracked files (identifier
  hygiene, ADR 00-009).
- **Inbound Contact Surface** — the persistent floating Storefront control
  that opens a WhatsApp chat addressed to the Store Messaging Number;
  operator-toggleable through Site Config / the Admin Console, and renders
  nothing when the Store Messaging Number is unconfigured (fail-closed)
  (ADR 00-009).
- **Outbound Share Surface** — the control on the canonical purchase block
  that lets a visitor compose a WhatsApp message containing the Storefront's
  canonical URL on the Store Domain for their own contacts; ungated and
  configuration-free (ADR 00-009).
- **Stock Flag** — the operator-controlled Site Config toggle that forces
  the entire Simplified Purchase Surface into the Pre-order state,
  independent of the per-Variant Availability Flags; flips without a
  rebuild through the Admin Console / Edge Config (ADR 00-010).
- **Pre-order** — the Simplified Purchase Surface's non-purchasable
  presentation: a sold-out message plus a notify-me control that captures
  a consented visitor email into the Stock Notification List. An
  expression of interest — no payment, no Checkout Session, no
  reservation (ADR 00-010).
- **Stock Notification List** — the operator-held list of consented
  visitor emails captured by the Pre-order state, scoped to the
  Variant the visitor asked about; stored in a dedicated per-Variant
  keyspace of the managed Redis store, purpose-limited to stock
  notification, retained until the notification sends or the operator
  purges it, and never joined to Like Tokens or analytics (ADR 00-010,
  ADR 00-008).
- **Purchase-Surface Gate** — the interim, code-level environment
  switch that keeps the unlaunched purchase surface and its endpoints
  hidden until launch; fail-closed and deliberately not a Site Config
  toggle (Site Config reads fail open). Transitional — removed at
  launch (ADR 00-004).

## UI Composition Terms

- **Landing Page** — the Locale landing root: the Feed Shell route
  carrying the Post Card feed, the Storefront's front door and the
  origin of Media Slot links (ADR 03-002, ADR 00-011).
- **Product Page** — the per-product conversion route carrying the
  Simplified Purchase Surface inside the Feed Shell — Variant
  selection, quantity, the VAT-inclusive EUR price, the purchase
  action or the Pre-order state, and the Outbound Share Surface;
  served at a Locale-prefixed, product-namespaced path whose final
  segment is the product's canonical slug from Product Data (ADR
  00-011, ADR 03-002).
- **Feed Shell** — the three-column composition of the browse-and-
  purchase flow: Nav Rail, Feed Surface, and Suggestions Rail; it
  replaces the stacked marketing sections and the classic header/footer
  chrome on the Locale landing roots and the Product Page routes (ADR
  03-002, ADR 00-011).
- **Nav Rail** — the Feed Shell's left column: the brand mark, a
  store-adapted list of icon-and-label navigation entries, language
  switching, and a prominent purchase call-to-action at its foot
  resolving to a Product Page (ADR 03-002, ADR 00-011).
- **Feed Surface** — the Feed Shell's center column and primary content
  region: on the Locale landing roots a vertical scroll of Post Cards;
  on each Product Page route the single centered panel carrying the
  Simplified Purchase Surface (ADR 03-002, ADR 00-011).
- **Post Card** — the repeating content unit of the landing's feed: a
  brand header (avatar, name, decorative handle), localized caption
  copy, a Media Slot, and an Interaction Row (ADR 03-002).
- **Media Slot** — the Post Card's media region; every Media Slot links
  to the Product Page of the product it features within the same Locale
  (ADR 00-011).
- **Interaction Row** — the social affordance row on a Post Card: a
  like control showing the shared count (the authored base plus the
  server-persisted delta, deduplicated per visitor by a Like Token)
  and a share control resolved on the visitor's device with a
  clipboard fallback; feeds aggregate counts only and emits no
  analytics signal (ADR 03-002, ADR 00-008).
- **Like Token** — the anonymous, self-generated per-browser
  identifier held in client-side storage (never a cookie) and sent
  with a like toggle so the server deduplicates that visitor's like
  per Post Card; identifies no person and feeds aggregate counts
  only (ADR 03-002, ADR 00-008).
- **Suggestions Rail** — the Feed Shell's right column: product and
  Variant suggestion cards, a discovery call-to-action, and the legal
  links at its foot; present only on wider viewports (ADR 03-002).
- **Simplified Purchase Surface** — the reduced checkout surface:
  Variant selection, quantity, the VAT-inclusive EUR price, and a single
  purchase action into the existing checkout path — replaced by the
  Pre-order state when the selected Variant is not purchasable (ADR
  00-010); no cart-review presentation; rendered inside the Feed
  Surface on the product's Product Page (ADR 03-002, ADR 00-011;
  commerce contract per ADR 00-004).

## Technical Terms

- **Static Site Generation (SSG)** — producing storefront pages as static
  output at build time; no per-request rendering for storefront content.
- **Hosting Platform** — the deployment platform for the Storefront (Vercel):
  serves statically generated pages, runs Route Handlers, hosts Edge Config,
  and provides preview deployments driven by the repository's Git integration.
- **Route Handler** — a request-time HTTP endpoint provided by the application
  framework on the Hosting Platform. The Storefront's enumerated dynamic
  compute surface consists of the Request-Time Middleware, five Route
  Handlers — the QR Redirect Route read, the Admin Console write path,
  the single checkout endpoint, the like counter endpoint serving the
  Interaction Row, and the stock-notification endpoint serving the
  Pre-order state (the last two backed by the Hosting Platform's
  marketplace-provisioned Redis store) — and the dynamic post-checkout
  success page, which performs a read-only retrieval of the Checkout
  Session's payment status at render time (ADR 00-002). The checkout,
  Admin Console write, like counter, and stock-notification paths run
  on the Node runtime; the QR Redirect Route is Edge-capable.
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
- **Primary Platform** — mobile: the small-viewport, touch-first form is
  the canonical baseline the Storefront is designed, built, and verified
  for first, then scaled up to wider viewports. Desktop remains fully
  supported — every route and the complete purchase and conversion path
  work on it — and any capability or content region present on only one
  platform is an explicit, ADR-recorded trade-off, the Suggestions Rail's
  wider-viewport-only presence being the standing instance (ADR 00-012).
- **QR Redirect Route** — the permanent route `/qrcoderedirect` on
  `<store-domain>` that printed QR codes encode; it must always resolve to a
  working destination.
- **Design Token** — a named, reusable design value (color, spacing, typography
  scale step, radius, elevation) that forms the single source of truth for the
  visual system.
- **Brand Palette** — the canonical set of brand colors defined by the
  implemented Design Tokens: near-white page `background` (`#fafafa`),
  white card `surface` (`#ffffff`), bright blue `primary` accent
  (`#0369a1`) with its deepened emphasis variant `accent` (`#075985`),
  near-black `text-primary` (`#111827`), light-gray `text-secondary`
  (`#6b7280`), light-gray `border` (`#e5e7eb`), plus product-design
  accent colors reserved for garment artwork rather than UI chrome.
- **Cookieless Analytics** — visitor measurement that sets no cookies and
  collects no personal data, requiring no consent banner.
- **Store Domain** — the store's canonical domain, referred to in tracked
  documents only as `<store-domain>` (identifier hygiene rule).

## Tooling Terms

- **QR Generator** — the repository's retained Python tooling that renders
  branded QR images (module color, logo overlay, shape). Located under
  `scripts/`; used offline, not part of the Storefront runtime.
