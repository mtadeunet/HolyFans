# ADR 00-006: Media and Asset Pipeline — Framework-Optimized, In-Repo Masters

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-002 (Rendering and Hosting Model)
ADR 00-003 (Permanent QR Redirect Route)
ADR 00-004 (Commerce and Checkout)
ADR 00-007 (Quality Tooling and CI)
ADR 03-001 (Design System and Visual Identity)

## Context

Premium clothing sells on imagery: product photography must look exceptional
and load fast, especially on mobile connections in the primary market. Imagery
comes from product photography and may include AI-generated or AI-assisted
visuals for editorial and mockup purposes. All image content is SFW and
on-brand. Brand assets — the logo and related marks — are required both by the
site and by offline tooling such as the QR Generator. Asset handling must be
reproducible: anyone building the repo must produce identical, fully optimized
output without depending on external services or files that live outside the
repository.

## Decision

Media is handled by an **in-repo masters model with framework image
optimization**:

- **Master images are committed to the repo.** Original high-resolution
  product and editorial images are versioned alongside the code; the repo is
  the single source of truth for visual assets.
- **Served images go through the framework's image optimization** — the
  image component emits modern formats (AVIF/WebP) at responsive sizes
  selected per viewport. No hand-optimized derivatives and no external image
  service are used. Served imagery originates from in-repo masters; remote
  image sources, if ever needed, are confined to an explicit allowlist —
  never an open wildcard.
- **Art direction is deliberate:** hero and product imagery is curated and
  cropped with intent rather than auto-processed en masse; premium
  presentation outranks automation.
- **AI-generated imagery is permitted** for product mockups and editorial
  content, subject to two gates: it must pass a visual quality/brand review
  before commit, and it must be consistent with the SFW, premium Christian
  brand. AI imagery is not distinguished in the pipeline — it enters as
  ordinary masters and is held to the same standard.
- **Brand assets live in the repo.** The owner's logo masters — currently
  high-resolution raster marks committed to a brand-assets location — are
  the canonical brand sources: the site uses them directly and the
  operator's local QR Generator reads its logo input from them. A vector
  master is the ideal form for print and QR work at arbitrary scales; it
  is desirable but not a launch blocker.
- **The QR Generator is local operator tooling, not repository source.**
  It lives in the operator's untracked tooling area and runs entirely
  offline; it is not part of the Storefront runtime, build, or tracked
  source.
- **QR artifacts are generated locally and never committed.** A rendered
  QR encodes the real store URL — a real-world identifier — so tracking
  it would violate identifier hygiene (ADR 00-007). The Storefront
  neither generates nor serves QR images; its only QR-related surface is
  the permanent redirect route that printed codes point at (ADR 00-003).

## Consequences

**Positive:**
- Reproducible builds: cloning the repo is sufficient to build the complete
  optimized site; no external asset service is on the critical path.
- The framework's optimizer delivers modern formats and responsive images
  per request context, integrated with the same component model the site
  already uses.
- Committing brand sources makes the build fully self-contained and gives
  local tooling a canonical brand input — the QR Generator reads its logo
  from the repository's committed masters.
- The operator can regenerate branded QR artifacts locally at any time —
  for new campaigns, reprints, or replacements — with no build, deploy,
  or commit required.

**Negative / trade-offs:**
- Binary masters grow the repository over time; acceptable at small-catalog
  scale but needs revisiting if the catalog grows large (Git LFS or external
  storage would require a future ADR).
- Raster logo masters cannot scale infinitely for print/QR use; a vector
  master should be obtained when available (tracked as an owner dependency,
  not a blocker).
- Framework image optimization on the Hosting Platform is a per-request,
  metered platform capability — bounded by the small catalog but a platform
  quota to watch, and platform-coupled like the rest of ADR 00-002. It is
  a platform-serving capability applied to otherwise-static assets, not an
  additional dynamic surface: ADR 00-002's enumeration governs routes and
  handlers, not asset delivery.
- Neither the QR Generator nor its artifacts are tracked, so the repo
  cannot reproduce printed materials; regenerating them relies on the
  operator's local setup rather than anything the repository guarantees.

## Alternatives Considered

- **External digital-asset management or image CDN (e.g., Cloudinary,
  Imgix, CMS media library)** — Rejected: recurring cost and an external
  dependency for a small, stable asset set; adds a network service to the
  critical path for no benefit at this scale.
- **A separate runtime image service (non-framework)** — Rejected: an
  additional vendor and latency for content the framework already
  optimizes natively.
- **Build-time-only derivative generation (pre-rendered responsive sets)** —
  Rejected: duplicates what the framework's image component already emits
  per viewport, adds a bespoke pipeline to maintain, and produces fixed
  breakpoints less adaptive than the optimizer's per-request selection.
- **No optimization (serve originals)** — Rejected: unacceptable performance
  and bandwidth cost; directly harms the premium experience on mobile.
- **Git LFS for masters from the start** — Rejected as premature: the asset
  set is small; LFS adds tooling friction and a remote dependency. Adopted
  only if repository growth demands it (requires a future ADR).
- **Regenerate images/QRs on demand instead of committing outputs** —
  Adopted for QR artifacts: a rendered QR encodes the real store URL and
  can never be a tracked file (identifier hygiene, ADR 00-007), so the
  operator regenerates it locally on demand. For imagery the split is
  different: masters are committed sources, and only the optimized
  derivatives are generated — per request — by the framework.
