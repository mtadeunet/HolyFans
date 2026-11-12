# ADR 03-002: Landing Page Composition — Three-Column Feed Shell with Simplified Purchase Surface

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-002 (Rendering and Hosting Model)
ADR 00-004 (Commerce and Checkout)
ADR 00-005 (Internationalization)
ADR 00-006 (Media and Asset Pipeline)
ADR 00-007 (Quality Tooling and CI)
ADR 00-008 (Analytics and Consent)
ADR 00-009 (WhatsApp Deep-Link Channels)
ADR 03-001 (Design System and Visual Identity)

## Context

The Storefront's landing is currently a stacked sequence of marketing
sections (hero, social proof, product block, craftsmanship, FAQ, closing
call to action) beneath a classic header, above a classic footer. It is a
competent premium retail page, but it presents the small catalog as a
conventional marketing funnel rather than as editorial content, and the
path from product discovery to purchase passes through a separate
cart-review step.

The owner has approved a restyle that mirrors the three-column
social-feed composition used by a creator-subscription platform reference:
a left navigation rail, a center feed of post-style cards, and a right
suggestions rail. The owner has also decided that the purchase route
joins the composition, so discovery and conversion present inside one
chrome system rather than switching to a different page frame at the
decisive step. The Storefront takes the *pattern* only — HolyFans
branding, copy, and imagery exclusively. Identifier hygiene (ADR 00-007)
forbids carrying any third-party brand assets, names, copy, or account
references into tracked files; the reference layout is a composition
pattern, not a source of content.

The architecture constrains the shape the restyle can take. ADR 00-002
confines request-time compute to an enumerated dynamic surface; within
it, a dedicated counter endpoint backed by a managed store gives the
feed's like affordance a real, shared count, while comments and other
attributed social mechanics remain outside the boundary. ADR 00-008
permits only Cookieless Analytics, so the row emits no tracking signal
and its per-visitor dedup rests on an anonymous, self-generated
client-held token feeding aggregate counts only. ADR 00-004 fixes the
commerce contract (client-side
Cart, server-side re-validation, PSP Hosted Checkout), which any new
purchase presentation must preserve. ADR 00-005 requires every
user-facing string in both Locales. The canonical Brand Palette and
Design Tokens of ADR 03-001 remain the visual system; the restyle works
within them. ADR 00-009's Inbound Contact Surface and Outbound Share
Surface must keep working inside whatever composition replaces the
current chrome. Site Config's section and chrome toggles — stored in
Edge Config and operated through the Admin Console — must keep working
for already-saved configurations; the mapping from toggles to visible
units needs a defined meaning under the new composition.

## Decision

The Locale landing roots and the purchase route are composed as a
**Feed Shell** — a three-column layout consisting of a **Nav Rail**
(left), a **Feed Surface** (center), and a **Suggestions Rail** (right).
Purchase intent raised anywhere in the shell resolves at a **Simplified
Purchase Surface** — the composition's single conversion endpoint,
rendered inside the shell on the purchase route. One decision: the
composition model of the browse-and-purchase flow and the rules the
composition obeys.

- **Scope.** The Feed Shell is the composition of the Locale landing
  roots and the purchase route — the browse-and-purchase flow. It is
  the entire chrome on those routes: the classic site header and footer
  do not render on either — the Nav Rail carries brand and navigation,
  and the Suggestions Rail carries the legal links. Every other route —
  the post-checkout success and cancel pages, auxiliary and legal
  pages, and the Admin Console — keeps the classic header/footer
  chrome, still governed by the existing Site Config chrome toggles.
  The post-checkout pages are PSP-return endpoints outside the browsing
  flow: they present a terminal payment outcome and keep the focused
  classic chrome rather than feed affordances.
- **Nav Rail.** A fixed column holding the brand mark, a store-adapted
  list of icon-and-label navigation entries, language switching, and a
  prominent purchase call-to-action at its foot. Entries are
  store-purpose only — landing sections, the purchase surface, and the
  contact channel through the Inbound Contact Surface's deep-link
  mechanism (ADR 00-009). Social-platform concepts (profiles, messages,
  notifications) are not carried over. Every entry resolves wherever
  the shell renders: on the purchase route, entries that target landing
  feed units return the shopper to that unit on the landing within the
  same Locale.
