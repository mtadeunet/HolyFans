# Promotion Bar — Implementation Plan

## Purpose

`[ADR 03-003]`

Implementation plan for the owner-approved Promotion Bar (the
"Expandable Secret"): a thin, editorial top-of-site campaign unit that
renders collapsed as a single line and expands in normal document flow
into a richer promotional block. Campaigns live wholly in Site Config —
operator-editable through the Admin Console without a redeploy — and a
client-side Smart Offer Switcher picks the campaign each visitor sees.
This plan carries ALL implementation detail; ADR 03-003 carries none by
rule.

Governing documents:
- `docs/adr/03-ui/03-003-promotion-bar.md` — the decision
- `docs/adr/TERMINOLOGY.md` — canonical glossary (all terms used
  verbatim, incl. Island, Site Config, Feed Shell, Purchase-Surface
  Gate, Locale, PSP, Hosted Checkout)
- `docs/adr/00-core/00-001`, `00-002`, `00-004`, `00-005`, `00-007`,
  `00-008`, `00-011`, `00-012` and `docs/adr/03-ui/03-001`,
  `03-002` — constraining ADRs (Islands, dynamic-surface boundary,
  commerce contract and gate, i18n, hygiene/tooling, analytics
  posture, page model, mobile baseline, design tokens, chrome
  composition)
- `docs/plans/holyfans-store-implementation-plan.md`,
  `docs/plans/landing-feed-restyle-plan.md` — plans this feature lands
  on top of

## Architecture Summary (per ADRs)

`[ADR 03-003]`

- **Unit:** a client Island (`components/layout/promotion-bar.tsx`)
  mounted as the first child of `ChromeFrame`'s flex column on every
  Locale route — above the Feed Shell on shell routes (`/`,
  `/checkout`), above the classic Header elsewhere — gated by the new
  `promotionBar` chrome key. The classic Header goes `fixed` → `sticky
  top-0` (behavior-identical) so the in-flow bar pushes it down.
  `[ADR 03-003]` `[ADR 00-001]` `[ADR 03-002]`
- **Campaigns:** a `promotion.campaigns` list on Site Config — Edge Config read
  at request time by the existing Locale-layout read path; dev
  local-JSON fallback unchanged. `normalizeSiteConfig` gains campaign
  validation; malformed campaigns drop out; `DEFAULT_SITE_CONFIG`
  ships one always-on editorial fallback campaign. `[ADR 03-003]`
  `[ADR 00-002]`
- **Selection:** pure helpers in `lib/promotions.ts` implement the
  ordered pipeline — enabled → schedule → surface → visitor → Cart →
  Purchase-Surface Gate → priority → fallback — fed by on-device state
  (`hf-visited`, `hf-promo-expanded`, `hf-promo-displayed`) and
  `useCart()` gated on `hydrated`. No new dynamic surface; no new
  dependencies. `[ADR 03-003]` `[ADR 00-002]` `[ADR 00-008]`
- **Copy split:** visitor-facing chrome strings stay in
  `messages/{en,pt}.json` under `promotion.*`; campaign marketing copy
  lives per-Locale inside each campaign record — the deliberate
  deviation recorded in the ADR. `[ADR 03-003]` `[ADR 00-005]`
- **Free shipping:** `siteConfig.shipping.freeShippingThresholdCents`
  (Admin Console editable, default €100;
  `FREE_SHIPPING_THRESHOLD_CENTS` in `lib/shipping.ts` is only the
  normalization fallback); the checkout Route Handler substitutes a
  complimentary PT/EU rate pair (amount 0) when the server-validated
  subtotal meets it — the bar's `{remaining}` message interpolates
  from the same Site Config value. `[ADR 03-003]` `[ADR 00-004]`
- **Measurement:** four enumerated aggregate events via `track()` from
  `@vercel/analytics` (already a dependency): `promo_displayed`,
  `promo_expanded`, `promo_collapsed`, `promo_cta_clicked` —
  `{campaignId, surface}` payloads only, inside
  the ADR 00-008 posture. `[ADR 03-003]` `[ADR 00-008]`
- **Gate & hygiene:** CTAs resolving to the purchase surface degrade
  fail-closed while `PURCHASE_SURFACE_ENABLED` is off; all tracked
  copy is placeholder/own-brand. `[ADR 03-003]` `[ADR 00-004]`
  `[ADR 00-007]`

## ADR Stamping Requirement (mandatory for all implementation work)

`[ADR 03-003]`

Every unit of functionality that implements ADR-defined behavior MUST
carry a stamp comment in the form:

```
Implements ADR <number>: <ADR title> - "<quoted ADR section/requirement>"
```

For this plan the canonical stamp is:

```
Implements ADR 03-003: Promotion Bar — Expandable Editorial Campaign Bar
with Site Config Campaigns - "<quoted ADR 03-003 requirement>"
```

- Stamp individual units — types, helpers, components, config entries,
  tests — not just whole files (TS docblock `/** … */`).
- Tests exercising ADR-defined behavior carry the same stamp.
- No new technology, communication pattern, or system boundary may be
  introduced without an ADR. If implementation reveals an unclear or
  blocking ADR/plan, the developer MUST escalate to the user,
  referencing the document.

## Repo State Note (implementation context, not architecture)

`[ADR 03-003]`

- `lib/site-config.ts` today: `SiteConfig = {sections, chrome, stock}`;
  `normalizeSiteConfig` merges booleans per enumerated key and the
  `qrcoderedirect` string; `DEFAULT_SITE_CONFIG` fills all defaults;
  `CHROME_KEYS` has five entries — `promotionBar` joins it.
- `components/layout/chrome-frame.tsx` today: client Island wrapping
  `{header, children, footer}` inside `flex min-h-screen flex-col`;
  `SHELL_ROUTES = {'/', '/checkout'}` suppresses classic chrome there.
  The bar needs a `promotionBar` slot rendered unconditionally first
  inside the flex column.
