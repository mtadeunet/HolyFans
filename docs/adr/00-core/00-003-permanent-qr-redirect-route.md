# ADR 00-003: Permanent QR Redirect Route

## Status

Proposed

## Related

ADR 00-002 (Rendering and Hosting Model)
ADR 00-005 (Internationalization)

## Context

Printed materials bearing a branded QR code already exist. The QR code encodes
a URL on the Store Domain ending in the path `/qrcoderedirect`. Once printed,
this URL can never be changed: any architecture must serve that route
indefinitely, on any host, under any future redesign. The route is also a
business asset — it is the entry point for all physical marketing traffic, and
its visits are a meaningful signal (ADR 00-008). The destination it leads to
may evolve over time (homepage, a campaign landing page, a social profile, a
product drop), so the mechanism must decouple the permanent route from its
target — and ideally let the operator retarget it without involving a
developer or a redeploy.

## Decision

The QR Redirect Route is a **permanent, dynamically retargetable redirect** at
the path `/qrcoderedirect` on the Store Domain.

- The route is implemented as a dedicated **Route Handler** — the canonical
  mechanism — which reads its destination from Site Config (Edge Config) at
  request time and issues an HTTP redirect to it.
- The destination is operator-editable through the Admin Console: the route
  can be repointed to a campaign, product drop, or external profile at any
  time, without a redeploy and without reprinting materials.
- The route MUST always resolve successfully (never 404): when no destination
  is configured, or the configuration cannot be read, it redirects to the
  site root — which forwards the visitor to their detected Locale per
  ADR 00-005.
- The route is deliberately locale-neutral: it sits outside the Locale tree,
  and Locale-prefixed variants of the path canonicalize to the bare route.
- The route carries `noindex` — it is a handoff artifact, not indexable
  content — and the Admin Console is likewise excluded from indexing.
- This route is part of the Storefront's public contract; it is covered by an
  end-to-end-tested invariant (ADR 00-007), and changes that would break it
  are architectural regressions.

## Consequences

**Positive:**
- The destination can be repointed by the operator in seconds through the
  Admin Console — no build, deploy, or developer involvement — a strictly
  stronger operational property than any build-time mechanism.
- The always-resolves guarantee holds even on Edge Config failure, via the
  site-root fallback.
- The Route Handler emits a real HTTP redirect — fast, explicit, and visible
  to tests, crawlers, and the platform's request observability (ADR 00-008).
- Locale-neutral design lets campaigns target any Locale or even external
  destinations.

**Negative / trade-offs:**
- Request-time dependency on Edge Config: an outage or empty value degrades
  to the site-root fallback rather than the intended target — acceptable
  because the fallback always resolves, but repointing correctness depends
  on the store being healthy.
- The mechanism is bound to the Hosting Platform's Route Handler capability;
  re-platforming would require re-implementing the route (the guarantee is
  preserved by ADR 00-002's hybrid boundary, not by portability of this
  mechanism itself).
- A misconfigured destination (typo, dead URL) takes effect immediately;
  the Admin Console is the control point and changes must be verified
  against the e2e invariant.

## Alternatives Considered

- **Static redirect page generated at build time** — Rejected as the
  canonical mechanism: a build-time artifact cannot be repointed without a
  rebuild and redeploy, offers no operator control, and is strictly weaker
  than the Route Handler + Site Config mechanism the platform already
  provides. It provided the baseline guarantee before the hybrid hosting
  model was adopted.
- **Host-level redirect only (server/platform 301)** — Rejected as the sole
  mechanism: a redirect configured at the host layer is invisible to the
  application and to tests, cannot be operator-edited, and ties a printed-
  forever guarantee to platform configuration outside the codebase.
- **Route within the Locale tree (e.g., under a Locale prefix)** — Rejected:
  the printed URL is locale-neutral; binding it to one Locale would force a
  language on every scan and complicate the permanence contract. Locale-
  prefixed variants instead canonicalize to the bare route.
- **Point the QR directly at the homepage** — Rejected (cannot be done — the
  URL is already printed; recorded for completeness): had it been possible,
  it would have removed the redirect layer, but the route is an immutable
  external fact.
- **Client-only redirect inside a shared layout/script** — Rejected:
  implicit, fragile, dependent on JavaScript, and invisible to crawlers and
  request-level observability; a permanent contract demands an explicit,
  dedicated artifact.