- **Feed Surface.** The shell's center column and primary content
  region. On the landing roots it is a vertical scroll of **Post
  Cards** — the landing's primary content. Each Post Card is a
  self-contained unit: a header carrying the brand avatar, name, and a
  decorative handle string (own brand only, never a third-party
  account reference and never a link); localized caption copy; a
  **Media Slot**; and an **Interaction Row**. On the purchase
  route the Feed Surface carries a single occupant — the Simplified
  Purchase Surface, presented as a plain centered panel inside the
  column, not as a Post Card: the conversion surface carries no
  interaction affordances and no Media Slot link, because it is the
  destination those affordances resolve to. The column's measure and
  rhythm are shared across both routes so the purchase route reads as
  the same composition.
- **Media Slots convert.** Every Media Slot is a link to the Simplified
  Purchase Surface within the same Locale — seeing a product image and
  tapping it is the primary path to purchase.
- **Interaction Row.** Each Post Card carries a row of social-style
  affordances that is real but bounded — a like control with its
  count and a share control:
  - **Likes are shared counters.** The displayed like count is the
    sum of an authored base count — part of the Post Card's
    code-managed content — and a shared delta persisted server-side
    in the managed store of ADR 00-002. A visitor's toggle persists
    in client-local storage — an Island per ADR 00-001 — and is
    deduplicated server-side per Post Card by a **Like Token**: an
    anonymous, self-generated per-browser identifier held in
    client-side storage, never a cookie, sent only with the toggle
    request. The like counter Route Handler enumerated in ADR 00-002
    serves counts and records toggles; it is hardened like the
    checkout endpoint — input caps, IP rate limiting, fail-closed.
    When the store is unconfigured or unreachable, the row degrades
    to the authored base count with toggling disabled — graceful,
    never a crash.
  - **Share is a client-resolved affordance.** The comment and
    bookmark glyphs are replaced by a share control that invokes the
    visitor device's native share capability with the Post Card's
    anchored URL on the Store Domain, falling back to clipboard copy
    where the capability is unsupported. Sharing transmits nothing
    to the Storefront — the client-resolved outbound posture of
    ADR 00-009.
  - **No comments, no attribution, no measurement.** The row feeds
    aggregate counts only and emits no analytics signal; the Like
    Token identifies no person and stays inside the cookieless,
    no-personal-data posture of ADR 00-008.
- **Suggestions Rail.** A column of product and Variant suggestion cards
  with a discovery call-to-action and the legal links (privacy, terms)
  at its foot. The rail renders on the purchase route as well, where
  its suggestion cards stay Variant-relevant: an available Variant
  suggestion selects that Variant on the surface, while a sold-out
  Variant is shown but never offered as a purchasable path.
- **Simplified Purchase Surface.** The existing checkout page is reduced
  to the single decision the shopper must make: Variant selection,
  quantity, the VAT-inclusive EUR price, and one purchase action that
  submits the selection into the existing checkout path — server-side
  re-validation and the PSP's Hosted Checkout per ADR 00-004, including
  its drift and degradation behaviors. There is no cart-review
  presentation; the Cart remains the shopper-held collection underneath
  (a single line), preserving cancel-preserved and drift-correction
  semantics. The Simplified Purchase Surface is the canonical purchase
  block: the Outbound Share Surface (ADR 00-009) lives on it. On the
  purchase route it renders inside the Feed Shell as the center
  column's single occupant — a single focused decision block, minimal
  by design, not a browsing surface.
- **No composer, no search.** The pattern's create-post affordance and
  search bar are explicitly excluded by the owner: the feed is editorial
  store content, not user-generated, and the catalog is too small to
  merit search.