- `components/layout/header.tsx` today: `fixed top-0 left-0 right-0
  z-50` — it overlays page content, and classic-chrome pages absorb
  that overlay (e.g., `checkout/{success,cancel}` lead with `py-16`
  sections). The `sticky` change is behavior-identical on scroll but
  the header now occupies flow height — classic-chrome routes MUST be
  audited for doubled top spacing (see M3).
- `app/[locale]/layout.tsx` today: `force-dynamic`; reads
  `getSiteConfig()` + `isPurchaseSurfaceEnabled()` per request and
  passes `purchaseSurfaceEnabled` into `Header` — the same read path
  and prop pattern feed the bar. `CartProvider` wraps `ChromeFrame`,
  so `useCart()` is available inside the Island.
- `lib/shipping.ts` today: `SHIPPING_COUNTRIES` + `SHIPPING_OPTIONS`
  (PT/EU placeholder pair); consumed only by
  `app/api/checkout/route.ts`, which maps them onto
  `shipping_options` — the free-rate swap plugs into that map.
- `app/admin/admin-form.tsx` + `app/admin/actions.ts` today: boolean
  groups serialize as `<group>.<key>=on` plus one string field
  (`sections.qrcoderedirect`); `saveSiteConfig` rebuilds the whole
  `SiteConfig` — until the campaigns editor lands (M4) the action must
  carry `promotion.campaigns` over from a fresh `getSiteConfig()` read, or every
  save would wipe campaigns.
- `context/cart-context.tsx`: `useCart()` exposes `hydrated` and
  `getTotal()` (EUR, not cents — campaign conditions compare in cents:
  `Math.round(getTotal() * 100)`).
- `@vercel/analytics` is already a dependency (`^2.0.1`) with
  `<Analytics />` mounted in the Locale layout; `track()` is imported
  from `@vercel/analytics` for custom events — zero new deps.
- `tests/fixtures/` already hosts Site Config JSON fixtures consumed
  through `SITE_CONFIG_LOCAL_PATH` (Playwright per-server isolation);
  `tests/unit/site-config.test.ts` covers `normalizeSiteConfig`;
  `tests/unit/messages-parity.test.ts` enforces `pt`/`en` key parity —
  `promotion.*` keys are covered automatically.
- Route vocabulary: the surface classification mirrors `SHELL_ROUTES`
  (`/` → feed, `/checkout` → purchase, else classic). When the
  Product Page route lands at `/<locale>/product/<slug>` (ADR 00-011),
  the purchase class MUST follow it — keep the classification and
  `ChromeFrame`'s set synchronized.

## Milestone Overview

`[ADR 03-003]`

| # | Milestone | ADRs | Delivers |
|---|-----------|------|----------|
| 1 | Campaign Schema, Normalization & Defaults | 03-003, 00-002, 00-005, 00-007 | `PromotionCampaign` types, `SiteConfig.promotion.campaigns`, campaign validation in `normalizeSiteConfig`, fallback campaign, `promotionBar` chrome key, save-action carry-over, glossary terms, unit tests |
| 2 | Smart Offer Switcher Library | 03-003, 00-004, 00-008 | `lib/promotions.ts` pure selection pipeline + `{remaining}` interpolation + free-shipping remainder helper, full unit coverage |
| 3 | Promotion Bar Component, Mount & i18n | 03-003, 03-001, 03-002, 00-001, 00-005 | `components/layout/promotion-bar.tsx` Island, `ChromeFrame` slot, layout mount, header `fixed`→`sticky`, `promotion.*` catalogs, on-device persistence |
| 4 | Admin Console Campaigns Editor | 03-003, 00-002 | Promotions section in `admin-form.tsx`, strict validated `promotion.campaigns` write path in `actions.ts` |
| 5 | Free-Shipping Threshold & Checkout Swap | 03-003, 00-004 | `FREE_SHIPPING_THRESHOLD_CENTS`, `FREE_SHIPPING_OPTIONS`, `shippingOptionsForSubtotal()`, Route Handler swap, unit tests |
| 6 | Analytics Events & Accessibility Polish | 03-003, 00-008 | Four enumerated `track()` events, dedup per session, a11y audit (aria, Escape, focus, reduced motion, contrast) |
| 7 | E2E Coverage & Quality Gate | 03-003, 00-007 | `tests/fixtures/site-config-promo.json`, `tests/e2e/promotion-bar.spec.ts`, code-quality + ADR compliance gates |

Milestones are sequential: M3 needs M1's schema and M2's selector; M4
builds the operator UI on M1's write carry-over; M5 is independent of
M3/M4 and may run in parallel; M6/M7 close the feature. M3 is the
first visitor-visible milestone — the bar is live (default campaign)
from M3 onward.

---

## Milestone 1: Campaign Schema, Normalization & Defaults

`[ADR 03-003]`

### Description

`[ADR 03-003]`

Extend the Site Config contract with the `promotion.campaigns` campaign list
and the `promotionBar` chrome key: types, per-campaign validation in
`normalizeSiteConfig` (malformed campaigns drop out individually), the
always-on editorial fallback campaign in `DEFAULT_SITE_CONFIG`, and a
carry-over in `saveSiteConfig` so existing saves preserve campaigns
until the M4 editor exists.

### Features Implemented

`[ADR 03-003]`

