# ADR 00-007: Quality Tooling and CI — Strict Static Analysis, Automated Gate, Tested Contracts

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-002 (Rendering and Hosting Model)
ADR 00-003 (Permanent QR Redirect Route)
ADR 00-004 (Commerce and Checkout)

## Context

The project is maintained by a very small team, so quality must be enforced by
tooling, not by review bandwidth. The Storefront requires a complete,
uniformly enforced baseline covering type safety, static analysis, formatting,
and testing. The Storefront has hard public contracts that must never regress
— chiefly the QR Redirect Route (ADR 00-003) and the checkout flow
(ADR 00-004) — so testing must exercise real built output, not just units.
Continuous integration must gate changes before they reach production, while
deployment itself is driven by the Hosting Platform's Git integration
(ADR 00-002): CI is a quality gate, not a deploy mechanism. Version control is
mandatory for all tracked work, and the repository follows a shared-branch
convention. Identifier hygiene (no real-world identifiers in tracked files)
is a mandatory project rule that tooling should help uphold, and secrets live
only in environment variables — never in tracked files.

## Decision

A strict, automated quality baseline is enforced through the repository and
CI:

- **Version control:** git is the mandatory version-control system for all
  tracked work; the shared-branch convention (`develop` → `staging` →
  `master`, production released from the production branch via the Hosting
  Platform's Git integration) is kept; and no commits are made without
  explicit user instruction.
- **Type safety:** TypeScript in strict mode is the language for all site
  code, validated by the compiler as a blocking check.
- **Lint and format:** ESLint — with the framework's recommended
  configuration, wired directly rather than through deprecated wrapper
  commands — and Prettier define a single enforced style. Lint and format
  checks are blocking gates.
- **Testing:**
  - Unit tests cover logic with real behavior — Cart operations and
    Purchase Cap clamping, Product Data integrity, message-catalog parity
    across Locales, Site Config normalization and fallback.
  - End-to-end tests run against the production-built application and
    verify the public contracts: both Locale trees render, root Locale
    detection defaults correctly, the QR Redirect Route resolves to its
    destination and falls back safely, the Admin Console fails closed
    without credentials, a product can be taken through the checkout
    handoff, and sold-out items cannot be purchased.
- **CI:** a hosted continuous-integration gate (GitHub Actions) verifies the
  complete quality baseline — install, lint, format check, typecheck, unit
  tests, production build — on every change; merges are gated by these
  automated checks. CI never deploys: previews and production deploys are
  owned by the Hosting Platform's Git integration (ADR 00-002).
- **Secrets and hygiene:** secrets exist only as environment variables in
  the Hosting Platform and in untracked local env files — never in tracked
  files; tracked files carry no real-world identifiers, supported by review
  and secret/identifier scanning.

## Consequences

**Positive:**
- Quality is enforced automatically on every change; the small team gains a
  reliable safety net without manual review overhead.
- End-to-end tests against production-built output protect the permanent
  contracts (QR Redirect Route, checkout handoff, admin fail-closed) from
  silent regressions.
- A single enforced style prevents bikeshedding and keeps diffs clean.
- CI-as-gate plus platform-driven deploys gives each system a single
  responsibility: CI proves quality, the platform ships.
- The intact git history is preserved and extended under a known branch
  convention — blame and release lineage stay continuous.

**Negative / trade-offs:**
- Lint/format/test tooling adds dependencies and CI time; the project's
  lint stack must be brought up to current flat-config ESLint since the
  framework's legacy wrapper is deprecated.
- End-to-end tests against built output are slower than unit tests and can
  be flaky if not scoped tightly; they are kept few and focused on
  contracts.
- Strict TypeScript and lint gates add friction to quick experiments.
- Requiring explicit instruction for every commit adds a deliberate manual
  step to repository work.

## Alternatives Considered

- **No CI / local-only checks** — Rejected: with no enforced gate,
  regressions to public contracts (especially the QR Redirect Route) can
  ship silently; unacceptable for a store.
- **CI-driven deployments (CI builds and pushes to the host)** — Rejected:
  the Hosting Platform's Git integration already provides preview and
  production deploys natively; duplicating deploys in CI creates a second
  release path, doubles secrets surface, and adds failure modes for no
  benefit.
- **Biome instead of ESLint+Prettier** — Rejected for now: faster and
  consolidated, but its plugin ecosystem and the framework's official
  integration are less mature than the ESLint+Prettier combination for this
  stack; may be revisited if tooling friction becomes a problem.
- **Unit tests only, no end-to-end** — Rejected: unit tests cannot verify
  the built-app contracts (redirect resolution, locale trees, admin
  fail-closed, checkout handoff) that carry the business risk.
- **Manual deployment** — Rejected: error-prone and unverifiable; the
  platform's Git-integrated deploys are reproducible and previewable per
  change.