- **Responsive collapse.** The shell degrades gracefully by column:
  the Suggestions Rail is the first element to drop below desktop
  widths, the Nav Rail narrows to an icon strip on medium viewports and
  collapses to a compact bottom navigation band on small viewports —
  carrying navigation and the purchase affordance — while a minimal top
  band retains brand and language switching. The Feed Surface is the
  primary column at every width, and the collapse is identical on every
  route the shell composes — the purchase route gets the same bands.
  Small-viewport bottom chrome is a single consolidated band: the
  Inbound Contact Surface floats above it and must never occlude
  navigation or purchase actions (the ADR 00-009 presentation
  constraint).
- **Existing sections.** Landing content is repurposed as feed units:
  each existing content domain (hero, product, craftsmanship, social
  proof, FAQ, closing call to action) becomes Post Card content where it
  still earns its place; the on-landing purchase block is retired, its
  role absorbed by the Simplified Purchase Surface. Content that maps
  to no feed unit is retired rather than parked.
- **Site Config mapping.** Section toggles are preserved and remapped at
  the semantic level: each existing section toggle governs the feed
  unit(s) carrying that content domain. Toggle keys are retained so
  stored Site Config documents keep working without migration — a saved
  "hide FAQ" still hides FAQ content, now expressed as hiding the FAQ
  feed unit — and Admin Console labels are updated to feed vocabulary.
  Chrome toggles keep governing the chrome they name; the header and
  footer toggles remain meaningful on routes outside the shell and are
  inert wherever the Feed Shell renders.
- **Visual system.** The restyle works entirely within the canonical
  Design Tokens and Brand Palette (ADR 03-001): the composition
  mirrors the platform's feed visual language — light surfaces, a
  bright blue accent, sans-serif reading with the serif voice retained
  on the brand mark and headings — expressed through bespoke
  components, with no generic feed-kit look.
- **Imagery.** Post Card media uses in-repo masters through the
  framework's image optimization (ADR 00-006); product photography
  first, branded placeholder compositions where masters do not yet
  exist.
- **Localization.** Every user-facing string in the shell — navigation,
  captions, card chrome, rail content, the Simplified Purchase Surface —
  is authored in both Locales through the versioned message catalogs
  (ADR 00-005); all in-shell navigation preserves the Locale prefix.
- **Hygiene and measurement.** The mirrored platform's name, marks,
  copy, and UI text never enter tracked files — the pattern is
  re-expressed in HolyFans' own vocabulary (ADR 00-007). The
  composition adds no analytics mechanism; the Interaction Row emits
  no analytics signal — the Like Token feeds aggregate counts only —
  and purchase conversion stays measured at the PSP (ADR 00-008).

## Consequences

**Positive:**
- The small catalog is presented as editorial content in a familiar
  scroll pattern — a distinctive premium-social presence rather than a
  template retail page.
- The conversion path shortens and stays inside one composition: media
  impression → Simplified Purchase Surface → Hosted Checkout, removing
  the intermediate cart-review step and any chrome discontinuity at the
  purchase step.
- The Suggestions Rail remains useful on the purchase route as Variant
  context, and the mobile bands keep navigation and the contact channel
  reachable during checkout.
- Existing content, imagery, and Site Config toggles are preserved
  through remapping — no configuration migration, no lost operator
  controls, and stored configs keep their semantics.
- The feed, rails, and chrome remain static output plus client
  Islands; the Interaction Row's only request-time footprint is the
  single enumerated like counter Route Handler inside ADR 00-002's
  boundary, so the pages stay fast and the dynamic surface stays
  enumerated.
- The checkout contract of ADR 00-004 is preserved wholesale — server
  re-validation, Hosted Checkout, drift and degradation behavior — only
  the presentation that feeds it changes.
- Mobile posture consolidates bottom chrome into one band while keeping
  the Inbound Contact Surface reachable without occlusion.

**Negative / trade-offs:**
- The borrowed feed metaphor can read as imitative of the platform genre
  it mirrors; mitigated by bespoke tokens, brand, and copy, but the
  perception risk remains.
- The shared like count is a live store dependency: when the managed
  store is unconfigured or unreachable the row falls back to authored
  base counts with toggling disabled — graceful, but the shared
  signal silently disappears.