- **Campaign types — `lib/promotions.ts`:** `[ADR 03-003]`
  - `PromotionType = 'editorial' | 'discount' | 'seasonal' |
    'exclusive'`; `PromotionTheme = 'light' | 'dark' | 'accent' |
    'soft'`;
    `PromotionSurface = 'feed' | 'purchase' | 'classic'`;
    `PromotionVisitor = 'new' | 'returning' | 'any'`.
  - `PromotionConditions = { surfaces: PromotionSurface[];
    minCartCents?: number; visitor: PromotionVisitor }`.
  - `PromotionCopy = { label: string; headline: string;
    description: string; ctaLabel: string }`.
  - `PromotionCampaign = { id: string; type: PromotionType;
    priority: number; enabled: boolean; startDate: string | null;
    endDate: string | null; theme: PromotionTheme; ctaUrl: string;
    promoCode?: string; conditions: PromotionConditions | null;
    copy: { pt: PromotionCopy; en: PromotionCopy } }`.
  - `SiteConfig` gains `promotion: { campaigns: PromotionCampaign[] }`.
- **Campaign types & validation — `lib/promotions.ts`:** the
  `Promotion*` types plus an exported `normalizeCampaigns` used by
  `normalizeSiteConfig` (in `lib/site-config.ts`). Per campaign:
  `id` non-empty slug-safe
  (`/^[a-z0-9][a-z0-9-]{0,63}$/`, unique within the list); `type`,
  `theme`, `visitor` enum-checked; `priority` finite number;
  `enabled` boolean; `startDate`/`endDate` ISO-8601 strings or `null`,
  with `startDate <= endDate` when both set; `ctaUrl` internal path
  (`/…`, never `//`) or absolute `https://` URL; `promoCode` optional
  string (reserved — never rendered in v1); `conditions` `null` or a
  valid record (`surfaces` subset — empty or absent means
  unrestricted; `minCartCents` non-negative number when present);
  `copy.pt` and `copy.en` each with `label` and `headline` non-empty
  (`description` and `ctaLabel` may be empty — the expanded layout
  renders them conditionally). Any violation drops that campaign —
  fail-safe on read. `[ADR 03-003]`
- **Defaults — `lib/site-config.ts`:** `DEFAULT_SITE_CONFIG.promotion.campaigns`
  ships exactly one enabled, condition-free, lowest-priority
  `editorial` campaign in `light` theme — own-brand placeholder copy
  in both Locales, no `{remaining}` placeholder, `ctaUrl '/'`
  (identifier hygiene — ADR 00-007). `[ADR 03-003]` `[ADR 00-007]`
- **Chrome key `promotionBar`:** added to `ChromeKey`, `CHROME_KEYS`,
  `DEFAULT_SITE_CONFIG.chrome` (`true`), and `CHROME_LABELS` in
  `app/admin/admin-form.tsx` (label "Promotion Bar", hint describing
  the top-of-site expandable campaign bar — required for
  `Record<ChromeKey, …>` completeness). `[ADR 03-003]` `[ADR 00-002]`
- **Save carry-over — `app/admin/actions.ts`:** `saveSiteConfig`
  populates `next.promotion.campaigns` from `await getSiteConfig()` so a save
  preserves campaigns byte-for-byte until M4's editor writes them;
  documented with the M4 handoff note. `[ADR 03-003]` `[ADR 00-002]`
- **Glossary — `docs/adr/TERMINOLOGY.md`:** add **Promotion Bar**,
  **Campaign**, and **Smart Offer Switcher** under UI Composition
  Terms, verbatim with the ADR definitions. `[ADR 03-003]`
- **Unit tests — `tests/unit/site-config.test.ts` (extend):**
  valid campaigns pass through; each malformed axis drops only the
  offending campaign; missing/duplicate ids rejected; bad date pairs
  rejected; non-https/relative-external `ctaUrl` rejected; missing
  per-Locale copy rejected; `promotion.campaigns` absent → default fallback
  list; `promotion.campaigns: []` honored as an operator's explicit empty list.
  Stamped per the ADR Stamping Requirement. `[ADR 03-003]`
  `[ADR 00-007]`

### Dependencies

`[ADR 03-003]`

- Previous milestones: none.
- External: none — Site Config / Edge Config read path already exists.

### Build and Launch Verification

`[ADR 03-003]`

- Build command: `npm run build`
- Launch command: `npm run dev`
- Verification steps:
  1. `npm run lint`, `npm run type-check`, `npm run test`, `npm run
     build` all pass.
  2. `getSiteConfig()` returns `promotion.campaigns` containing the fallback
     campaign with `promotionBar: true` in `chrome`.
  3. An Admin Console save preserves a hand-seeded local
     `.site-config.local.json` campaign list unchanged.
- Expected result: schema lands silently — no visitor-visible change
  yet; all gates green.

### Testing Instructions

`[ADR 03-003]`

#### What to Test

- `normalizeCampaigns` drop-out behavior per malformed axis and the
  pass-through of a fully valid campaign.
- `promotionBar` toggle presence in Admin Console chrome list.
- Save carry-over: admin save does not wipe `promotion.campaigns`.

#### How to Test

1. `npm run test` → extended site-config suite green.
2. Write `.site-config.local.json` with a custom campaign → save
   toggles in `/admin` → confirm the campaign survives in the file.
3. Toggle `promotionBar` off in admin → confirm `chrome.promotionBar`
   persists as `false`.

#### Expected Test Results

- All unit tests pass; campaigns survive a save; the new chrome key
  behaves like existing keys.

### Temporary Test Controls

`[ADR 03-003]`

- A hand-written `.site-config.local.json` campaign (untracked) to
  exercise carry-over — removed after M4 makes the editor the write
  path; never committed.

### Completion Criteria

