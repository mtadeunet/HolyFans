# ADR 03-003: Promotion Bar — Expandable Editorial Campaign Bar with Site Config Campaigns

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-002 (Rendering and Hosting Model)
ADR 00-004 (Commerce and Checkout)
ADR 00-005 (Internationalization)
ADR 00-007 (Quality Tooling and CI)
ADR 00-008 (Analytics and Consent)
ADR 00-011 (Page Model and Product Routes)
ADR 00-012 (Platform Posture)
ADR 03-001 (Design System and Visual Identity)
ADR 03-002 (Landing Page Composition)

## Context

The Storefront has no promotional surface. Announcing anything — a launch
offer, a seasonal note, a free-shipping threshold, an editorial highlight —
requires code changes and a redeploy, which is disproportionate for
time-boxed marketing copy the operator may want to run for days. The
owner has approved a thin, editorial top-of-site **Promotion Bar** —
the "Expandable Secret": a collapsed one-line bar that expands in place
into a richer promotional block, rather than a modal, overlay, or
conventional rotating announcement banner.

The architecture constrains the shape the feature can take. ADR 00-002
confines request-time compute to an enumerated dynamic surface — no new
Route Handlers may be added — while Site Config already gives the
operator a request-time-read, Edge-Config-backed configuration channel
editable through the Admin Console within seconds. ADR 03-002 fixes the
two-chrome-systems composition — the Feed Shell on the browse-and-
purchase flow, the classic header/footer chrome everywhere else — so a
site-wide bar must mount above whichever system a route uses. ADR 03-001
fixes the canonical Design Tokens, Brand Palette, and the serif voice
reserved for the brand mark and headings. ADR 00-004 fixes the commerce
contract — server-side Cart re-validation and the PSP's Hosted Checkout
— so any promotional promise about price or shipping must be enforced
server-side, never decorative. The interim Purchase-Surface Gate keeps
the unlaunched purchase surface hidden, so a campaign pointing at it
must degrade fail-closed. ADR 00-008 permits only Cookieless Analytics
plus purpose-bound consented collection, so the bar's measurement must
stay aggregate and anonymous, and its per-visitor state must live on the
device like the Like Token. ADR 00-005 requires every visitor-facing
string in both Locales. ADR 00-012 makes the small-viewport form the
canonical baseline. Identifier hygiene (ADR 00-007) confines campaign
copy in tracked files to placeholders and own-brand content.

## Decision

The Storefront gains a **Promotion Bar** — a thin, editorial, top-of-
site campaign unit rendered on every route the Locale tree composes,
driven by **Campaigns** stored in Site Config and selected client-side
by a **Smart Offer Switcher**. One decision: the promotional chrome
unit and the rules the campaign system obeys.

- **Composition and behavior.** The bar renders collapsed as a single
  centered row: a **hook text** centered and flanked by a
  disclosure chevron on each side, so the row itself reads as the
  expand affordance — the toggle is the row's only control; the bar
  carries no dedicated dismiss affordance and stays mounted while a
  campaign is eligible. The hook text **cycles between the campaign
  micro-label and the campaign headline** on a slow editorial cadence
  of roughly four seconds — the outgoing text slides up and out as
  the incoming slides up into place with a gentle cross-fade — while
  the disclosure chevrons hold position and flank whichever text is
  showing. The cycle runs in the collapsed state only.
  Activating the row expands it **in normal
  document flow** — never a modal, overlay, or popover — into a richer
  promotional block: a single centered vertical stack of a serif
  headline, a description in body copy, and a call-to-action link —
  the campaign micro-label appears only in the
  collapsed row, never repeated inside the expanded stack, and the
  expanded block never cycles. Collapse
  happens by re-activating the row toggle or pressing Escape. Both
  states hold
  their content to the Feed Surface's column track rather than
  spanning the viewport, so the unit reads as an extension of the
  feed's centered composition. Expand and collapse use subtle
  transitions and honor `prefers-reduced-motion` — under reduced
  motion the hook cycle degrades to a static, instant presentation
  with no slide or fade — and the unit carries no flashing,
  rotating, or banner-style motion: the collapsed hook cycle is the
  single enumerated exception to that posture, so the unit reads as
  editorial chrome, not ad-tech.
- **Mount and scope.** The bar is a client **Island** (ADR 00-001)
  fed by the server-side Site Config read the Locale layout already
  performs (ADR 00-002). It mounts as the first child of
  `ChromeFrame`'s flex column on every route under the Locale tree —
  above the Feed Shell on the shell routes (`/`, `/checkout`), above
  the classic Header on every other route — governed by a new chrome
  toggle key `promotionBar`. The Admin Console route tree sits outside
  the Locale layout and never carries the bar. The classic Header
  changes from `fixed` to `sticky top-0` — behavior-identical on
  scroll — so the in-flow bar pushes it down rather than sliding under
  it.
