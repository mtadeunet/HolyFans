# ADR 00-008: Analytics and Consent — Cookieless, Privacy-First Measurement

## Status

Proposed

## Related

ADR 00-002 (Rendering and Hosting Model)
ADR 00-003 (Permanent QR Redirect Route)
ADR 00-004 (Commerce and Checkout)
ADR 00-010 (Pre-order and Stock Notification)
ADR 03-002 (Landing Page Composition)

## Context

The operator needs to understand Storefront traffic — especially scans of the
printed QR code arriving at the QR Redirect Route, which are the primary
measure of physical marketing effectiveness — plus basic visit, conversion,
and popular-product signals. As an EU business serving consumers, the store
operates under GDPR/ePrivacy expectations. A consent banner would degrade the
premium first impression the brand depends on, so measurement should ideally
require no consent flow at all. The chosen approach must be cheap, low-
maintenance, and honest about what it does not collect. Because the QR
Redirect Route resolves server-side (an HTTP redirect from a Route Handler),
client-side beacons alone cannot observe it — its measurement needs a
request-level signal. Beyond measurement, the purchase surface's
Pre-order state (ADR 00-010) introduces the first feature that persists
visitor-supplied personal data — a consented email — so the posture must
state precisely where personal data is permitted at all.

## Decision

Measurement uses **Cookieless Analytics only** — privacy-first mechanisms
that set no cookies and collect no personal data, so no consent banner is
required. Beyond measurement, the Storefront persists **no personal data
without explicit per-feature consent** — the only sanctioned collection
is the purpose-bound capture below.

- The mechanism: **the Hosting Platform's native privacy-first analytics**
  (the platform's web-analytics integration already wired into the
  Storefront) — cookieless, aggregate-only, and native to the chosen
  Hosting Platform (ADR 00-002). It provides visit, referral, geography,
  and page-level data without personal-data collection.
- The QR Redirect Route is a first-class measured signal: because the route
  resolves server-side before any client script runs, its visits are
  captured through the Hosting Platform's request-level observability
  (function/route request metrics) rather than the client beacon. QR-scan
  traffic MUST be visible in reporting either way.
- E-commerce conversion is measured at the source: completed orders and
  revenue are read from the PSP's own reporting (ADR 00-004), not from a
  client-side tracking tag.
- Anonymous feature tokens are within the posture: an interactive feature
  may use a self-generated, per-browser token held in client-side storage
  — never a cookie, never server-issued — sent only to that feature's own
  endpoint and feeding aggregate counters only. Such a token identifies
  no person, joins to no identity or analytics surface, and requires no
  consent flow; the Interaction Row's Like Token (ADR 03-002) is the
  sanctioned instance.
- Consented, purpose-bound personal data is within the expanded posture:
  a feature may persist a visitor-supplied datum only when consent
  language stating the single purpose is rendered at the capture point
  in the visitor's Locale, the datum serves that purpose alone (no
  marketing reuse without separate consent), retention ends when the
  purpose completes or the operator purges the record, an operator
  export-and-clear path exists as the deletion mechanism, and it joins
  to no feature token, identity, or analytics surface. The Stock
  Notification List's visitor emails (ADR 00-010) are the sanctioned
  instance — the first personal data the Storefront persists.
- No consent-management platform, cookie banner, or tag manager is part of
  the architecture. If a future requirement ever demands identified or
  cross-session tracking, it requires a new ADR and a consent mechanism.
- The analytics mechanism must not degrade page performance or the premium
  experience; it loads unobtrusively and is not a business-critical runtime
  dependency.

## Consequences

**Positive:**
- Zero consent-banner friction preserves the premium first impression and
  stays comfortably within GDPR/ePrivacy expectations.
- Native to the Hosting Platform: already integrated, near-zero
  maintenance, no extra third-party script or vendor.
- QR-scan traffic — a key business metric — is captured at request level,
  immune to client-side blocking (the redirect never executes a browser
  beacon).
- One less external runtime dependency and no tag-management surface.

**Negative / trade-offs:**
- Cookieless analytics cannot do per-user journeys, retention cohorts, or
  cross-session attribution; insights are aggregate only.
- QR-scan measurement depends on platform request observability rather
  than the analytics dashboard — a different reporting surface the operator
  must know to check.
- Tied to the Hosting Platform's analytics feature; migrating hosts changes
  the mechanism (not the data contract).
- Marketing attribution beyond aggregate referrals is not available — paid
  campaigns would not get granular tracking without a future ADR.
- Feature tokens persist a pseudonymous per-browser value in client
  storage; bounded by the aggregate-only, no-identity, no-analytics rules
  above, the posture now depends on every feature honoring them.
- The Storefront now persists personal data: the guarantees of the
  consented-capture rule — consent copy at the capture point, single
  stated purpose, bounded retention, an operator deletion path — depend
  on every collecting feature honoring them; the no-personal-data
  simplicity is traded for a bounded per-feature consent model.

## Alternatives Considered

- **Cloudflare Web Analytics** — Rejected: equivalent privacy posture, but
  not native to the chosen Hosting Platform; the platform-native mechanism
  already provides the needed data with zero added dependency. (Was the
  paired choice under the rejected Astro/Cloudflare direction.)
- **Google Analytics 4 (+ consent banner)** — Rejected: requires a consent
  flow that harms the premium first impression, adds a heavy client tag,
  and collects far more than the business needs at this scale.
- **Plausible / privacy-first paid analytics** — Rejected for cost only:
  architecturally equivalent and an acceptable substitute, but the chosen
  mechanism provides the needed data at no cost; Plausible remains the
  fallback if hosting changes.
- **Self-hosted analytics (e.g., Matomo, Umami on own infra)** — Rejected:
  introduces a server and database to maintain — contradicts the low-
  operations model.
- **No analytics** — Rejected: leaves the operator blind to QR-scan traffic
  and product interest, which are primary business signals.
- **A custom server-side/first-party tracking pipeline** — Rejected:
  disproportionate complexity for aggregate traffic stats; platform request
  observability already covers the QR signal, and no business requirement
  justifies more.
- **A consent-management platform or banner for consented captures** —
  Rejected: per-purpose consent rendered at the collection point
  satisfies the requirement without degrading the premium first
  impression; a CMP stays unwarranted while capture remains
  single-purpose.