`[ADR 03-003]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] Temporary test controls documented
- [ ] Glossary terms added verbatim

---

## Milestone 2: Smart Offer Switcher Library

`[ADR 03-003]`

### Description

`[ADR 03-003]`

Implement `lib/promotions.ts` — the pure, client-safe selection
pipeline and copy helpers — fully unit-tested before any component
consumes it.

### Features Implemented

`[ADR 03-003]`

- **Surface classification — `lib/promotions.ts` (new):**
  `classifySurface(pathname): PromotionSurface` — locale-stripped
  pathname `'/'` → `'feed'`, `'/checkout'` → `'purchase'`, anything
  else → `'classic'`; mirrors `ChromeFrame`'s `SHELL_ROUTES` and is
  the single source the bar uses. `[ADR 03-003]` `[ADR 03-002]`
- **Schedule — `isWithinSchedule(campaign, now)`:** `startDate`/`endDate`
  bounds inclusive; `null` bound is open-ended. `[ADR 03-003]`
- **Eligibility — `selectCampaign({campaigns, pathname, now, visitor,
  cartSubtotalCents, cartHydrated,
  purchaseSurfaceEnabled})`:** ordered pipeline —
  `enabled` → schedule → `conditions.surfaces` contains the classified
  surface → `visitor` matches (`'any'` always matches) → Cart
  conditions (`minCartCents` present ⇒ requires `cartHydrated` AND
  `cartSubtotalCents >= minCartCents`; until hydrated the campaign is
  ineligible — conservative, never optimistic) → Purchase-Surface
  Gate (a campaign conditioned on the purchase surface only is
  ineligible while the gate is closed). Eligible campaigns sort by
  `priority` descending;
  ties keep array order for determinism (the operator's list order
  is the tie-break). When nothing is
  eligible, the enabled fallback campaign (the lowest-priority
  condition-free enabled campaign) is selected — the switcher always
  has a truthful answer while the toggle is on. `[ADR 03-003]`
- **Purchase-Surface Gate rule:** while `purchaseSurfaceEnabled` is
  `false`, a campaign whose `conditions.surfaces` is exactly
  `['purchase']` is ineligible; `isPurchasePath(ctaUrl)`
  (`'/checkout'` or `'/checkout/'`-prefixed paths, exact-matched)
  is exported so the component suppresses such CTAs — fail-closed, consistent with the
  existing gates. `[ADR 03-003]` `[ADR 00-004]`
- **Copy interpolation — `interpolateRemaining(text, remainingCents,
  locale)`:** replaces `{remaining}` with `Intl.NumberFormat(locale,
  {style: 'currency', currency: 'EUR'})` output. `[ADR 03-003]`
  `[ADR 00-005]`
- **Free-shipping remainder:** computed inline in the component as
  `Math.max(0, freeShippingThresholdCents - cartCents)` — the value fed
  to `interpolateRemaining` and the check that keeps a `{remaining}`
  campaign's message current. `[ADR 03-003]` `[ADR 00-004]`
- **Unit tests — `tests/unit/promotions.test.ts` (new):** every
  pipeline stage in isolation; ordering and tie-break; fallback
  selection; hydrated gating (pre-hydration exclusion of
  `minCartCents` campaigns); Purchase-Surface Gate exclusion; schedule
  boundaries;
  surface classification incl. unknown and nested paths; gate
  degradation (`['purchase']`-only ineligible, `isPurchasePath`
  true/false cases); `interpolateRemaining` EUR output per Locale;
  Stamped per
  the ADR Stamping Requirement. `[ADR 03-003]` `[ADR 00-007]`

### Dependencies

`[ADR 03-003]`

- Previous milestones: M1 (campaign types, `PromotionSurface`).
- External: none — pure functions, no storage, no React.

### Build and Launch Verification

`[ADR 03-003]`

- Build command: `npm run build`
- Launch command: `npm run dev`
- Verification steps:
  1. `npm run lint`, `npm run type-check`, `npm run test`, `npm run
     build` all pass.
  2. `lib/promotions.ts` has no client-storage or server imports —
     it is bundle-safe for the Island and unit-testable in Node.
- Expected result: selection logic proven before the component exists.

### Testing Instructions

`[ADR 03-003]`

#### What to Test

- The full pipeline matrix (each stage's pass/fail), priority and
  tie-break determinism, fallback, gate degradation, interpolation
  and remainder helpers.

#### How to Test

1. `npm run test` → `promotions.test.ts` green.
2. Code review: confirm no `localStorage`/`window`/`fs` usage inside
   `lib/promotions.ts` — device state enters as function arguments.

#### Expected Test Results

- All unit tests pass; the module is pure.

### Temporary Test Controls

`[ADR 03-003]`

- None — the library is exercised only by unit tests.

### Completion Criteria

`[ADR 03-003]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully

---

## Milestone 3: Promotion Bar Component, Mount & i18n

`[ADR 03-003]`

### Description

`[ADR 03-003]`

The visitor-visible milestone: the `PromotionBar` Island — collapsed
line plus in-flow expanded block — mounted as `ChromeFrame`'s first
child on every Locale route, the classic Header switched to `sticky`,
and the `promotion.*` message namespace in both catalogs.

### Features Implemented

`[ADR 03-003]`

