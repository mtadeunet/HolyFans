# ADR 00-002: Rendering and Hosting Model — Hybrid Static Generation on Vercel

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-003 (Permanent QR Redirect Route)
ADR 00-004 (Commerce and Checkout)
ADR 00-005 (Internationalization)
ADR 00-007 (Quality Tooling and CI)
ADR 00-008 (Analytics and Consent)
ADR 00-010 (Pre-order and Stock Notification)
ADR 00-013 (Email Delivery Channel)
ADR 00-014 (Contact Channel)
ADR 00-015 (Transactional Notifications)
ADR 03-002 (Landing Page Composition)

## Context

The Storefront's content is almost entirely static: catalog pages, product
pages, brand pages, and legal pages change only when the Product Catalog or
copy changes — a build-time event, not a request-time event. Premium
positioning demands excellent load performance and reliability for visitors in
Portugal. Alongside the static content, the business needs a small set of
request-time capabilities: the permanent QR Redirect Route with a destination
that can be retargeted without redeploys (ADR 00-003), operator-controlled
Site Config toggles, an Admin Console write path plus request-time
reads of the like store's aggregate state and the Stock Notification
List — including its per-Variant purge path — the creation of
Checkout Sessions with the PSP, a request-time read of the created
Session's payment status on the post-checkout success page (ADR 00-004),
shared like counters for the feed's Interaction Row (ADR 03-002),
consented email capture for the purchase surface's Pre-order state
(ADR 00-010), the Contact Form's relay to the Support Inbox
(ADR 00-014), the PSP event receiver feeding the Order Ledger and
the order-lifecycle emails (ADR 00-015), and the Admin Console's
Restock Notification send and its Orders section's Order Ledger
reads and edits (ADR 00-015).
Hosting must be inexpensive, low-
operations, able to serve the QR Redirect Route indefinitely, and present in
Europe for the primary market.

## Decision

The Storefront runs a **hybrid model on the Vercel Hosting Platform**:

- **Storefront pages are Static Site Generation output served from the
  Hosting Platform's edge network** — every page, for every Locale, is
  built output delivered at the edge; per-request rendering is confined
  to an enumerated set. The enumerated render-per-request pages are the
  **Locale tree** — the Locale layout declares request-time rendering,
  so every Locale-prefixed page (the landing, the Product Page and
  Contact Page, and the Profile Routes of ADR 03-004) composes per
  request, performing the Site Config read and, where applicable,
  the managed-store Model Profile read and profiles-folder
  enumeration enumerated below —
  and, within it, the **post-checkout success page**, which
  additionally performs the session-status read below on the Node
  runtime. Operator edits to Site Config and Model Profile records
  apply within seconds without a rebuild; authored content —
  including the profiles folders that determine Model Profile
  existence — still changes only at build time.
- **Site Config is read from Edge Config at request time** — the Hosting
  Platform's edge-replicated key-value store holds section/chrome
  visibility, the per-Variant Stock Flags (ADR 00-010), and the QR
  Redirect Route
  destination, so operator changes apply within
  seconds without a rebuild. Reads degrade to safe defaults when the store
  is unavailable; this read, the managed-store Model Profile read,
  and the profiles-folder enumeration of `public/images/profiles/` —
  the folder listing plus each profile folder's post-file `readdir`
  and caption-sidecar `.txt` reads (ADR 03-004) — are the only
  request-time data dependencies in
  storefront page composition other than the post-checkout
  session-status read enumerated below.
