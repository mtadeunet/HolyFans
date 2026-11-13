# ADR 00-012: Platform Posture — Mobile-First with Full Desktop Support

## Status

Proposed

## Related

ADR 00-003 (Permanent QR Redirect Route)
ADR 00-006 (Media and Asset Pipeline)
ADR 00-007 (Quality Tooling and CI)
ADR 00-009 (WhatsApp Deep-Link Channels)
ADR 00-011 (Page Model and Product Routes)
ADR 03-001 (Design System and Visual Identity)
ADR 03-002 (Landing Page Composition)

## Context

No ADR to date names a primary device platform. Platform priority has so far
been decided implicitly, change by change — which means each layout, copy,
performance, and verification decision has re-litigated the same unstated
question: which form of the Storefront is the canonical one.

The signals already in the corpus point one way. The primary market shops
predominantly on phones. The QR Redirect Route (ADR 00-003) is the entry point
for all physical marketing traffic, and a printed QR code is scanned by a phone
camera — so the Storefront's first impression on that channel lands on a small
touchscreen. ADR 00-006 already optimizes media "especially on mobile
connections in the primary market," and ADR 00-009's contact channels are
mobile-native in the market they serve. At the same time, ADR 00-009 rejected
a mechanism that silently drops desktop support — the corpus already treats
desktop as a platform that must keep working, without ever saying so as a
posture.

ADR 03-002's Feed Shell collapses by column below desktop widths. Described
top-down, the rules leave the baseline direction unstated: is the three-column
form the composition, with small viewports receiving a reduced version of it —
or is the single-column form the composition, with wider viewports gaining
columns? The rendered result is identical either way, but the direction
decides where design effort, performance budget, and verification attention
concentrate first.

## Decision

The Storefront's platform posture is **mobile-first**: **mobile is the
Primary Platform** — the small-viewport, touch-first form is the canonical
baseline from which the Storefront is designed, built, and verified — and
**desktop is a fully supported platform**, never a degraded one. One
decision: which device platform is primary and what obligation the other
carries.

- **Design and build mobile-first.** Layouts, flows, and content are
  composed for small viewports and touch input first, then scaled up to
  wider viewports. The mobile form is the reference presentation of every
  surface: a design or flow that has not been derived for the small-
  viewport touch form is not finished.
- **Desktop is fully supported.** Every route and the complete purchase
  and conversion path work entirely on desktop: the Landing Page feed, the
  Product Page with its Simplified Purchase Surface and Pre-order capture,
  the Hosted Checkout handoff, the post-checkout pages, the Inbound
  Contact Surface and Outbound Share Surface, and the auxiliary and legal
  pages — aligned with ADR 00-009's decision that the share affordance
  work uniformly on desktop and mobile. "Primary" governs baseline
  direction and where attention concentrates first; it never licenses a
  broken, partial, or second-class desktop experience.
- **The Feed Shell reads as scaling up.** ADR 03-002's responsive-collapse
  rules stand verbatim; they are to be read as scaling up from the mobile
  baseline — the single-column form (the Feed Surface with the
  consolidated bottom navigation band and the minimal top band) is the
  primary composition, gaining the icon strip, then the full Nav Rail,
  then the Suggestions Rail as width allows — rather than a desktop
  composition degrading downward. This declares the reading direction of
  an existing contract; it changes no rule in ADR 03-002.
- **Asymmetry only where an ADR records it.** Presentation adapts per form
  factor — the shell's per-column collapse is itself the standing example
  — but a capability or content region that exists on only one platform
  must be an explicit, ADR-recorded trade-off. The Suggestions Rail's
  wider-viewport-only presence, recorded by ADR 03-002, is the standing
  instance: an accepted exception, not a precedent for silently omitting
  surfaces on either platform.
- **Verification follows the posture.** The Storefront's public contracts
  and visual states are exercised at the mobile baseline first and at the
  desktop form always, in line with the contract-level testing posture of
  ADR 00-007. A defect on either platform is a regression.
- **Performance targets the primary constraints.** Performance budgets are
  evaluated against the Primary Platform's conditions — small viewports,
  touch input, and mobile connections in the primary market (ADR 00-006) —
  while remaining satisfied on desktop.

## Consequences

**Positive:**
- A canonical answer exists for every layout, flow, and priority question:
  the mobile form is the baseline and disputes resolve by reference, not
  taste.
- The declared posture aligns the architecture with the entry routes and
  usage reality already recorded — phone-scanned QR entry (ADR 00-003),
  mobile connections in the primary market (ADR 00-006), and the
  mobile-dominant contact channels (ADR 00-009).
- ADR 03-002's collapse gains a declared direction — a primary composition
  plus expansions rather than a full form minus pieces — which simplifies
  reasoning about what must exist at every width.
- Desktop visitors lose nothing: full route coverage and the complete
  conversion path are reaffirmed and verified, not merely permitted.
- Performance and media investment concentrates where conversion actually
  happens — the primary market's mobile connections.

**Negative / trade-offs:**
- Every surface is designed and verified in two forms — the small-viewport
  baseline and the expanded desktop form — doubling the presentation QA
  surface under a very small team.
- Capabilities that only earn their place at desktop width have no mobile
  home; each such asymmetry (the Suggestions Rail's content being the
  recorded instance) costs an explicit ADR-recorded trade-off rather than
  a quiet omission.
- "Mobile-first" is easily misread as "mobile-only"; the posture must be
  defended in review so that desktop defects continue to count as
  regressions.
- The declared reading of ADR 03-002 changes framing, not pixels: future
  plans and QA language must consistently speak of scaling up from the
  baseline or the reinterpretation drifts back to desktop-first habits.

## Alternatives Considered

- **Desktop-first** — Rejected: the Storefront's primary physical entry
  route is phone-scanned (ADR 00-003) and the primary market's traffic is
  mobile-dominant; a desktop baseline would invert reality, making the
  form most visitors see the derived one and stranding ADR 00-006's
  mobile-connection media posture as an exception instead of the rule.
- **Uniform posture — no primary platform declared** — Rejected: it
  provides no tiebreaker when a design must choose which form to compose
  first, and leaves each change to decide the question differently — the
  precise ambiguity this decision removes. The corpus already leans
  mobile; declaring it costs nothing and settles the default.
- **Mobile-only — drop desktop support** — Rejected: ADR 00-009 rejected
  the platform-native share sheet precisely because it would silently
  remove the desktop affordance; a mobile-only posture commits that same
  fault at store scale. It also forfeits desktop conversion and abandons
  desktop-bearing surfaces that already exist (the Suggestions Rail);
  premium presentation on a full-size screen is part of the brand's
  value proposition.
- **Adaptive per-platform experiences (distinct mobile and desktop
  flows)** — Rejected: two divergent flows to build, localize, and keep
  semantically identical; the Feed Shell's single composition with
  per-column collapse already delivers both forms from one design.
- **A tablet form as a co-primary target** — Rejected: the shell's
  medium-viewport icon-strip state already covers intermediate widths;
  naming a third target multiplies the verification surface for marginal
  traffic share.