- **Island — `components/layout/promotion-bar.tsx` (new client
  component):** props `{campaigns: PromotionCampaign[];
  purchaseSurfaceEnabled: boolean}`. `[ADR 03-003]` `[ADR 00-001]`
  - Surface from `usePathname()` (`lib/navigation` — locale-stripped)
    via `classifySurface`.
  - Visitor class: `hf-visited` localStorage marker — absent ⇒ `'new'`
    then written on mount; present ⇒ `'returning'`. Anonymous,
    client-held, never transmitted (Like Token posture). `[ADR 00-008]`
  - Permanence: no dismiss affordance and no dismissal state — the
    bar stays mounted while a campaign is eligible; the row toggle is
    the only control. `[ADR 03-003]`
  - Expansion memory: `hf-promo-expanded` sessionStorage — stores the
    expanded campaign id; a selected campaign renders expanded again
    on navigation within the session.
  - Cart: `useCart()` — `hydrated` gate feeds `cartHydrated`;
    `cartSubtotalCents = Math.round(getTotal() * 100)`.
  - Selection via `selectCampaign`; once expanded, the displayed
    campaign is frozen — the switcher never swaps it until collapsed.
  - Collapsed line: semantic `section` (`aria-label` from
    `promotion.aria_label`) containing a single `button` toggler with
    `aria-expanded`/`aria-controls`; the toggler's accessible name
    comes from its `aria-label` (`promotion.expand` /
    `promotion.collapse`). Its centered text slot cycles between the
    campaign micro-label and the campaign headline on a ~4s cadence —
    collapsed-only, static under `prefers-reduced-motion` — and the
    cycling texts are `aria-hidden` (decorative only). The row toggle
    is the row's only control — no dismiss affordance.
  - Expanded block: a single centered vertical stack — `font-serif`
    headline, body-copy description, CTA — held to the Feed Surface's
    column track (the micro-label lives only in the collapsed row);
    Escape collapses and returns focus to the toggler.
  - CTA: internal `ctaUrl` → locale-aware `Link` (`lib/navigation`);
    absolute `https://` → `<a target="_blank" rel="noopener
    noreferrer">`; `↗` arrow micro-interaction; suppressed when
    `isPurchasePath(ctaUrl)` and
    `!purchaseSurfaceEnabled`. `[ADR 00-004]` `[ADR 00-005]`
  - `{remaining}` interpolation through `interpolateRemaining` fed by
    `Math.max(0, freeShippingThresholdCents - cartCents)`.
  - Themes, token-only: `light` → `bg-surface border-b border-border
    text-text-primary`; `dark` → `bg-text-primary text-surface`;
    `accent` → `bg-primary text-surface` with the expanded block in
    `bg-gradient-to-b from-primary to-accent`; `soft` → `bg-primary/5
    border-b border-primary/10 text-text-primary` — no hex literals,
    no new colors. `[ADR 03-001]`
  - Motion: subtle height/opacity transition gated behind
    `motion-safe:` variants — `prefers-reduced-motion` renders an
    instant swap; no flashing, rotating, or banner-style motion beyond
    the collapsed hook cycle, the ADR's single enumerated exception.
    `[ADR 03-003]`
- **ChromeFrame slot — `components/layout/chrome-frame.tsx`:** new
  `promotionBar?: ReactNode` prop rendered as the first child inside
  `flex min-h-screen flex-col`, before the header mount — on ALL
  routes, including shell routes. `[ADR 03-003]` `[ADR 03-002]`
- **Layout mount — `app/[locale]/layout.tsx`:** when
  `siteConfig.chrome.promotionBar`, pass
  `<PromotionBar campaigns={siteConfig.promotion.campaigns}
  purchaseSurfaceEnabled={purchaseSurfaceEnabled} />` into the new
  slot — same server read path, no new request-time capability.
  `[ADR 03-003]` `[ADR 00-002]`
- **Header `fixed`→`sticky` — `components/layout/header.tsx`:**
  `fixed top-0 left-0 right-0 z-50` → `sticky top-0 z-50` —
  behavior-identical on scroll while letting the in-flow bar push it
  down. Audit classic-chrome routes (`checkout/success`,
  `checkout/cancel`, legal/auxiliary, `not-found`): the header now
  occupies flow height where it previously overlaid — adjust
  page-level leading padding so the rendered top spacing is visually
  identical with the bar absent. `[ADR 03-003]`
- **i18n — `messages/{en,pt}.json`:** new `promotion` namespace,
  key-for-key parity: `aria_label` (section accessible name),
  `expand` / `collapse` (toggler `aria-label`s), `discover` (CTA
  fallback label). `[ADR 00-005]` `[ADR 03-003]`

### Dependencies

`[ADR 03-003]`

- Previous milestones: M1 (schema/keys), M2 (`lib/promotions.ts`).
- External: none.

### Build and Launch Verification

`[ADR 03-003]`

- Build command: `npm run build`
- Launch command: `npm run dev`
- Verification steps:
  1. `npm run lint`, `npm run type-check`, `npm run test`, `npm run
     build` all pass.
  2. `/pt` and `/en`: the fallback campaign renders collapsed at the
     very top — above the Feed Shell on `/` and `/checkout`, above the
     classic header on a legal page; activation expands it in-flow —
     no overlay, content shifts down.
  3. `promotionBar` chrome toggle off (local Site Config) → bar
     absent everywhere.
  4. Classic-chrome pages look identical to before the `sticky`
     change (no doubled top gap).
  5. `PURCHASE_SURFACE_ENABLED` unset: a `/checkout`-CTA campaign
     shows no CTA.
- Expected result: bar live with the fallback campaign; header
  behavior unchanged; gate degradation verified.

### Testing Instructions

`[ADR 03-003]`

#### What to Test

- Mount position per chrome system; expand/collapse in-flow; the
  collapsed-row text cycle (label ↔ headline cadence, collapsed-only,
  static under reduced motion); no dismiss affordance — the bar stays
  mounted while a campaign is eligible; `hf-promo-expanded` session
  memory; `hf-visited` new→returning transition; hydrated-gated cart
  conditions; locale copy selection; CTA suppression under a closed
  gate; keyboard operation and Escape; reduced-motion rendering;
  header `sticky` audit.

#### How to Test

1. Manual pass on `/pt`, `/en`, `/pt/checkout`, a legal route —
   watch the collapsed row cycle label ↔ headline; expand, collapse,
   reload, re-navigate (session memory).
2. DevTools → clear site storage → first visit reads as `new`.
3. Add a cart item, reload → `minCartCents` campaigns become
   eligible only after hydration.
4. Emulate `prefers-reduced-motion` → instant, not animated.
5. Tab through the bar; Escape collapses; focus returns to toggler.

#### Expected Test Results