- **Visual identity.** The unit is token-driven per ADR 03-001 and
  introduces no new colors. Four bar themes exist, expressed
  entirely through tokens: `light` (`bg-surface`, `border`,
  `text-primary`), `dark` (`bg-text-primary` with `surface` text —
  the only full inversion), `accent` (a `primary` band with `surface`
  text, the expanded block shading into `accent`), and `soft` (a quiet
  `primary` wash). The micro-label is uppercase secondary
  text; the headline uses the serif display face, which stays inside
  its headings-only whitelist; the call to action carries a static
  `↗` affordance glyph.
- **Campaigns live in Site Config.** The campaign list is stored
  wholly in Site Config — Edge Config, with the dev local-JSON
  fallback — so the operator edits, schedules, enables, and retires
  campaigns through the Admin Console without a redeploy. This
  deviates deliberately from the ADR 00-005 message-catalog
  convention: visitor-facing **chrome strings** (toggle labels and aria
  names) still come from `messages/{en,pt}.json` under a
  `promotion.*` namespace, while **campaign marketing copy** — the
  per-Locale `{pt, en}` label, headline, description, and CTA label —
  lives in the campaign record itself. The trade-off is recorded:
  operator editability is bought at the cost of moving a class of
  visitor-facing copy outside the parity-checked catalogs; validation
  (below) takes over the catalog checker's role for that copy.
- **Bar theme.** The bar's visual theme is a single Site Config
  field — `promotion.theme`, one of `light`, `dark`, `accent`,
  `soft` — shared by every campaign: the bar renders at most one
  campaign at a time, so the skin belongs to the bar, not to the
  campaign that happens to win. The Admin Console edits it as
  shared bar settings beside the campaign list. On read, a missing
  or invalid `promotion.theme` falls back to the first stored
  campaign's legacy per-campaign `theme` (a valid one, if any) and
  then to the default — a stored document written before the field
  existed keeps its look; legacy `theme` keys drop from the
  normalized campaigns. On write, an invalid or absent
  `promotion.theme` carries the stored value forward rather than
  rejecting or resetting — the same never-silently-reset posture as
  the `emails` group.
- **Campaign shape.** Each campaign is
  `{id, type, priority, enabled, startDate, endDate, ctaUrl,
  promoCode?, conditions, copy}` where `type` is one of `editorial`,
  `discount`, `seasonal`, `exclusive`;
  `conditions` is `null` or
  `{surfaces: ('feed'|'purchase'|'classic')[], minCartCents?,
  belowFreeShipping?, visitor: 'new'|'returning'|'any'}`; and `copy` carries
  `{pt: {label, headline, description, ctaLabel}, en: {...}}`.
  `promoCode` is **reserved**: the field is schema-ready but never
  rendered in v1 — the Hosted Checkout has no promotion-code entry
  enabled, so displaying an unredeemable code would be a dead-end
  promise.
- **Normalization and fallback.** `normalizeSiteConfig` gains campaign
  validation: every stored campaign is checked and malformed campaigns
  drop out individually rather than breaking the read. The write path
  validates strictly and rejects invalid campaigns with a named error —
  fail-loud for the operator, fail-safe for the visitor.
  `DEFAULT_SITE_CONFIG` ships one always-on editorial fallback campaign
  (enabled, no conditions, lowest priority), so an enabled bar always
  has truthful content to show.
- **Smart Offer Switcher.** Campaign selection is client-side and runs
  an ordered pipeline: `enabled` → within `startDate`/`endDate`
  schedule → surface match (pathname classes: `/` → `feed`,
  `/checkout` → `purchase`, anything else → `classic`, mirroring
  `ChromeFrame`'s shell-route set) → visitor match (`new` vs
  `returning` derived from the client-local `hf-visited` localStorage
  marker — anonymous, self-generated, never transmitted, the same
  posture as the Like Token) → Cart conditions via `useCart()` gated
  on `hydrated` → Purchase-Surface Gate (a campaign
  conditioned on the purchase surface only is ineligible while the
  gate is closed) → highest `priority` → the fallback
  campaign. The switcher **never switches the displayed campaign while
  the bar is expanded**.