- The Like Token is self-minted on the visitor's device: clearing
  client storage or scripting fresh tokens inflates likes past honest
  dedup — an accepted vanity-metric bound, mitigated by per-post
  dedup and IP rate limiting; counts are a presentation signal,
  never a business metric.
- The native share capability is uneven across desktop browsers; the
  clipboard fallback keeps the affordance uniform but changes its
  feel.
- Two composition systems coexist: the Feed Shell across the
  browse-and-purchase flow and the classic chrome on post-checkout,
  auxiliary, legal, and admin routes — more layout variants to build,
  style, and keep consistent.
- The conversion step carries the shell's chrome weight — rails,
  suggestion content, mobile bands — rather than a bare focused page;
  accepted by owner decision for composition continuity.
- Landing-targeted shell navigation has no on-page target on the
  purchase route: feed-unit entries navigate back to the landing — an
  accepted wayfinding trade-off that keeps one entry set across the
  shell.
- The Suggestions Rail's suggestion, discovery, and legal content is
  desktop-only; small viewports lose those surfaces entirely (the feed
  and purchase path remain full).
- Section-toggle semantics drift: operators must relearn that toggles
  now hide feed units rather than page sections; the header/footer
  toggles silently doing nothing on the routes the shell composes can
  confuse.
- A one-product catalog means the feed repeats one product — variety
  must come from content angles (craft, faith, proof), not catalog
  breadth; the feed can feel thin if too many posts repeat the same
  media.

## Alternatives Considered

- **Keep the stacked-section landing** — Rejected: the owner approved
  the feed restyle. The stacked layout is a generic marketing pattern;
  the Feed Shell presents the small catalog as editorial content and
  shortens the path from impression to purchase.
- **Third-party social-feed UI kit, or cloning the reference platform's
  components/brand** — Rejected: a kit look contradicts the bespoke,
  token-driven identity of ADR 03-001, and copying brand assets, copy,
  or UI text breaches identifier hygiene (ADR 00-007).
- **Presentational-only interaction affordances** — Rejected: owner
  decision — likes carry a real shared counter and share performs a
  real action; purely decorative glyphs invited taps that led
  nowhere.
- **Full social-platform interactions (comments, attributed
  engagement)** — Rejected: comments and per-visitor attribution
  demand identified personal data incompatible with ADR 00-008 and
  request-time surfaces beyond ADR 00-002's enumerated boundary; the
  bounded version — aggregate counters plus a client-resolved share —
  delivers the pattern without them.
- **Server-issued identifiers for like dedup (cookie or session)** —
  Rejected: a server-set identifier enters cookie territory under
  ePrivacy and the no-consent-banner posture of ADR 00-008; the
  self-generated client-held Like Token dedups per visitor with no
  server-issued tracking surface.
- **Share tracking or share-count endpoints** — Rejected: the share
  affordance resolves entirely on the visitor's device; observing
  shares would introduce a tracking signal ADR 00-008 forbids.
- **Feed shell applied site-wide (all routes)** — Rejected: the shell
  serves the browse-and-purchase flow; post-checkout returns, legal,
  and admin surfaces are terminal or operational pages outside that
  flow and need focused minimal chrome, not feed affordances. Scope is
  the Locale landing roots and the purchase route.
- **Simplified Purchase Surface kept under the classic chrome** —
  Rejected: owner decision — the conversion endpoint joins the
  composition so discovery and purchase share one chrome system;
  classic header/footer chrome at the purchase step preserves a
  presentation discontinuity at the highest-value moment.
- **Simplified Purchase Surface presented as a Post Card** — Rejected:
  a conversion surface carrying social interaction affordances and a
  media link to itself would misrepresent engagement on a payment
  decision; it renders as a plain centered panel inside the Feed
  Surface instead.
- **Keep the cart-review purchase flow** — Rejected: the owner approved
  the simplification; a single-line direct purchase matches the
  one-product catalog. The Cart mechanism of ADR 00-004 remains
  underneath as the shopper-held collection.
- **Composer and search affordances for pattern completeness** —
  Rejected: explicit owner exclusion — no user-generated content exists
  to compose, and the catalog is too small to need search.