- **Request-time compute is confined to an enumerated dynamic surface** —
  a single Request-Time Middleware layer, a small set of Route
  Handlers, and the render-per-request pages enumerated above, and
  nothing else:
  - the **Request-Time Middleware**, which runs on every inbound request
    to a non-static path and performs exactly three duties: Locale routing
    and country-signal Locale resolution (ADR 00-005), the fail-closed password
    gate on the Admin Console, and canonicalization of Locale-prefixed QR
    paths to the bare QR Redirect Route (ADR 00-003);
  - the QR Redirect Route read (ADR 00-003), Edge-capable;
  - the **Admin Console surface**: a write path that persists Site
    Config through the Hosting Platform's API, plus, against the
    managed store below, a request-time read of the like store's
    aggregate state — per-post totals, per-post last-like
    timestamps, and store health — aggregates only, never Like
    Token membership (ADR 00-008); a request-time read of the Stock
    Notification List — the individual consented emails and their
    consent records per Variant, operator-only and never joined to
    Like Tokens or analytics, the export half of the ADR 00-008
    export-and-clear path (ADR 00-010); and a per-Variant purge
    write that deletes a Variant's Stock Notification List on the
    operator's clear action, the clear half of that path
    (ADR 00-010); and a per-Variant email-send action that delivers
    the Restock Notification to a Variant's list through the
    delivery channel and removes each successfully sent address —
    the send-and-clear half of ADR 00-015; and the Profiles tab's
    read-and-write of the Model Profile records — the `saveProfile`
    action persisting one `profile:<slug>` document for an existing
    profiles folder (ADR 03-004); and the Orders section's
    request-time read of the Order Ledger — the `orders` index and
    each `order:<sessionId>` document rendered newest-first with
    per-order expandable detail — plus the server action saving an
    order's Order Status and `trackingId` back to its document, the
    operator fields the PSP event receiver's rewrites preserve —
    an unconfigured managed store rendering an explicit banner,
    consistent with the console's other managed-store surfaces
    (ADR 00-015);
  - the single checkout Route Handler on the **Node runtime** (required by
    the PSP SDK), which creates Checkout Sessions (ADR 00-004) and reads
    Site Config at request time for the free-shipping threshold it
    enforces (ADR 03-003) — the same enumerated Site Config channel the
    Locale layout already uses;
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
    store below and, for the `pp-` profile-post id domain (ADR
    03-004), the profiles filesystem: the count domain its GET serves
    and the `pp-` id its POST validates both resolve through the
    profiles-folder listing, per-profile post-file `readdir`s, and
    caption-sidecar reads beside the `profile:<slug>` document
    reads, deduplicating each toggle per Post Card by the
    visitor's anonymous client-held Like Token, stamping each newly
    recorded like in a per-post last-like record for the Admin
    Console's aggregate view, and answering degraded reads with the
    authored base counts plus an explicit reason so failures surface
    rather than degrade silently; hardened like the checkout endpoint
    (input caps, IP rate limiting, fail-closed);
  - the **stock-notification Route Handler** on the Node runtime,
    which records a visitor's consented email into the Stock
    Notification List when the Simplified Purchase Surface's
    Pre-order state is submitted (ADR 00-010) — writes against the
    managed store below in a dedicated per-Variant keyspace, hardened
    like the checkout and like counter endpoints (input caps, IP rate
    limiting, fail-closed) and sharing the Purchase-Surface Gate
    posture of ADR 00-004: it answers unavailable while the gate is
    closed.
  - the **contact Route Handler** on the Node runtime, which relays a
    Contact Form submission to the Support Inbox through the
    Transactional Email Provider (ADR 00-013, ADR 00-014) — hardened
    like its siblings (input caps, IP rate limiting, a honeypot
    check, fail-closed), ungated by the Purchase-Surface Gate, and
    persisting nothing;
  - the **PSP event receiver** on the Node runtime — the sole inbound
    channel the boundary admits beyond visitor-facing endpoints: a
    signature-verified webhook endpoint the PSP calls with order
    lifecycle events, which persists each retrieved Checkout
    Session to the managed store's Order Ledger, sends the order
    emails of ADR 00-015 through the delivery channel, and
    deduplicates sends against the
    managed store. The verified signature is its hardening; it
    answers promptly and acknowledges undeliverable work rather than
    failing the PSP's retries.
- **Small shared request-time state persists in a managed Redis store
  provisioned through the Hosting Platform's marketplace** — the
  platform-native choice for small shared request-time state beyond
  Edge Config's operator-configuration scope. It holds per-post like
  dedup records and last-like timestamps that feed aggregate counters
  and the Admin Console's aggregate likes view only (ADR 03-002, ADR
  00-008) and — in a dedicated per-Variant keyspace never joined to
  the like records — the Stock Notification List of consented visitor
  emails (ADR 00-010); the PSP event receiver's per-session
  send-dedupe records and its Order Ledger — one
  `order:<sessionId>` JSON document per retrieved Checkout Session,
  its PSP-sourced fields rewritten per event beside the
  operator-managed Order Status and `trackingId` each rewrite
  preserves, plus an `orders` sorted set — session ids scored by
  session
  creation time, member uniqueness making the index idempotent
  across redeliveries — maintained newest-first as the order
  index — no TTL, retention indefinite and operator-managed
  (ADR 00-015); and, in a dedicated profiles
  keyspace — one
  `profile:<slug>` JSON document per existing profiles folder — the
  Model Profile operator overlays: sparse `{enabled, avatar, posts:
  Record<postId, override>}` documents, the post set itself being
  filesystem-derived (ADR 03-004) — the Stock Notification List
  being the Storefront's first persisted personal data, held under
  the per-feature consent posture of ADR 00-008, and the Order
  Ledger's customer names, emails, and shipping addresses the
  second, held as the transactional fulfillment/audit record under
  ADR 00-008's amended posture (ADR 00-015). Profile enumeration
  itself is filesystem-based — request-time
  `readdir`s of `public/images/profiles/` and of each profile's own
  folder, with the caption-sidecar `.txt` reads, performed by the
  Locale routes and by the like Route Handler's `pp-` paths — not a
  stored list. When the store is
  unconfigured or unreachable, the Interaction Row degrades to
  authored base counts with toggling disabled and a visible
  unavailable indicator — and the Admin Console surfaces the store's
  health — while the Pre-order
  capture answers a graceful unavailable state rather than failing,
  and no Model Profiles exist: the landing feed renders the authored
  interstitials only and Profile Routes resolve not-found (ADR
  03-004); the PSP event receiver acknowledges events without
  persisting or sending rather than failing the PSP's retries
  (ADR 00-015).
