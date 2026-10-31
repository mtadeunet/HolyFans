# ADR 00-001: Application Framework — Next.js (App Router)

## Status

Proposed

## Related

ADR 00-002 (Rendering and Hosting Model)
ADR 00-005 (Internationalization)
ADR 03-001 (Design System and Visual Identity)

## Context

The Storefront must present a premium brand: visually rich pages, fast first
loads, smooth transitions, and careful typography. The Product Catalog is small
and changes infrequently. Interactivity is limited to a few isolated concerns —
a Cart, product galleries, Variant selection, and Locale switching — while the
vast majority of each page is static content. The site must be maintainable by
a very small team.

Decisively, the project already has a **working implementation**: a complete
single-product storefront built on Next.js (App Router), React, strict
TypeScript, and Tailwind CSS — with framework-integrated i18n, a client-side
Cart, an operator Admin Console, and Hosting Platform integrations already
running in production shape. Continuity of a proven, working codebase — and
avoiding the risk, cost, and regression surface of a rewrite — is itself an
architectural constraint. TypeScript and a component-based authoring model are
required, and interactive components must be addable selectively without
adopting a heavy client-side application architecture.

## Decision

The Storefront is built with **Next.js (App Router)**, React, and strict
TypeScript as its single application framework.

- Pages are composed as React Server Components and rendered to static output
  per Locale at build time wherever content allows; the framework's hybrid
  rendering provides the model defined in ADR 00-002.
- Interactive concerns are implemented as Islands — client-side components
  hydrated only where needed (Cart, galleries, Variant selection, modals) —
  keeping client-side JavaScript scoped rather than pervasive.
- The framework's integrated internationalization layer provides the Locale
  routing and detection defined in ADR 00-005.
- The framework's image component provides the media handling defined in
  ADR 00-006.
- The framework's Request-Time Middleware and Route Handlers together
  provide the request-time compute boundary defined in ADR 00-002; Site
  Config reads come from Edge Config.
- Product Data and page copy are authored in the repository alongside the
  code, keeping catalog changes inside the normal code workflow.

## Consequences

**Positive:**
- Zero rewrite risk: the working storefront — its sections, Cart, i18n,
  Admin Console, and QR Redirect Route — is preserved and extended instead of
  re-implemented.
- Mature ecosystem and talent pool; off-the-shelf commerce and tooling
  integrations exist for the framework.
- Server Components keep client-side JavaScript limited to Islands where
  interactivity is actually needed, supporting premium load performance.
- First-class alignment with the Hosting Platform (ADR 00-002): Route
  Handlers, Edge Config, preview deployments, and Cookieless Analytics are
  native to the same stack.
- Strict TypeScript and a component model match the team's existing skills.

**Negative / trade-offs:**
- The framework is heavier than a pure static generator: server-runtime
  semantics exist throughout, so the dynamic-surface boundary of ADR 00-002
  must be enforced deliberately rather than emerging naturally.
- Framework upgrades are recurring maintenance on a fast-moving release
  cadence.
- Islands still ship JavaScript; discipline is required to keep
  interactivity opt-in rather than drifting toward a heavy client-side
  application.
- Platform-integrated features (Edge Config, Route Handlers) couple the
  application to the Hosting Platform more than a portable static export
  would.

## Alternatives Considered

- **Astro static-first rebuild (greenfield)** — Evaluated when the codebase
  was believed unrecoverable; rejected once the working Next.js source was
  recovered in full. A rebuild would discard a functioning storefront and
  its intact git history for marginal client-JavaScript savings that the
  Server Component / Island model already delivers; the greenfield premise
  (total source loss) no longer exists.
- **Static-export-only usage of the current framework** — Rejected: the
  Storefront relies on request-time capabilities (Edge Config reads, i18n
  middleware routing/detection, Route Handlers) that a static export cannot
  serve; exporting would mean re-architecting working features away.
- **Shopify (hosted storefront or headless)** — Rejected as a framework
  foundation: hosted themes constrain the premium custom design required,
  and headless usage adds a second stack plus Storefront API complexity and
  ongoing subscription cost for a tiny catalog. (Evaluated as a commerce
  backend in ADR 00-004 and rejected there too.)
- **Hosted site builders / budget commerce platforms (e.g., Big Cartel,
  Ecwid)** — Rejected: template-limited design, weak localization control,
  and insufficient control over the premium presentation layer.
- **General-purpose SPA/SSR frameworks (SvelteKit, Remix, Nuxt)** — Rejected:
  they offer no advantage over the framework already running the Storefront;
  migration cost buys parity, not capability.
- **Classic static generators (Hugo, Eleventy)** — Rejected: weaker
  TypeScript/component ergonomics and a poorer story for the interactive
  Islands (Cart, galleries) than the current stack.
