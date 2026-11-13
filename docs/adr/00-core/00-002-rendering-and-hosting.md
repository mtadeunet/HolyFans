# ADR 00-002: Rendering and Hosting Model — Hybrid Static Generation on Vercel

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-003 (Permanent QR Redirect Route)
ADR 00-004 (Commerce and Checkout)
ADR 00-010 (Pre-order and Stock Notification)
ADR 03-002 (Landing Page Composition)

## Context

The Storefront's content is almost entirely static: catalog pages, product
pages, brand pages, and legal pages change only when the Product Catalog or
copy changes — a build-time event, not a request-time event. Premium
positioning demands excellent load performance and reliability for visitors in
Portugal. Alongside the static content, the business needs a small set of
request-time capabilities: the permanent QR Redirect Route with a destination
that can be retargeted without redeploys (ADR 00-003), operator-controlled
Site Config toggles, an Admin Console write path, the creation of Checkout
Sessions with the PSP, a request-time read of the created Session's
payment status on the post-checkout success page (ADR 00-004), shared
like counters for the feed's Interaction Row (ADR 03-002), and consented
email capture for the purchase surface's Pre-order state (ADR 00-010).
Hosting must be inexpensive, low-
operations, able to serve the QR Redirect Route indefinitely, and present in
Europe for the primary market.

## Decision

The Storefront runs a **hybrid model on the Vercel Hosting Platform**:

- **Storefront pages are produced by Static Site Generation** — every page,
  for every Locale, is generated at build time and served from the Hosting
  Platform's edge network; no per-request rendering is performed to compose
  storefront content beyond the request-time reads below. The single
  enumerated exception is the post-checkout success page, which renders
  per request to perform the session-status read below.
- **Site Config is read from Edge Config at request time** — the Hosting
  Platform's edge-replicated key-value store holds section/chrome
  visibility, the Stock Flag (ADR 00-010), and the QR Redirect Route
  destination, so operator changes apply within
  seconds without a rebuild. Reads degrade to safe defaults when the store
  is unavailable; this read is the only request-time data dependency in
  storefront page composition other than the post-checkout session-status
  read enumerated below.
- **Request-time compute is confined to an enumerated dynamic surface** —
  a single Request-Time Middleware layer plus a small set of Route
  Handlers and one dynamic page, and nothing else:
  - the **Request-Time Middleware**, which runs on every inbound request
    to a non-static path and performs exactly three duties: Locale routing
    and browser-language detection (ADR 00-005), the fail-closed password
    gate on the Admin Console, and canonicalization of Locale-prefixed QR
    paths to the bare QR Redirect Route (ADR 00-003);
  - the QR Redirect Route read (ADR 00-003), Edge-capable;
  - the Admin Console write path, which persists Site Config through the
    Hosting Platform's API;
  - the single checkout Route Handler on the **Node runtime** (required by
    the PSP SDK), which creates Checkout Sessions (ADR 00-004);
  - the **post-checkout session-status read**: the localized
    post-checkout success page renders per request on the Node runtime
    and performs a single read-only retrieval of the just-created
    Checkout Session through the PSP SDK, to distinguish a paid outcome
    from an asynchronous pending-payment state such as a Multibanco
    reference awaiting payment (ADR 00-004). The read is implemented
    directly in the page — not inside the checkout Route Handler — reads
    nothing else, mutates nothing, and degrades to a generic
    post-checkout state when the PSP is unreachable;
  - the **like counter Route Handler**, which serves the Interaction
    Row's shared like counts and records per-visitor like toggles for
    Post Cards (ADR 03-002) — reads and writes against the managed
    store below, deduplicating each toggle per Post Card by the
    visitor's anonymous client-held Like Token, hardened like the
    checkout endpoint (input caps, IP rate limiting, fail-closed);
  - the **stock-notification Route Handler** on the Node runtime,
    which records a visitor's consented email into the Stock
    Notification List when the Simplified Purchase Surface's
    Pre-order state is submitted (ADR 00-010) — writes against the
    managed store below in a dedicated per-Variant keyspace, hardened
    like the checkout and like counter endpoints (input caps, IP rate
    limiting, fail-closed) and sharing the Purchase-Surface Gate
    posture of ADR 00-004: it answers unavailable while the gate is
    closed.