- No other inbound request-time capability exists or may be added without a
  new ADR — beyond the single enumerated PSP event receiver, this
  boundary forecloses further webhook receivers, additional
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
- **Environment and data isolation follow a three-tier model** — because
  environment variables are the only store-selection mechanism the
  Storefront uses, isolation is expressed entirely through env-var target
  scoping on the Hosting Platform:
  - the **development tier** — every deployment from `develop`,
    `staging`, and `feature/*` branches, plus local `next dev` — resolves
    the generic `preview`-targeted environment variables, which carry the
    dedicated development managed store (a second, disposable Upstash
    Redis database). `EDGE_CONFIG` and `VERCEL_EDGE_CONFIG_ID` are
    deliberately unset there (the platform tier permits a single Edge
    Config): Site Config reads fall back to `DEFAULT_SITE_CONFIG` and
    admin writes fail closed rather than touching the production Edge
    Config — the strongest possible isolation posture for
    operator-controlled content. Local development resolves the same
    development store through `.env.local`, which must never hold
    production store credentials; Site Config stays file-backed through
    `.site-config.local.json`.
  - the **preview tier** — deployments of the release-candidate branch
    (`master`) — resolves `preview`-targeted variables scoped to
    `gitBranch: master`, which carry the production managed store, the
    production Edge Config connection string (dedicated read token), and
    the production `NEXT_PUBLIC_*` values. Build-time-inlined public
    variables must already hold production values at this stage so a
    promoted deployment needs no rebuild.
  - the **production tier** — reached only by explicit promotion of a
    preview deployment (`vercel promote` or dashboard promote), never by
    automatic branch deploy: the project's production branch is set to a
    branch nothing pushes to (`release`), so `master` merges produce
    preview deployments gated behind manual promotion.
- The Admin Console is password-gated at the edge by the Request-Time
  Middleware and fails closed when no credential is configured.

## Consequences

**Positive:**
- One platform serves everything — static pages, the QR Redirect Route,
  operator toggles, the Admin Console, and checkout — with no second hosting
  provider or deploy pipeline.
- Edge Config gives the operator redeploy-free control (sections, chrome,
  the per-Variant Stock Flags, QR destination) with an always-safe fallback
  to defaults.
- Static generation plus edge delivery gives best-possible latency and Core
  Web Vitals for the primary market.
- Git-integrated preview deployments make every change reviewable in
  production-identical conditions.
- The dynamic surface is small and enumerated — minimal attack area,
  minimal operational surface.
- One marketplace-provisioned store serves every small shared-state
  need — like dedup records, the Stock Notification List, the
  send-dedupe records, the Order Ledger, and the Model Profile
  records — under a single lazy, fail-closed posture.

**Negative / trade-offs:**
- Vendor coupling: Edge Config, the marketplace Redis store, Route Handler
  runtimes, and Git-integrated deploys are Hosting-Platform-specific;
  migrating hosts means re-platforming those capabilities (the static
  output itself remains portable).
- Request-time Edge Config reads are a live dependency for toggles and the
  QR destination; mitigated by default-fallback behavior but not eliminable.
- The like counter store is a second live request-time data dependency;
  the degrade-to-base fallback of ADR 03-002 bounds its blast radius and
  the degradation is surfaced — an inline indicator on the row and the
  store health in the Admin Console — rather than silent.
- The managed store now holds personal data — the Stock Notification
  List's consented emails and the Order Ledger's customer names,
  emails, and shipping addresses — so its compromise or
  misconfiguration touches real data; the purpose-limitation,
  retention, and deletion obligations of ADR 00-008 and ADR 00-010
  apply to the list, while the ledger's indefinite retention is
  operator-managed under ADR 00-015.
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
  render-per-request pages enumerated above) plus the enumerated
  Edge Config and managed-store reads.
- **A static host plus a separate functions platform** — Rejected:
  fragments deployment, routing, and operations across two providers for
  capabilities one platform already provides natively.
- **Self-managed hosting (VPS, bare metal)** — Rejected: maximum operations
  burden for minimum benefit; contradicts the low-operations requirement.