- **Free-shipping truthfulness.** The merchandise subtotal that earns
  complimentary shipping is
  `siteConfig.shipping.freeShippingThresholdCents` — operator-editable
  Site Config data in the Admin Console's Shipping section, defaulting
  to €100 (the `FREE_SHIPPING_THRESHOLD_CENTS` constant in
  `lib/shipping.ts` remains only the normalization fallback). The
  checkout Route Handler substitutes complimentary shipping rates (a
  PT/EU pair mirroring `SHIPPING_OPTIONS`, amount 0) when the
  server-validated subtotal meets the configured threshold, so a
  campaign's "€{remaining} away" message is enforced at Session
  creation — truthful, never decorative. Campaign copy may contain a
  `{remaining}` placeholder interpolated client-side with EUR
  formatting against the same configured value.
- **Persistence on device.** `localStorage` key `hf-visited` marks the
  visitor as returning for `visitor` conditions. `sessionStorage` key
  `hf-promo-expanded` remembers the expanded state per campaign id
  within the browsing session, and `sessionStorage` key
  `hf-promo-displayed` dedups the `promo_displayed` event to once per
  campaign per session.
- **Measurement, enumerated.** The bar emits exactly four aggregate
  custom events through `track()` from `@vercel/analytics` — an
  existing dependency, so zero new dependencies: `promo_displayed`,
  `promo_expanded`, `promo_collapsed`, and `promo_cta_clicked`, each
  with a payload of `{campaignId, surface}`
  only. These events are RULED to be within ADR 00-008's posture: the
  native Hosting Platform mechanism, cookieless, aggregate-only, no
  cookies, no identity, no cross-session stitching, no third-party
  tags. The boundary is stated: per-visitor funnels, journeys, and
  conversion attribution remain outside the posture and would require
  a future ADR and consent mechanism.
- **Purchase-Surface Gate awareness.** A campaign CTA resolving to the
  purchase surface degrades while `PURCHASE_SURFACE_ENABLED` is off —
  the CTA is suppressed, and a campaign whose conditions target only
  the purchase surface is ineligible — fail-closed, consistent with
  the existing gate handling on navigation CTAs. The server passes
  `purchaseSurfaceEnabled` to the Island.
- **Accessibility.** The unit is a semantic `section` region with a
  `button` toggler (`aria-expanded`, `aria-controls`) whose accessible
  name comes from its `aria-label` (`promotion.expand` /
  `promotion.collapse`); the collapsed row's cycling hook texts are
  decorative and `aria-hidden` from assistive technology; all states
  are keyboard-operable with visible `focus-visible` styles; Escape
  collapses the expanded block.
- **Localization.** All visitor-facing chrome strings ship in both
  Locales through the `promotion.*` message namespace (ADR 00-005);
  campaign copy is selected per Locale from the campaign record;
  `ctaUrl` renders through the locale-aware `Link` from
  `lib/navigation` for internal paths so the Locale prefix is
  preserved.
- **Hygiene.** Campaign copy in tracked files (defaults, fixtures,
  tests) is placeholder or own-brand copy only — no real-world
  identifiers (ADR 00-007).
- **Boundaries.** ADR 00-002's enumerated dynamic surface is untouched
  — no new Route Handlers; the bar consumes the existing request-time
  Site Config read. No new dependencies are added. The two-chrome-
  systems composition of ADR 03-002 is preserved — the bar mounts
  above whichever chrome system a route uses and belongs to neither.

## Consequences

**Positive:**
- The operator runs, schedules, and retires campaigns through the
  Admin Console with Edge Config propagation in seconds — no redeploy
  for time-boxed marketing.
- The in-flow expansion preserves the editorial composition and the
  premium first impression: promotional content earns attention by
  expansion on demand rather than by interruption.
- The collapsed hook cycle puts the campaign headline in view before
  any interaction, so the offer works on first glance while the strip
  keeps its one-line height.
- Free-shipping promises are enforced server-side at Checkout Session
  creation — the bar's message and the PSP's shipping options can
  never disagree, and the client interpolates from the same Site
  Config value the server enforces.
- The feature adds zero dependencies, zero Route Handlers, and zero
  new request-time capability — the Island consumes the existing Site
  Config read.
- Visitor measurement stays inside the cookieless posture: four
  enumerated aggregate events, anonymous per-device state, nothing
  transmitted but the platform-native beacon.
- `promoCode` is schema-ready: when the PSP path supports promotion
  codes, rendering them is a presentation change, not a schema
  migration.
- Per-session expansion memory keeps the unit polite without any
  server-side state.

**Negative / trade-offs:**
- Visitor-facing copy now lives in two systems: catalog parity tooling
  covers `promotion.*` chrome strings but not campaign copy in Site
  Config — correctness of the per-Locale copy rests on schema
  validation and the Admin Console form rather than the message-parity
  test.