- All behaviors per ADR 03-003; no console errors; no layout overlap;
  classic pages pixel-consistent.

### Temporary Test Controls

`[ADR 03-003]`

- A local `.site-config.local.json` with multiple synthetic campaigns
  (scheduled, surface-scoped, cart-gated) to exercise the switcher —
  untracked, removed when e2e fixtures land in M7.

### Completion Criteria

`[ADR 03-003]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] Temporary test controls documented
- [ ] `promotion.*` parity verified in both catalogs
- [ ] Sticky-header audit performed — no classic route regressed

---

## Milestone 4: Admin Console Campaigns Editor

`[ADR 03-003]`

### Description

`[ADR 03-003]`

Give the operator a structured campaigns editor in the Admin Console:
per-campaign fields including per-Locale copy, add/remove, and a
strict-validated write path replacing M1's carry-over.

### Features Implemented

`[ADR 03-003]`

- **Promotions section — `app/admin/admin-form.tsx`:** a new section
  rendering one editor card per campaign in `config.promotion.campaigns`:
  `id`, `enabled` checkbox, `type` select, `priority` number,
  `startDate`/`endDate` `datetime-local` inputs, `theme` select,
  `ctaUrl`, `promoCode` (editable, hint marks it reserved — not
  rendered in v1), conditions (surface checkboxes, `minCartCents`
  euros-input converted to cents, `visitor` select), and per-Locale
  copy groups (`PT` / `EN`: label, headline, description, ctaLabel).
  Add-campaign and remove-campaign controls; campaigns serialize to a
  hidden `promotion.campaigns` JSON form field on submit. `[ADR 03-003]`
- **Write path — `app/admin/actions.ts`:** parse the `promotion.campaigns`
  JSON field; run `normalizeCampaigns`; **strict mode** — if any
  campaign is invalid, the save returns `{ok: false, error}` naming
  the offending campaigns (fail-loud for the operator);
  on success the validated list replaces `next.promotion.campaigns`.
  The M1 carry-over stays as the absent-field fallback: a save whose
  form omits `promotion.campaigns` preserves the stored list rather
  than wiping it. `[ADR 03-003]` `[ADR 00-002]`
- **Label refinement — `app/admin/admin-form.tsx`:** finalize the
  `promotionBar` chrome hint to reference the campaigns editor.

### Dependencies

`[ADR 03-003]`

- Previous milestones: M1 (types, validator, carry-over to replace).
- External: none.

### Build and Launch Verification

`[ADR 03-003]`

- Build command: `npm run build`
- Launch command: `npm run dev`
- Verification steps:
  1. `npm run lint`, `npm run type-check`, `npm run test`, `npm run
     build` all pass.
  2. `/admin`: create/edit/enable/disable/schedule a campaign, save;
     the change propagates to the bar within seconds (local JSON or
     Edge Config).
  3. An invalid campaign (empty headline, bad dates) → save fails
     with a named error; nothing is written.

### Testing Instructions

`[ADR 03-003]`

#### What to Test

- Round-trip: every field survives save→reload; add/remove works;
  strict validation surfaces named errors; the toggle key still
  governs the bar.

#### How to Test

1. Edit the fallback campaign's `pt.headline` → save → verify on
   `/pt`.
2. Submit an invalid campaign → confirm the error names it.
3. Save with `promotion.campaigns` empty → bar renders nothing (toggle still
   on but no eligible campaign — expected operator outcome).

#### Expected Test Results

- Full round-trip; strict validation; carry-over removed cleanly.

### Temporary Test Controls

`[ADR 03-003]`

- None beyond the untracked local Site Config file.

### Completion Criteria

`[ADR 03-003]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully

---

## Milestone 5: Free-Shipping Threshold & Checkout Swap

`[ADR 03-003]`

### Description

`[ADR 03-003]`

Make the bar's free-shipping promise truthful: an operator-editable
threshold in Site Config, a complimentary PT/EU rate pair, and
the checkout Route Handler swapping to it when the server-validated
subtotal qualifies. (Independent of M3/M4 — may run in parallel.)

### Features Implemented

`[ADR 03-003]`

- **Threshold + free pair — `lib/shipping.ts`:**
  `siteConfig.shipping.freeShippingThresholdCents: number` —
  operator-editable Site Config data (default €100, `0` disables; the
  `FREE_SHIPPING_THRESHOLD_CENTS` constant is only the normalization
  fallback). `FREE_SHIPPING_OPTIONS` — PT/EU pair mirroring
  `SHIPPING_OPTIONS`: same display names and estimates, ids
  `pt-free`/`eu-free`, `amountCents: 0`. `[ADR 03-003]` `[ADR 00-004]`
- **Selector — `shippingOptionsForSubtotal(subtotalCents)`:** returns
  `FREE_SHIPPING_OPTIONS` when the threshold is set and met, else
  `SHIPPING_OPTIONS` — pure, unit-testable. `[ADR 03-003]`
- **Route Handler swap — `app/api/checkout/route.ts`:** after
  `validateCart` succeeds, compute `subtotalCents` from the validated
  lines (`Σ quantity × Math.round(PRODUCT.price * 100)`) and map
  `shippingOptionsForSubtotal(subtotalCents)` onto `shipping_options`.
  Prices still come only from Product Data — server-authoritative.
  `[ADR 03-003]` `[ADR 00-004]`
- **Unit tests — `tests/unit/promotions.test.ts` (checkout
  describe):** below threshold → standard pair; at/above the Site
  Config threshold → complimentary pair (amount 0, preserved
  estimates); threshold 0 → standard pair at any subtotal; swap keys
  on `siteConfig.shipping.freeShippingThresholdCents`, not the
  fallback constant. Stamped per the ADR Stamping Requirement. `[ADR 03-003]` `[ADR 00-007]`

### Dependencies