- **Small shared request-time state persists in a managed Redis store
  provisioned through the Hosting Platform's marketplace** — the
  platform-native choice for small shared request-time state beyond
  Edge Config's operator-configuration scope. It holds per-post like
  dedup records that feed aggregate counters only (ADR 03-002, ADR
  00-008) and, in a dedicated per-Variant keyspace never joined to
  them, the Stock Notification List of consented visitor emails
  (ADR 00-010) —
  the Storefront's first persisted personal data, held under the
  per-feature consent posture of ADR 00-008. When the store is
  unconfigured or unreachable, the Interaction Row degrades to
  authored base counts with toggling disabled and the Pre-order
  capture answers a graceful unavailable state rather than failing.
- No other inbound request-time capability exists or may be added without a
  new ADR — this boundary forecloses webhook receivers, additional
  middleware duties beyond the three enumerated, any additional dynamic
  endpoints, and any other request-time page rendering or data reads
  beyond those enumerated above.
- **Hosting Platform: Vercel**, the framework-native platform for Next.js:
  global CDN, Edge Config, Node and Edge runtimes for Route Handlers, Git-
  integrated preview and production deployments, TLS on the Store Domain,
  and platform-native analytics (ADR 00-008).
- Deploys are driven by the Hosting Platform's Git integration (previews per
  change, production from the production branch); CI is a quality gate only
  (ADR 00-007), never a deploy mechanism.
- The Admin Console is password-gated at the edge by the Request-Time
  Middleware and fails closed when no credential is configured.

## Consequences

**Positive:**
- One platform serves everything — static pages, the QR Redirect Route,
  operator toggles, the Admin Console, and checkout — with no second hosting
  provider or deploy pipeline.
- Edge Config gives the operator redeploy-free control (sections, chrome,
  the Stock Flag, QR destination) with an always-safe fallback to
  defaults.
- Static generation plus edge delivery gives best-possible latency and Core
  Web Vitals for the primary market.
- Git-integrated preview deployments make every change reviewable in
  production-identical conditions.
- The dynamic surface is small and enumerated — minimal attack area,
  minimal operational surface.
- One marketplace-provisioned store serves every small shared-state
  need — like dedup records and the Stock Notification List — under a
  single lazy, fail-closed posture.

**Negative / trade-offs:**
- Vendor coupling: Edge Config, the marketplace Redis store, Route Handler
  runtimes, and Git-integrated deploys are Hosting-Platform-specific;
  migrating hosts means re-platforming those capabilities (the static
  output itself remains portable).
- Request-time Edge Config reads are a live dependency for toggles and the
  QR destination; mitigated by default-fallback behavior but not eliminable.
- The like counter store is a second live request-time data dependency;
  the degrade-to-base fallback of ADR 03-002 bounds its blast radius, but
  shared counts silently revert to authored values while it is down.
- The managed store now holds personal data — the Stock Notification
  List's consented emails — so its compromise or misconfiguration
  touches real data, and the purpose-limitation, retention, and
  deletion obligations of ADR 00-008 and ADR 00-010 apply to it.
- The post-checkout session-status read is a live PSP dependency at page
  render time; mitigated by a degrade-to-generic fallback, it extends the
  dynamic surface beyond the Request-Time Middleware and Route Handlers
  for the first time.
- Commercial use requires an appropriate (paid) platform tier — a recurring
  cost the prior static-host-free-tier model did not have.
- The Request-Time Middleware and the Route Handlers are the attack
  surface; each must be hardened (input caps, rate limiting, fail-closed
  auth) and the enumerated set must not grow silently.
- Any content change still requires a rebuild and redeploy (acceptable:
  catalog changes are infrequent and deliberate).

## Alternatives Considered

- **Cloudflare Pages + Pages Functions (paired with an Astro rebuild)** —
  Rejected together with the greenfield direction in ADR 00-001: with the
  Next.js codebase recovered, it would sacrifice the working Edge Config
  toggles, Admin Console, and middleware-based Locale routing while adding a
  parallel functions platform — more platforms, more rework, no gained
  capability.
- **Pure static export to object storage or GitHub Pages** — Rejected:
  cannot serve Edge Config reads, i18n middleware, or Route Handlers; the
  QR Redirect Route and checkout would be pushed onto a separate platform,
  fragmenting the Store Domain's routing and the permanence guarantee.
- **Server-side rendering for all pages** — Rejected: adds request-time
  rendering cost and cache complexity to serve content that is identical
  for every visitor; the only request-time need is the enumerated
  dynamic surface (Request-Time Middleware, Route Handlers, and the
  post-checkout session-status read) plus Edge Config reads.
- **A static host plus a separate functions platform** — Rejected:
  fragments deployment, routing, and operations across two providers for
  capabilities one platform already provides natively.
- **Self-managed hosting (VPS, bare metal)** — Rejected: maximum operations
  burden for minimum benefit; contradicts the low-operations requirement.