- Campaign selection is client-side: conditions evaluate after
  hydration, so the bar can render one frame late or change campaign
  once the Cart rehydrates — bounded by the `hydrated` gate and by the
  no-switch-while-expanded rule, but never server-personalized; the
  static-posture trade is deliberate.
- The free-shipping promise couples a marketing message to checkout
  logic: the threshold is shared through Site Config, but an operator
  editing campaign copy can still write claims no mechanism verifies —
  the same honesty bound the Compare-At Price carries.
- `hf-visited` is a coarse signal: a visitor who clears site storage
  reads as `new` again; accepted as a presentation hint, never a
  business metric.
- Session expansion memory does not follow the visitor across devices
  — the same accepted bound as the Cart.
- The bar adds a thin strip of vertical space at the very top of every
  Locale route and offers the visitor no dismissal — it stays mounted
  for the duration of an active campaign; the collapsed height is
  deliberately minimal, but all compositions shift down when it
  renders.
- The collapsed row now carries perpetual self-motion on every Locale
  route: the cost is bounded by the four-second cadence, the
  collapsed-only scope, and the reduced-motion static fallback, but
  it must remain the enumerated exception — the general ban on
  ad-tech motion stands.
- The Admin Console form grows a structured campaigns editor — the
  most complex operator surface yet; a malformed hand-edited Edge
  Config is still handled by drop-out validation.
- Campaign `ctaUrl` is operator input rendered as a link: validation
  must keep it to internal paths or absolute `https` URLs.

## Alternatives Considered

- **Modal or overlay promotion instead of in-flow expansion** —
  Rejected: an overlay interrupts the composition, blocks content, and
  reads as ad-tech — the opposite of the editorial posture; in-flow
  expansion keeps the scroll composition intact and the premium feel.
- **A two-column editorial layout for the expanded block** — Rejected:
  splitting the offer across side-by-side columns breaks the single
  centered reading order and reads as a layout block rather than one
  editorial unit; the vertical stack keeps the campaign's hierarchy —
  headline, description, call to action — on the Feed Surface's
  column track at every viewport.
- **A headline snippet alongside the micro-label in the collapsed
  row** — Rejected: showing both texts simultaneously crowds the
  single-line strip; the hook cycle presents each in turn, keeping
  the row's one-text economy while the headline remains the expanded
  offer's centerpiece.
- **A single static hook text in the collapsed row** — Rejected: a
  fixed micro-label leaves the campaign's headline invisible until
  expansion; cycling the label and headline on a slow cadence lets
  the offer speak before activation without growing the strip or
  breaking the one-line composition, and the reduced-motion fallback
  keeps the motion optional.
- **Visitor dismissal of the bar (a dismiss or close control)** —
  Rejected: a visitor could hide a campaign the operator has enabled,
  and the hidden-until-dismissed state would require per-campaign
  persistence on the device plus a dismissal measurement event —
  machinery with no editorial payoff. The bar is permanent chrome for
  the duration of an active campaign; politeness is carried by the
  collapsed strip's minimal height and the expand/collapse toggle.
- **Campaigns in the message catalogs or code-managed content** —
  Rejected: the operator cannot edit or schedule them without a
  redeploy, which defeats a time-boxed promotional surface. This is
  the standing trade-off against i18n catalog consistency — recorded
  in the Decision; visitor-facing chrome strings remain in the
  catalogs under `promotion.*`.
- **A CMS or promotion platform** — Rejected: recurring cost, an
  external service dependency, and an editorial workflow far beyond a
  one-product catalog's needs — contradicts the low-operations model.
- **A third-party announcement-bar widget** — Rejected: generic look
  against the bespoke token-driven identity of ADR 03-001, plus a
  third-party script that breaches the no-third-party-tags posture of
  ADR 00-008.
- **Rendering promo codes in v1** — Rejected: the Hosted Checkout has
  no promotion-code entry enabled, so a displayed code could not be
  redeemed — an unredeemable promise; the `promoCode` field is
  reserved in the schema for when the PSP path supports it.
- **Per-visitor conversion attribution / promo funnels** — Rejected:
  per-visitor journeys and attribution sit outside ADR 00-008's
  aggregate-only posture and would need a future ADR plus a consent
  mechanism; the four enumerated aggregate events are the boundary.
- **Client-only localStorage campaign configuration** — Rejected:
  config on the visitor's device is neither operator-manageable nor
  server-visible; Site Config is the sanctioned operator channel.
- **Server-side campaign selection** — Rejected: would push campaign
  conditions into request-time rendering or edge personalization
  beyond the enumerated dynamic surface; the client Island keeps the
  static posture while consuming the Site Config read that already
  exists.