`[ADR 03-003]`

- Previous milestones: none (threshold constant consumed by M2's
  helper — ship together or land M5 first; `lib/shipping.ts` is
  client-safe for the Island import).
- External: none.

### Build and Launch Verification

`[ADR 03-003]`

- Build command: `npm run build`
- Launch command: `npm run dev`
- Verification steps:
  1. `npm run lint`, `npm run type-check`, `npm run test`, `npm run
     build` all pass.
  2. With a test threshold below the product price: a checkout Session
     created in test mode shows €0.00 shipping options on the Hosted
     Checkout page.
  3. With threshold `null`: standard rates appear — behavior
     unchanged.

### Testing Instructions

`[ADR 03-003]`

#### What to Test

- `shippingOptionsForSubtotal` boundaries; the Route Handler's
  subtotal computation against `validateCart` output; the
  disabled-threshold path.

#### How to Test

1. `npm run test` → `promotions.test.ts` green.
2. Set a threshold in a non-production env, run a test checkout with
   Stripe test keys → inspect `shipping_options` on the hosted page.

#### Expected Test Results

- Free rates appear only when the server-validated subtotal qualifies;
  disabled threshold preserves current behavior exactly.

### Temporary Test Controls

`[ADR 03-003]`

- A non-production threshold value set only in local/test env files to
  exercise the swap — owner sets the production value; never
  committed.

### Completion Criteria

`[ADR 03-003]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] Temporary test controls documented

---

## Milestone 6: Analytics Events & Accessibility Polish

`[ADR 03-003]`

### Description

`[ADR 03-003]`

Wire the four enumerated aggregate events through `track()` and
complete the accessibility pass on the bar.

### Features Implemented

`[ADR 03-003]`

- **Events — `components/layout/promotion-bar.tsx`:** `track()` from
  `@vercel/analytics` (existing dependency — zero new deps): `[ADR 03-003]`
  `[ADR 00-008]`
  - `promo_displayed` — once per `campaignId` per browsing session
    (deduped via sessionStorage `hf-promo-displayed`); a display on
    one surface counts for the session regardless of surface.
  - `promo_expanded` / `promo_collapsed` — on each toggler
    activation; `promo_collapsed` also fires on the other collapse
    paths (Escape key, expanded-region close) — every collapse is
    measured (not on navigation).
  - `promo_cta_clicked` — on CTA activation, before navigation.
  - Payloads are `{campaignId, surface}` exactly — no copy, no
    visitor class, no Cart value, no identity. These are the
    enumerated events the ADR rules within the ADR 00-008 posture;
    per-visitor funnels remain out of scope.
- **Accessibility pass:** verify `section` + `button` toggler with
  `aria-expanded`/`aria-controls` and the toggler's accessible name
  carried by `aria-label` (`promotion.expand`/`promotion.collapse`);
  the cycling collapsed texts `aria-hidden`; visible `focus-visible`
  rings on all controls;
  Escape collapses and returns focus to the toggler; full keyboard
  operability; token-based contrast across all themes; `motion-safe:`
  gating confirmed. `[ADR 03-003]` `[ADR 03-001]`

### Dependencies

`[ADR 03-003]`

- Previous milestones: M3 (the component).
- External: `@vercel/analytics` `track()` — already a dependency.

### Build and Launch Verification

`[ADR 03-003]`

- Build command: `npm run build`
- Launch command: `npm run dev`
- Verification steps:
  1. `npm run lint`, `npm run type-check`, `npm run test`, `npm run
     build` all pass.
  2. DevTools/network or a debug sink confirms each event fires with
     exactly `{campaignId, surface}` — `promo_displayed` once per
     campaign per session.

### Testing Instructions

`[ADR 03-003]`

#### What to Test

- Each event fires on the right interaction with the exact payload;
  dedup of `promo_displayed`; no event carries copy, visitor class,
  or identity; a11y checklist items above.

#### How to Test

1. Interact: display → expand → collapse → CTA; assert the
   four events and payloads.
2. Keyboard-only pass across the bar in all themes and both Locales.
3. Emulate reduced motion → instant transition.

#### Expected Test Results

- Enumerated events only, aggregate payloads only, a11y clean.

### Temporary Test Controls

`[ADR 03-003]`

- None.

### Completion Criteria

`[ADR 03-003]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully

---

## Milestone 7: E2E Coverage & Quality Gate

`[ADR 03-003]`

### Description

`[ADR 03-003]`

Playwright coverage for the bar across chrome systems, Locales,
persistence, and the Purchase-Surface Gate — then the closing quality
gates.

### Features Implemented

`[ADR 03-003]`

- **Fixture — `tests/fixtures/site-config-promo.json`:** synthetic
  campaigns only (identifier hygiene): a `classic`-surface campaign, a
  `purchase`-surface campaign with `ctaUrl: '/checkout'`, a scheduled
  out-of-window campaign, and a second eligible campaign for the
  priority ordering and session expanded-state-restore checks —
  consumed via `SITE_CONFIG_LOCAL_PATH`
  per the existing per-server fixture pattern. `[ADR 03-003]`
  `[ADR 00-007]`
- **E2E — `tests/e2e/promotion-bar.spec.ts` (new):** `[ADR 03-003]`
  - Bar renders collapsed above the Feed Shell on `/pt` and above the
    classic header on a legal route; absent when `promotionBar` is
    off.
  - Expansion is in-flow (header/content shift down; no fixed
    overlay) and stacks on the mobile project.
  - The collapsed row carries no dismiss control; the expanded state
    restores across reload within the session (`hf-promo-expanded`).
  - With the gate closed, the `/checkout` CTA is suppressed — zero
    `a[href*="/checkout"]` inside the bar, consistent with the
    existing purchase-surface specs.
  - `pt`/`en` campaign copy and `promotion.*` chrome strings render
    per Locale.
  - Escape collapses.
- **Quality gates:** `npm run lint`, `format`, `type-check`, `test`,
  `build` green; code-quality-reviewer review performed and all issues
  fixed; adr-governor compliance review performed and all violations
  resolved. `[ADR 00-007]`

### Dependencies

`[ADR 03-003]`

- Previous milestones: M1–M6.
- External: Playwright harness per existing specs.

### Build and Launch Verification

`[ADR 03-003]`

- Build command: `npm run build`
- Launch command: `npm run dev` / Playwright `next start` servers
- Verification steps:
  1. Full gate suite green including the new spec.
  2. Fixture-driven runs show each expected campaign per surface.

### Testing Instructions

`[ADR 03-003]`

#### What to Test

- Everything in "Features Implemented" — the spec IS the checklist.

#### How to Test

1. `npm run test` (unit) and the Playwright suite.
2. Re-run with `PURCHASE_SURFACE_ENABLED` toggled per the existing
   gate-spec pattern.

#### Expected Test Results

- All specs green in both gate postures and both Locales.

### Temporary Test Controls

`[ADR 03-003]`

- The promo Site Config fixture — a tracked test asset, retained
  (not removed): it is the suite's input, not a debug control.

### Completion Criteria

`[ADR 03-003]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit + e2e)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] No real-world identifier in any tracked file (copy, fixtures, tests)

---

## Cross-Cutting Requirements

`[ADR 03-003]`

- **ADR stamping:** every ADR-implementing unit carries the required
  stamp (see "ADR Stamping Requirement"). `[ADR 03-003]`
- **Identifier hygiene:** campaign copy, fixtures, and tests use
  placeholders and own-brand content only — no real identifiers.
  `[ADR 00-007]` `[ADR 03-003]`
- **Two-Locale parity:** `promotion.*` keys ship in `pt` + `en` with
  key-for-key parity (covered by `messages-parity.test.ts`); campaign
  copy requires both Locales at validation time. `[ADR 00-005]`
  `[ADR 03-003]`
- **No new dynamic surface:** no Route Handlers, no middleware duties,
  no request-time rendering additions — the bar consumes the existing
  Site Config read; the checkout swap happens inside the existing
  handler. `[ADR 00-002]` `[ADR 03-003]`
- **No new dependencies:** `track()` comes from the already-installed
  `@vercel/analytics`; storage keys are client-local Web Storage.
  `[ADR 00-008]` `[ADR 03-003]`
- **Cookieless posture preserved:** on-device keys are never
  transmitted; events are the four enumerated aggregate signals only.
  `[ADR 00-008]` `[ADR 03-003]`
- **Fail-closed gates:** closed `promotionBar` toggle → no bar; closed
  Purchase-Surface Gate → no `/checkout` CTA; `0` threshold →
  standard shipping. `[ADR 00-004]` `[ADR 03-003]`
- **Modernize, don't rewrite:** extend Site Config, ChromeFrame, the
  admin form, the message catalogs, and the shipping module — no
  gratuitous refactors. `[ADR 00-001]`

## Risks & Mitigations

`[ADR 03-003]`

| Risk | Impact | Mitigation |
|------|--------|------------|
| Campaign copy drifts from catalog-managed tone/parity | Medium | Validation requires both Locales; the Admin Console groups copy per-Locale; the trade-off is ADR-recorded. |
| Hand-edited Edge Config breaks the bar | Medium | `normalizeSiteConfig` drops malformed campaigns individually; the fallback campaign keeps the bar truthful; the write path validates strictly. |
| Header `sticky` change regresses classic pages | Medium | M3 audit checklist; visual pass on every classic-chrome route; e2e covers mount order. |
| Free-shipping copy lies if operator copy mismatches the threshold | Medium | Threshold is one Site Config value enforced server-side at Session creation; `{remaining}` interpolates from it; operator docs name the bound. |
| Bar layout shift annoys on every route | Low | Single thin collapsed line held to the feed column track; per-session expansion memory. |
| `hf-visited` misclassifies after storage clears | Low | Coarse presentation hint by design — never a business metric; aggregate events carry no visitor class. |
| `ctaUrl` operator input becomes an unsafe link | Low | Validation restricts to internal paths and `https://`; locale-aware `Link` preserves the Locale prefix. |
| Analytics events over-collect | Low | Payloads are enumerated `{campaignId, surface}` — review gate verifies; anything more needs a future ADR. |
| Selection flip post-hydration flashes a different campaign | Low | `hydrated` gate makes cart-conditioned campaigns ineligible pre-hydration (conservative), and expansion freezes the choice. |

## Open Questions for the Owner (resolve before launch)

`[ADR 03-003]`

1. ~~Provide the real `FREE_SHIPPING_THRESHOLD_CENTS` value~~ —
   resolved: the owner confirmed €100, carried as
   `siteConfig.shipping.freeShippingThresholdCents` (Admin Console
   editable); the `lib/shipping.ts` constant is only the fallback
   default. `[ADR 03-003]` `[ADR 00-004]`
2. Approve the fallback campaign's default copy in both Locales and
   the first real campaign set. `[ADR 03-003]` `[ADR 00-005]`
3. Confirm whether `promoCode` rendering should land once the PSP's
   promotion-code support is enabled — a small follow-up, not part of
   v1. `[ADR 03-003]` `[ADR 00-004]`

## Completion Verification

`[ADR 03-003]`

Before marking this plan as complete, verify:
- [ ] All milestones have been reviewed
- [ ] All sub-tasks in each milestone have been checked
- [ ] Code has been searched for each implementation
- [ ] Missing items have been documented or implemented
- [ ] Each section is stamped with its ADR reference(s)
- [ ] code-quality-reviewer and adr-governor gates passed per milestone
- [ ] A verification report has been generated
