# Landing Feed Restyle — Implementation Plan

## Purpose

`[ADR 03-002]`

Implementation plan for the owner-approved landing restyle: the Locale
landing roots are recomposed as a three-column Feed Shell (Nav Rail +
Feed Surface + Suggestions Rail) and the checkout page is reduced to
the Simplified Purchase Surface, which the same Feed Shell wraps on the
purchase route — the shell composes the Locale landing roots and
`/{locale}/checkout`; post-checkout, auxiliary, legal, and admin routes
keep the classic header/footer chrome. The pattern mirrors a
creator-subscription platform's three-column feed layout — pattern only;
HolyFans branding, copy, and imagery exclusively. This plan carries ALL
implementation detail; ADR 03-002 carries none by rule.

Governing documents:
- `docs/adr/03-ui/03-002-landing-feed-composition.md` — the decision
- `docs/adr/TERMINOLOGY.md` — canonical glossary (all terms used verbatim,
  incl. Feed Shell, Nav Rail, Feed Surface, Post Card, Media Slot,
  Decorative Interaction Row, Suggestions Rail, Simplified Purchase
  Surface)
- `docs/adr/00-core/00-001`, `00-002`, `00-004`, `00-005`, `00-006`,
  `00-007`, `00-008`, `00-009` and `docs/adr/03-ui/03-001` — constraining
  ADRs (framework/Islands, dynamic-surface boundary, checkout contract,
  i18n, media pipeline, quality/tooling, analytics, WhatsApp surfaces,
  design tokens)
- `docs/plans/holyfans-store-implementation-plan.md` — master plan this
  restyle lands on top of

**Scope note (route vocabulary):** "the purchase route", "the checkout
page", and `/{locale}/checkout` references throughout this plan
describe the surface's path as-built for the milestones documented
here. The canonical product route is now `/<Locale>/product/<slug>`
(ADR 00-011); when the route rename lands, these references map onto
the Product Page route. The post-checkout `/{locale}/checkout/success`
and `cancel` pages keep their paths.

## Architecture Summary (per ADRs)

`[ADR 03-002]`

- **Shell composition:** the Feed Shell — Nav Rail, Feed Surface,
  Suggestions Rail — composes the Locale landing roots and the purchase
  route, with no classic header/footer on either; post-checkout,
  auxiliary, legal, and admin routes keep classic chrome. On the
  landing the Feed Surface is the Post Card scroll; on the purchase
  route it carries the Simplified Purchase Surface as a single centered
  panel (not a Post Card — no decorative affordances). `[ADR 03-002]`
- **Conversion endpoint:** every Media Slot links to the Simplified
  Purchase Surface within the same Locale; the purchase surface submits
  one Cart line through the existing checkout Route Handler into the
  PSP's Hosted Checkout. `[ADR 03-002]` `[ADR 00-004]` `[ADR 00-005]`
- **Decorative affordances:** the Decorative Interaction Row is
  presentational only — an Island with ephemeral client-local state,
  never persisted or transmitted; no new dynamic surface, no analytics
  signal. `[ADR 03-002]` `[ADR 00-001]` `[ADR 00-002]` `[ADR 00-008]`
- **Site Config:** the six existing SectionKeys are retained and remap to
  feed units; Admin Console labels updated; `normalizeSiteConfig`
  unchanged — stored configs keep working. `[ADR 03-002]` `[ADR 00-002]`
- **Design/media:** canonical Design Tokens and Brand Palette only
  (token-level mapping in "Visual Tokens — Canonical Palette Mapping");
  media from in-repo masters through the framework image component.
  `[ADR 03-001]` `[ADR 00-006]`
- **WhatsApp surfaces:** the Inbound Contact Surface stays global chrome
  with adjusted mobile offset; the Outbound Share Surface moves to the
  Simplified Purchase Surface (the new canonical purchase block).
  `[ADR 00-009]` `[ADR 03-002]`
- **Hygiene/i18n:** no third-party brand text or identifiers; every
  string in `pt` + `en` with key-for-key parity.
  `[ADR 00-007]` `[ADR 00-005]`

## ADR Stamping Requirement (mandatory for all implementation work)

`[ADR 03-002]`

Every unit of functionality that implements ADR-defined behavior MUST
carry a stamp comment in the form:

```
Implements ADR <number>: <ADR title> - "<quoted ADR section/requirement>"
```

For this plan the canonical stamp is:

```
Implements ADR 03-002: Landing Page Composition — Three-Column Feed
Shell with Simplified Purchase Surface - "<quoted ADR 03-002 requirement>"
```

- Stamp individual units — components, helpers, config entries, tests —
  not just whole files (TS docblock `/** … */`).
- Tests exercising ADR-defined behavior carry the same stamp.
- No new technology, communication pattern, or system boundary may be
  introduced without an ADR. If implementation reveals an unclear or
  blocking ADR/plan, the developer MUST escalate to the user, referencing
  the document.

## Repo State Note (implementation context, not architecture)

`[ADR 03-002]`

- Landing today: `app/[locale]/page.tsx` renders the Feed Shell
  (`components/feed/feed-shell.tsx` — Nav Rail, Post Card scroll,
  Suggestions Rail, mobile bands); `app/[locale]/layout.tsx` mounts
  header/footer inside `components/layout/chrome-frame.tsx`, which
  suppresses them where the locale-stripped pathname is `/`.
- ChromeFrame today: suppression predicate is `pathname === '/'` —
  the checkout route still renders classic header/footer; widened to
  `{'/','/checkout'}` per the M2 feature list (`/checkout/success` and
  `/checkout/cancel` stay outside the shell).
- `buildFeedNavEntries` (`components/feed/nav-entries.tsx`) emits
  in-feed anchors (`#feed`, `#products`, `#post-faq`) — dead targets
  off the landing; route-aware hrefs per the M2 feature list.
- On-disk masters: `public/images/product-female-1..4.jpg` and
  `og-image.jpg` only — the `product-male-*.jpg` set referenced by
  Product Data is absent (pre-existing master-plan M2 gap). The feed
  uses the four existing masters + branded placeholder media.
- Checkout today: `app/[locale]/checkout/page.tsx` renders
  `components/sections/buy-now.tsx` (the Simplified Purchase Surface,
  with `TestModeBanner`) behind the fail-closed
  `PURCHASE_SURFACE_ENABLED` gate (`lib/purchase-surface.ts`, plan M0
  temporary control) — under classic header/footer chrome, the piece
  this plan wraps inside the Feed Shell. `checkout/{success,cancel}`
  are PSP-return pages and keep classic chrome. `POST /api/checkout`
  accepts `{items: [{variantId, quantity}], locale, attemptId}` and
  returns `{url}`; error contract: `409 cart_drift + corrections`,
  `400 invalid_request`, `404/429/502 checkout_unavailable`.
- `MobileStickyCta` is deleted; its role is absorbed by the shell's
  mobile bottom navigation band under the retained `mobileStickyCta`
  chrome key.
- `WhatsAppBubble` anchors `bottom-24 right-4` on mobile to clear the
  bottom navigation band; the same clearance must hold on the purchase
  route.
- `e2e` contract today: `purchase-surface.spec.ts` asserts zero
  `a[href*="/checkout"]` elements on `/pt` and `/en` while the gate is
  closed — every checkout link in the Feed Shell (media slots, Nav Rail
  CTA, cart entry, bottom nav entry, suggestion cards) MUST be
  conditional on the gate.
- `tailwind.config.js` already carries the canonical Brand Palette
  (`primary #0369a1`, `accent #075985`, `background #fafafa`,
  `surface #ffffff`, `text-primary #111827`, `text-secondary #6b7280`,
  `border #e5e7eb`); the script face and hard-coded `rgba(...)`
  literals are removed per "Visual Tokens — Canonical Palette Mapping".

## Visual Tokens — Canonical Palette Mapping

`[ADR 03-001]` `[ADR 03-002]`

The canonical Brand Palette mirrors the creator-subscription platform's
light feed visual language: near-white page, white cards, light-gray
borders and secondary text, a bright blue accent. Every literal lives
in the Design Token layer; components consume tokens, never hex values.

### Token remap — `tailwind.config.js` `theme.extend.colors`

`[ADR 03-001]`

| Token | Superseded value | Canonical value | Role |
|-------|------------------|-----------------|------|
| `background` | `#ffffff` | `#fafafa` | near-white page wash behind the feed and rails |
| `surface` | `#f8fafc` | `#ffffff` | white card surfaces (Post Cards, rail cards, purchase card) |
| `primary` | `#1e3a5f` | `#0369a1` | bright blue accent: CTAs, links, active/highlighted states (white text ≈5.7:1 — AA at all sizes) |
| `accent` | `#d4af37` | `#075985` | deepened blue — hover/emphasis companion of `primary` (white ≈7:1) |
| `text-primary` | `#1a202c` | `#111827` | near-black primary text |
| `text-secondary` | `#4a5568` | `#6b7280` | light-gray secondary text (captions, metadata, handles) |
| `border` | `#e2e8f0` | `#e5e7eb` | light-gray card edges and rail separators |
| `tshirt-*` | unchanged | unchanged | garment artwork only — never UI chrome |

### Font roles — `fontFamily` + `app/[locale]/globals.css`

`[ADR 03-001]`

- `sans` (Inter) — default for body text and all UI chrome (`body`
  already applies `font-sans`; unchanged).
- `serif` (Playfair Display) — **whitelist: the brand mark/wordmark and
  headings only.** The `globals.css` `h1–h6` base rule keeps
  `font-serif` but switches its color apply from `text-primary` (now
  the blue accent) to `text-text-primary` so headings stay near-black.
- `script` (Dancing Script) — **removed entirely**: delete the
  `fontFamily.script` token, the `.font-script` utility in
  `globals.css`, and the Dancing Script family from the Google Fonts
  `@import`; re-class its single usage (the footer tagline `h3` in
  `components/layout/footer.tsx`) to `font-sans text-text-secondary`.

### Component class switches

`[ADR 03-001]` `[ADR 03-002]`

- `globals.css` component layer: `.btn-primary` `bg-accent` →
  `bg-primary` with `hover:bg-accent`; `.btn-secondary` `bg-primary` →
  neutral bordered style (`bg-surface border-border text-text-primary`,
  hover `bg-background`); delete the hard-coded `rgba(212,175,55,0.3)`
  and `rgba(30,58,95,0.3)` hover-border literals — replace with
  token-based styling (they violate the no-values-outside-tokens rule).
- `text-primary` audit: usages meaning "interactive accent" stay
  `text-primary` (the token now carries the blue); usages meaning "dark
  heading text" switch to `text-text-primary`. Affected files:
  `app/admin/page.tsx`, `app/admin/admin-form.tsx`,
  `app/[locale]/checkout/{cancel,success}/page.tsx`,
  `components/ui/premium-features-modal.tsx`,
  `components/feed/suggestions-rail.tsx` (`discover_title` h3),
  `components/sections/buy-now.tsx`, `components/layout/header.tsx`,
  `components/layout/footer.tsx`.
- `text-accent` usages (e.g., the footer tagline alongside the removed
  script class) re-class by role: `text-text-secondary` for secondary
  copy, `text-primary` for interactive accents.
- `.card` (`bg-surface border-border`) renders white cards with
  light-gray borders automatically after the remap — no class changes
  on card consumers (`components/feed/*`, suggestion cards, the
  Simplified Purchase Surface card).
- Feed metadata — Post Card handles, authored like counts, and rail
  captions use `text-text-secondary`; interactive affordances (like
  glyph, links, CTAs) use `primary`/`accent`.
- Ordering: the token remap and `globals.css` updates land first inside
  M1 — the Feed Shell renders the palette, so token changes precede or
  accompany the shell components.

## Milestone Overview

`[ADR 03-002]`

| # | Milestone | ADRs | Delivers |
|---|-----------|------|----------|
| 1 | Feed Shell & Landing Recomposition | 03-002, 00-002, 00-005, 00-006, 00-007, 03-001 | `lib/feed-posts.ts`, `components/feed/*` shell (Nav Rail, Post Cards, Suggestions Rail, mobile top/bottom bands), landing page rewrite, Site Config label remap, pathname-aware chrome, feed i18n, tests |
| 2 | Simplified Purchase Surface | 03-002, 00-004, 00-005, 00-009, 00-007 | `components/sections/buy-now.tsx`, `components/feed/feed-posts.tsx` extraction, FeedShell children-slot refactor, checkout page shell wrap, ChromeFrame suppression widening, route-aware nav entries, `?fit=` suggestion preselection, Outbound Share Surface relocation, purchase-flow e2e updates |

Milestones are sequential: M2 builds on M1's shell links and shared
i18n keys. M1 is independently launchable — media slots then link to the
existing (cart-review) checkout page; M2 replaces that page's body.

---

## Milestone 1: Feed Shell & Landing Recomposition

`[ADR 03-002]`

### Description

`[ADR 03-002]`

Recompose each Locale landing root as the Feed Shell: a Nav Rail on the
left, the Feed Surface (a scroll of Post Cards) in the center, and the
Suggestions Rail on the right — plus a minimal top band and a bottom
navigation band on small viewports. Existing section content is
repurposed as feed units under the same Site Config toggles; the classic
header/footer stop rendering on the landing while remaining on
non-landing routes.

### Features Implemented

`[ADR 03-002]`

- **Feed data — `lib/feed-posts.ts` (new):** a typed, in-repo
  `FEED_POSTS` list (content authored alongside Product Data, per
  ADR 00-001's code-managed content model). Each entry:
  `{id, section: SectionKey, captionKey, media, likes}` where `media` is
  `{kind: 'image', src, altKey}` or `{kind: 'placeholder', altKey}` and
  `likes` is a static authored decorative count. Target list (≥3 posts,
  one content domain each): `[ADR 03-002]` `[ADR 00-006]`
  - `post-hero` → `section: 'hero'` — brand intro; strongest available
    master or placeholder.
  - `post-product-1/2/3` → `section: 'products'` — product media
    (`/images/product-female-1..4.jpg` distributed across the three).
  - `post-craft` → `section: 'craftsmanship'` — placeholder media.
  - `post-social-proof` → `section: 'socialProof'` — placeholder media.
  - `post-faq` → `section: 'faq'` — placeholder media; card body embeds
    a condensed FAQ Island (see below).
  - `post-closing` → `section: 'finalCta'` — placeholder media + closing
    CTA caption.
  Feed order is authored, not chronological. Filtering by section toggle
  happens at render: `FEED_POSTS.filter(p => sections[p.section])`.
- **Feed Shell layout — `components/feed/feed-shell.tsx` (new server
  component):** three-column grid inside `min-h-screen`: Nav Rail
  (`hidden md:flex`, fixed/sticky full-height column ~240px at `lg`,
  icon-strip ~64px at `md`), Feed Surface (center, max-w ~600px),
  Suggestions Rail (`hidden lg:block`, ~320px). Renders the mobile top
  band and bottom nav for small viewports. Receives `siteConfig` and
  `purchaseSurfaceEnabled` as props from the page (server-evaluated).
  `[ADR 03-002]` `[ADR 00-002]` `[ADR 00-004]`
- **Nav Rail — `components/feed/nav-rail.tsx`:** brand mark
  (`/logo/logo-mark.png`), store-adapted icon+label entries, language
  toggle, and a prominent bottom CTA. `[ADR 03-002]` `[ADR 00-006]`
  - Entries: Home (scroll to `#feed`), Shop (`#products` — kept on the
    first product post for continuity), FAQ (`#post-faq`), Contact
    (WhatsApp deep link via `whatsappChatUrl(NEXT_PUBLIC_WHATSAPP_NUMBER,
    prefilled)` — hidden when unconfigured, same fail-closed rule as the
    bubble), Cart/Purchase (`/{locale}/checkout` via next-intl `Link`,
    `data-testid="nav-cart"`, rendered only when
    `purchaseSurfaceEnabled`). `[ADR 00-009]` `[ADR 00-004]`
  - Big CTA at the rail's foot → `/{locale}/checkout`, rendered only
    when `purchaseSurfaceEnabled`; localized label.
  - `LanguageToggle` reused in the rail. `[ADR 00-005]`
- **Post Card — `components/feed/post-card.tsx`:** card unit with:
  header (logo-mark avatar, `common.brand` name, decorative handle text
  from `feed.post.handle` — plain text, never a link, never a real
  third-party account name), localized caption, Media Slot, Decorative
  Interaction Row. Each card renders a stable anchor `id="post-<id>"`
  (nav entries scroll to `#post-faq` etc.); the first product post
  additionally carries `id="products"` for continuity with the existing
  anchor convention. `[ADR 03-002]` `[ADR 00-007]` `[ADR 00-005]`
- **Media Slot — `components/feed/media-slot.tsx`:** `next/image` for
  image media (framework optimization, `sizes` per column width) or a
  branded placeholder composition (Brand Palette surface/primary
  backgrounds + logo mark/motif) for `kind: 'placeholder'`. When
  `purchaseSurfaceEnabled` the whole slot is wrapped in a locale-aware
  `Link` to `/checkout` (adds no prefix manually — next-intl `Link`
  from `lib/navigation.ts` handles the Locale); when gated it renders
  the media unlinked — preserving the zero-`/checkout`-links contract.
  `[ADR 03-002]` `[ADR 00-006]` `[ADR 00-005]` `[ADR 00-004]`
- **Decorative Interaction Row — `components/feed/decorative-interaction-row.tsx`
  (Island, `'use client'`):** like glyph + authored count,
  comment and bookmark glyphs. Like is a local `useState` toggle
  (count ±1, ephemeral per mount — no persistence, no transmission, no
  analytics); comment/bookmark are inert (decorative, `aria-hidden` or
  clearly decorative semantics, styled to read as content not controls).
  `[ADR 03-002]` `[ADR 00-001]` `[ADR 00-002]` `[ADR 00-008]`
- **FAQ post body — condensed FAQ Island inside `post-faq`:** first few
  `faq.*` items rendered as a compact expandable list (Island); reuses
  the existing `faq` message namespace. `[ADR 03-002]` `[ADR 00-005]`
- **Suggestions Rail — `components/feed/suggestions-rail.tsx`:** Variant
  suggestion cards (fit name, EUR price, Availability Flag badge —
  sold-out shown, unselectable as links when unavailable), each linking
  to `/checkout` when `purchaseSurfaceEnabled`; a discovery CTA card
  (translated headline + body + button → `/checkout`, gated); legal
  links at the rail's foot (Privacy/Terms — see Temporary Test
  Controls). `[ADR 03-002]` `[ADR 00-004]` `[ADR 00-005]`
- **Mobile chrome:** `[ADR 03-002]`
  - `components/feed/mobile-top-bar.tsx` — slim top band: logo mark +
    `LanguageToggle` (`md:hidden` — present only below the icon-rail
    breakpoint).
  - `components/feed/mobile-bottom-nav.tsx` — consolidated bottom band
    (`md:hidden`, fixed, safe-area padding): icon row mirroring the rail
    entries (Home, Shop, FAQ, Contact/WhatsApp, Cart — cart item only
    when `purchaseSurfaceEnabled`); the purchase entry is the visually
    prominent item. Replaces `MobileStickyCta`'s role; governed by the
    retained `mobileStickyCta` chrome key.
- **Landing page rewrite — `app/[locale]/page.tsx`:** renders
  `<FeedShell sections={sections} chrome={chrome}
  purchaseSurfaceEnabled={...}/>`; section toggles filter `FEED_POSTS`.
  `[ADR 03-002]` `[ADR 00-002]`
- **Pathname-aware chrome — `components/layout/chrome-frame.tsx` (new
  client Island) + `app/[locale]/layout.tsx` refactor:** wraps the
  Header/Footer mounts; uses `usePathname()` from `lib/navigation.ts`
  and renders them only when the path is not the Locale root (`/`).
  `WhatsAppBubble` and `CartProvider` mounts are unchanged (global);
  `MobileStickyCta` mount is removed (role absorbed by the mobile
  bottom nav inside the shell). The `header`/`footer` chrome keys still
  govern Header/Footer where they render. `[ADR 03-002]` `[ADR 00-002]`
- **Site Config remap — `lib/site-config.ts`:** `SectionKey` union,
  `SECTION_KEYS`, `CHROME_KEYS`, `DEFAULT_SITE_CONFIG`, and
  `normalizeSiteConfig` are UNCHANGED — identical keys keep stored
  configs working; semantics shift to feed units. Update the type
  docblock: sections now toggle landing feed units.
  `[ADR 03-002]` `[ADR 00-002]`
- **Admin Console labels — `app/admin/admin-form.tsx`:** `SECTION_LABELS`
  updated to feed vocabulary (`hero`→'Hero Post', `socialProof`→'Social
  Proof Post', `products`→'Product Posts', `craftsmanship`→'Craftsmanship
  Post', `faq`→'FAQ Post', `finalCta`→'Closing CTA Post'); `CHROME_LABELS`
  hints updated: `header`/`footer` → 'checkout and auxiliary pages (the
  landing uses the feed layout)'; `mobileStickyCta` → label 'Mobile
  Bottom Nav', hint 'bottom navigation band on small screens (landing)';
  `premiumFeaturesModal` → hint 'hides the "Learn more" modal trigger in
  the hero post'. `[ADR 03-002]` `[ADR 00-002]`
- **Premium Features Modal retained:** `premium-features-modal.tsx`
  stays; its trigger moves into the hero Post Card (a caption-level
  "learn more" control), still governed by `premiumFeaturesModal`.
  `[ADR 03-002]`
- **WhatsApp bubble offset — `components/layout/whatsapp-bubble.tsx`:**
  mobile bottom offset raised to clear the new bottom nav band (target
  `bottom-24` ≈96px, verify against the rendered nav height); desktop
  positioning unchanged. `[ADR 00-009]` `[ADR 03-002]`
- **Component fate (delete after reference search):** `hero.tsx`,
  `social-proof.tsx`, `craftsmanship.tsx`, `faq.tsx`, `final-cta.tsx`,
  `product-gallery.tsx`, `purchase.tsx`, `mobile-sticky-cta.tsx`,
  `objection-handling.tsx`, `variation-selector.tsx` — removed in M1/M2
  once their content/roles are carried by the feed units and M2's
  purchase surface (section section files' copy already lives in the
  message catalogs, so "migration" = rendering existing keys inside Post
  Cards). Retained: `header.tsx`, `footer.tsx`, `language-toggle.tsx`,
  `whatsapp-bubble.tsx`, `whatsapp-glyph.tsx`,
  `premium-features-modal.tsx`, `test-mode-banner.tsx`,
  `clear-cart-on-mount.tsx`, `not-found-content.tsx`,
  `context/cart-context.tsx`. `[ADR 03-002]` `[ADR 00-007]`
- **i18n — `messages/pt.json` + `messages/en.json`:** new `feed`
  namespace (key-for-key parity): `[ADR 00-005]` `[ADR 03-002]`
  - `feed.nav.{home,shop,faq,contact,cart,cta,logo_aria}`
  - `feed.post.{handle,likes,like_aria,comment_aria,bookmark_aria}`
    (`likes` carries a `{count}` placeholder; `handle` is own-brand
    decorative text — see Open Questions)
  - `feed.posts.{post-hero,post-product-1..3,post-craft,post-social-proof,
    post-faq,post-closing}.caption` (+ `title` where needed)
  - `feed.faq.{title,expand,collapse}` (items reuse the `faq` namespace)
  - `feed.suggestions.{title,view,discover_title,discover_body,
    discover_cta,sold_out}`
  - `feed.placeholder.alt`
  - Reused existing namespaces: `common.brand`, `product.fit.*`,
    `product.price` rendering, `faq.*`, `footer.privacy`/`footer.terms`,
    `whatsapp.*`, `navigation.*` where they still fit.
- **Unit tests — `tests/unit/feed-posts.test.ts` (new):** `FEED_POSTS`
  integrity — ≥3 entries; every `section` is a valid `SectionKey`; every
  `kind:'image'` src exists on disk under `public/`; every post has a
  media descriptor and a numeric `likes ≥ 0`; `feed.post.handle`
  contains no URL and no third-party handle. Stamped per the ADR
  Stamping Requirement. `[ADR 00-007]` `[ADR 03-002]`
- **e2e updates:** `[ADR 00-007]` `[ADR 03-002]` `[ADR 00-004]`
  - `purchase-surface.spec.ts` (gated project): unchanged assertions
    still hold — `/pt`,`/en` expose zero `a[href*="/checkout"]` (media
    slots unlinked, `nav-cart` and rail CTA absent); extend to assert
    the feed renders ≥3 Post Cards while gated.
  - `purchase-surface-enabled.spec.ts` (enabled project): `nav-cart`
    visible in the Nav Rail; ≥3 Media Slot links to `/checkout` present.
  - New `feed.spec.ts`: both Locales render ≥3 Post Cards with header
    (brand name), caption, media, Decorative Interaction Row; at `lg`
    viewport Nav Rail + Suggestions Rail visible; at a mobile viewport
    the bottom nav band renders, the Suggestions Rail is hidden, and
    the WhatsApp bubble's bounding box does not overlap the bottom nav.

### Dependencies

`[ADR 03-002]`

- Previous milestones: none (lands on the current codebase). Master-plan
  infrastructure assumed: Site Config/Edge Config read path, Cart
  context, message catalogs, vitest + Playwright scaffolds,
  `lib/whatsapp.ts`, Purchase-Surface Gate.
- External: none. (Owner copy review of captions — see Open Questions.)

### Build and Launch Verification

`[ADR 03-002]`

- Build command: `npm run build`
- Launch command: `npm run dev` (and `npm run start` after build)
- Verification steps:
  1. `npm run lint`, `npm run format:check`, `npm run type-check`,
     `npm run test`, `npm run build` all pass.
  2. `/pt` and `/en` render the Feed Shell: Nav Rail, ≥3 Post Cards,
     Suggestions Rail (desktop width); no classic header/footer on the
     landing.
  3. Mobile viewport: icon-less bottom nav band + slim top band render;
     Suggestions Rail hidden; WhatsApp bubble sits above the bottom nav.
  4. With `PURCHASE_SURFACE_ENABLED` unset: no `/checkout` links anywhere
     on the landing (media slots, rail CTA, cart entries all absent).
  5. With the flag set in a non-production env: Media Slots, rail CTA,
     cart entries, suggestion cards all link to `/{locale}/checkout`.
  6. Admin Console: section toggles show feed-vocabulary labels; toggling
     `faq` hides the FAQ Post Card; toggling `products` hides the
     product posts; a pre-existing stored config applies unchanged.
- Expected result: the landing presents the three-column feed in both
  Locales and at all widths, with checkout links correctly gated.

### Testing Instructions

`[ADR 03-002]`

#### What to Test

- Feed Shell structure: three columns at `lg`, icon rail at `md`, bottom
  band below `md`; feed always primary.
- Post Cards: header (own-brand avatar/name/handle — handle is plain
  text, never a link), localized caption, Media Slot, Decorative
  Interaction Row (like toggles locally; no persistence — reload resets).
- Media Slot click-through: links to `/{locale}/checkout` only when the
  purchase surface is enabled; locale prefix preserved.
- Nav Rail: entries navigate/scroll correctly; Contact opens a WhatsApp
  deep link (when configured); big CTA → checkout (gated).
- Suggestions Rail: variant cards, availability badge, discover CTA,
  legal links.
- Site Config: each section toggle hides its feed unit(s); chrome labels
  updated; stored configs unchanged semantics.
- Mobile: bottom nav band consolidated; WhatsApp bubble clears it;
  language toggle reachable in top band.
- i18n: `feed` namespace parity across `pt`/`en`.
- Hygiene: zero third-party platform names/brands/copy in tracked files.

#### How to Test

1. `npm run test` → new unit tests green (feed data integrity, parity).
2. `npm run build && npm run test:e2e` → updated gate specs + new
   `feed.spec.ts` pass in both Playwright projects.
3. `npm run dev`; visit `/pt` and `/en` at desktop/tablet/mobile widths;
   confirm collapse behavior per the ADR.
4. Toggle each section key via `/admin` (local `.site-config.local.json`
   or preview Edge Config) → corresponding feed unit hides.
5. Set `NEXT_PUBLIC_WHATSAPP_NUMBER` to a synthetic digits-only value →
   Contact entry opens a `wa.me` chat link.
6. With `PURCHASE_SURFACE_ENABLED` unset, view-source/DOM-inspect
   `/en` → zero `href*="/checkout"`; set it → media slots are links.
7. Search tracked files for the mirrored platform's name/brand → zero
   hits.

#### Expected Test Results

- All gates pass; feed renders ≥3 posts in both Locales; gating hides
  every checkout affordance; decorative interactions persist nothing;
  no identifier leakage.

### Temporary Test Controls

`[ADR 03-002]`

- `PURCHASE_SURFACE_ENABLED` — pre-existing plan-M0 control; media-slot
  links and purchase CTAs are exercised with it set in non-production
  envs. Removed at master-plan M4 launch (unchanged by this plan).
- Synthetic digits-only `NEXT_PUBLIC_WHATSAPP_NUMBER` in non-production
  envs to exercise the Contact nav entry (same convention as the
  WhatsApp plan). Never committed.
- Legal links in the Suggestions Rail render as inert placeholders
  (`href="#"`) until the localized legal routes land (master plan M4);
  wired to `/{locale}/privacy` and `/{locale}/terms` when those pages
  exist. Removal: when legal pages ship.

### Completion Criteria

`[ADR 03-002]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit/e2e)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] Temporary test controls documented
- [ ] Zero `a[href*="/checkout"]` on the landing while gated (both Locales)
- [ ] No third-party brand/identifier in any tracked file
- [ ] WhatsApp bubble and bottom nav never overlap on mobile

---

## Milestone 2: Simplified Purchase Surface

`[ADR 03-002]`

### Description

`[ADR 03-002]` `[ADR 00-004]`

Replace the cart-review checkout page with the Simplified Purchase
Surface — Variant selection, quantity, VAT-inclusive EUR price, and a
single purchase action posting one Cart line to the existing checkout
Route Handler — rendered inside the Feed Shell on the purchase route:
the shell's Nav Rail, center column (as a plain centered panel, not a
Post Card), Suggestions Rail, and mobile bands wrap the surface so
discovery and conversion share one chrome system. The Cart remains
underneath as the shopper-held collection (single line) — preserving
cancel-preserved and drift-correction semantics. The Outbound Share
Surface moves here from the retired product gallery.

### Features Implemented

`[ADR 03-002]` `[ADR 00-004]`

- **`components/sections/buy-now.tsx` (new Island) replacing
  `purchase.tsx`:** `[ADR 03-002]` `[ADR 00-004]`
  - Single centered card: product image (first Variant image or
    placeholder), name, EUR price (VAT-inclusive display unchanged),
    fit selector (the two-card Variant pattern, Availability Flag
    honored — sold-out Variant unselectable with the "coming soon"
    treatment), quantity stepper clamped to `[1, maxQuantity]` per the
    Variant's Purchase Cap, and one primary submit.
  - State: `selectedVariant`, `quantity`, `isProcessing`, `failure`
    (same `CheckoutFailure` union: `drift` | `unavailable`); per-mount
    `attemptId` via `crypto.randomUUID()` for idempotent submit (ADR
    00-004 semantics carried over verbatim).
  - On mount: if the hydrated Cart holds a line, preselect its Variant
    and quantity (returning-shopper/cancel continuity); hold render
    until `hydrated`.
  - Submit: `clearCart()` then `addItem(PRODUCT, variant, quantity)`
    (the Cart stays the submission carrier — a single line), then POST
    `/api/checkout` with `{items: [{variantId, quantity}], locale,
    attemptId}` — identical request contract; on `409` apply the
    corrections to the Cart and surface the localized drift panel
    (single-line corrections: `over_cap` clamps, `sold_out`/`unknown`
    empties — shopper reselects); on `!ok`/network/`!url` surface the
    localized unavailable panel; on success `window.location.href =
    data.url` to the PSP Hosted Checkout.
  - `data-testid="purchase-surface"` retained so existing specs anchor.
  - `TestModeBanner` kept on the page; Outbound Share Surface mounted
    beneath the buy action (`whatsappShareUrl(share_text +
    SITE_CONFIG.url)`, `rel="noopener noreferrer"`, localized label) —
    the Simplified Purchase Surface is the canonical purchase block.
    `[ADR 00-009]`
- **FeedShell children-slot refactor — `components/feed/feed-shell.tsx`
  + `components/feed/feed-posts.tsx` (new):** single shell mount point,
  no second shell implementation. Extract the filtered Post Card list —
  `FEED_POSTS.filter(p => sections[p.section])` plus the per-post
  `PremiumModalTrigger`/`FeedFaq` slots — into `FeedPosts` receiving
  `sections` and `purchaseSurfaceEnabled`. `FeedShell` becomes the
  shared chrome: `MobileTopBar`, `NavRail`, the center-column wrapper
  (`id="feed"`, `w-full max-w-xl border-border bg-background
  md:border-x`), `SuggestionsRail`, and the gated `MobileBottomNav` +
  `pb-20` clearance, with `children` rendered inside the center column.
  The `sections` prop moves from `FeedShell` to `FeedPosts`; `chrome`
  stays on the shell (`mobileStickyCta` → band mount + clearance;
  `premiumFeaturesModal` consumed inside `FeedPosts`). The landing
  renders `<FeedShell chrome={chrome} purchaseSurfaceEnabled={…}>
  <FeedPosts sections={sections} purchaseSurfaceEnabled={…}/>
  </FeedShell>`; the purchase route renders `<FeedShell chrome={chrome}
  purchaseSurfaceEnabled={…}><TestModeBanner/><BuyNow/></FeedShell>`.
  Stamp per the ADR Stamping Requirement, quoting the Feed Surface's
  "single occupant … plain centered panel" clause for the
  children-slot contract. `[ADR 03-002]`
- **Checkout page — `app/[locale]/checkout/page.tsx`:** same
  `force-dynamic` + fail-closed `isPurchaseSurfaceEnabled()` gate
  (`notFound()` unchanged); reads `getSiteConfig()` for `chrome` and
  renders `<FeedShell chrome={chrome} purchaseSurfaceEnabled={…}>` with
  `TestModeBanner` + `BuyNow` as center-column children —
  `TestModeBanner` first, the purchase card beneath. The `<main
  className="min-h-screen">` wrapper is dropped (the shell supplies the
  min-height). The purchase card renders inside the ~576px (`max-w-xl`)
  column — cap any internal max-width so the card fills but never
  overflows the column measure. `[ADR 03-002]` `[ADR 00-004]`
  `[ADR 00-002]`
- **ChromeFrame suppression widening —
  `components/layout/chrome-frame.tsx`:** the suppression predicate
  widens from `pathname === '/'` to `pathname === '/' ||
  pathname === '/checkout'` — classic header/footer suppressed on both
  shell routes. `/checkout/success` and `/checkout/cancel` are NOT in
  the set: PSP-return endpoints keep classic chrome. Update the
  docblock stamp to quote the amended Scope bullet ("the classic site
  header and footer do not render on either"). `[ADR 03-002]`
- **Route-aware nav entries — `components/feed/nav-entries.tsx` +
  consumers:** `FeedShell` gains an optional `returnToFeed?: boolean`
  prop (default `false`), threaded to `NavRail`/`MobileBottomNav` and
  into `buildFeedNavEntries`; the checkout page sets it, the landing
  does not. When `false` (landing),
  section entries keep same-page `#feed`/`#products`/`#post-faq`
  anchors. When `true` (purchase route), in-feed anchors render
  through the localized `Link` as `/#<anchor>` so next-intl resolves
  `/{locale}#<anchor>` — verify hash passthrough; if the localized
  `Link` drops the hash, build `/${locale}#<anchor>` via `useLocale()`
  instead. The `cart` and `contact` entries are unchanged (already
  route/external links). `[ADR 03-002]` `[ADR 00-005]`
- **Suggestions Rail preselection —
  `components/feed/suggestions-rail.tsx` + `buy-now.tsx`:** on the
  purchase route an available Variant card's link carries a
  preselection parameter — `Link href="/checkout?fit=<variantId>"`
  (sold-out Variants stay unlinked). `BuyNow` reads
  `useSearchParams()` (`next/navigation`; the page is `force-dynamic`,
  so no prerender constraint — add a Suspense boundary only if the
  build demands it) to preselect the named Variant when it exists and
  is available; absent/invalid/sold-out falls back to the existing
  hydrated-Cart preselection. `[ADR 03-002]` `[ADR 00-004]`
- **Compare-At Price display:** when Product Data carries a Compare-At
  Price, the Simplified Purchase Surface and the Suggestions Rail cards
  render it struck-through next to the effective price — display-only,
  never submitted to `/api/checkout`. `[ADR 00-004]` `[ADR 03-002]`
- **Mobile bands + bubble on the purchase route:** the bands render
  identically (same `FeedShell`); the bottom band's cart entry resolves
  to `/checkout` — a self-link marking the current location.
  `WhatsAppBubble`'s `bottom-24` offset already clears the band;
  verified on the purchase route (bounding-box e2e below). The buy
  card's submit must never sit under the band — the shell's `pb-20`
  clearance applies when `mobileStickyCta` is on. `[ADR 00-009]`
  `[ADR 03-002]`
- **Admin Console hints — `app/admin/admin-form.tsx`:** `header`/
  `footer` `CHROME_LABELS` hints updated to 'post-checkout, auxiliary,
  and legal pages (the landing and purchase pages use the feed
  layout)'; `mobileStickyCta` hint now covers the band on both shell
  routes. `[ADR 03-002]` `[ADR 00-002]`
- **i18n — `purchase` namespace deltas (both Locales):** add
  `purchase.buy_now` (submit label), `purchase.choose_fit` reuse
  (`product.choose_fit`/`product.fit.*` reused), `purchase.price_label`,
  `purchase.quantity` reuse (`product.quantity`); the now-unused
  `purchase.items.*`, `purchase.summary.*`, `purchase.empty.*` keys may
  be pruned ONLY if unreferenced after the swap — otherwise leave
  (parity test keeps both catalogs aligned either way).
  `[ADR 00-005]` `[ADR 03-002]`
- **`purchase.tsx` deletion:** after `buy-now.tsx` lands and passes —
  its drift/unavailable/idempotency logic is carried over, not
  reinvented. `[ADR 00-007]` `[ADR 03-002]`
- **e2e updates:** `[ADR 00-007]` `[ADR 00-004]` `[ADR 03-002]`
  `[ADR 00-009]`
  - `checkout.spec.ts`: the "add to cart → submit" flow stays
    `goto('/en/checkout')` → select an available fit → submit →
    `waitForURL(/checkout\.stripe\.com/)`; API-contract tests (sold-out
    409, over-cap 409, 502 without key, post-checkout pages) unchanged
    — the handler is untouched. Chrome assertions updated:
    `/en/checkout` renders the Feed Shell (Nav Rail present, no classic
    header/footer landmarks) while `/en/checkout/success` and
    `/en/checkout/cancel` keep classic chrome. One added flow:
    media-slot click on `/en` (enabled project) lands on `/en/checkout`
    with the shell present.
  - `feed.spec.ts`: purchase-route coverage — `/en/checkout` (enabled
    project) renders Nav Rail + Suggestions Rail at `lg`, top band +
    bottom nav at a mobile viewport, the purchase panel in the center
    column; section entries carry `/{locale}#…` hrefs; the WhatsApp
    bubble's bounding box does not overlap the bottom band.
  - `purchase-surface.spec.ts` (gated project): unchanged — the
    checkout route still 404s and the landings still expose zero
    `/checkout` hrefs while the gate is closed.
  - `purchase-surface-enabled.spec.ts`: `nav-cart` visible on
    `/en/checkout`; suggestion-card links on the purchase route carry
    `?fit=<variantId>`; `?fit=<available>` preselects that Variant,
    `?fit=<sold-out-or-unknown>` falls back to the default selection.

### Dependencies

`[ADR 03-002]`

- Previous milestones: M1 (shell links + shared i18n keys + retired
  product-gallery/purchase components).
- External: none beyond existing (Stripe env config for the full handoff
  test; test keys in non-production envs).

### Build and Launch Verification

`[ADR 03-002]` `[ADR 00-004]`

- Build command: `npm run build`
- Launch command: `npm run dev` (and `npm run start` after build)
- Verification steps:
  1. All quality gates pass (`lint`, `format:check`, `type-check`,
     `test`, `build`).
  2. With `PURCHASE_SURFACE_ENABLED` set (non-production): `/en/checkout`
     renders the Feed Shell — Nav Rail, centered purchase panel (fit,
     quantity, price, one buy button; no cart-review list), Suggestions
     Rail at `lg`, mobile bands on small viewports; no classic
     header/footer.
  3. `/en/checkout/success` and `/en/checkout/cancel` keep classic
     header/footer chrome.
  4. Sold-out Variant unselectable; quantity clamps at the Purchase Cap.
  5. Submit → `POST /api/checkout` → browser lands on the PSP Hosted
     Checkout (test keys); cancel returns to `/{locale}/checkout/cancel`
     with the Cart (single line) preserved.
  6. With the flag unset: `/pt/checkout` and `/en/checkout` 404.
  7. Shell nav section entries on `/en/checkout` link back to
     `/{locale}#…` landing units; an available Variant suggestion card
     preselects that Variant via `?fit=`.
  8. Outbound Share Surface under the buy action composes the canonical
     URL in both Locales.
- Expected result: a two-tap purchase path (media → buy) into Hosted
  Checkout inside one chrome system, with all ADR 00-004 error surfaces
  intact.

### Testing Instructions

`[ADR 03-002]` `[ADR 00-004]`

#### What to Test

- Surface: variant pick, quantity stepper (Purchase Cap clamp), price,
  single submit, no cart-review UI, `purchase-surface` testid present.
- Shell wrap: Nav Rail, Suggestions Rail, and mobile bands render on
  `/checkout`; classic header/footer absent there but present on
  success/cancel; the purchase panel is a plain centered column panel —
  no Decorative Interaction Row, no Media Slot link.
- Submit path: single-line POST body; idempotent `attemptId`; drift
  panel on `409` (corrections applied to the Cart); unavailable panel on
  failure; success redirect to the Hosted Checkout URL.
- Cart semantics: cancel preserves the single line; success clears it
  (ClearCartOnMount unchanged); preselection from a stored line works.
- Suggestions: available Variant cards on `/checkout` carry `?fit=` and
  preselect; sold-out cards stay unlinked.
- Navigation: shell section entries on `/checkout` resolve back to
  `/{locale}#…` landing units.
- Gate: flag unset → 404 on both Locales.
- Share surface: canonical URL only, both Locales.
- Interplay: mobile bottom band never covers the buy button; the
  WhatsApp bubble clears the band on the purchase route.

#### How to Test

1. `npm run test` and `npm run test:e2e` → unit + updated e2e green.
2. Non-production env with `PURCHASE_SURFACE_ENABLED=true` +
   `STRIPE_SECRET_KEY` (test): run the full media → buy → Stripe loop in
   both Locales.
3. Visit `/en/checkout` at `lg`/`md`/mobile widths: Nav Rail/icon
   strip/bands render, Suggestions Rail hides below `lg`, the buy card
   sits in the center column; `/en/checkout/success` shows classic
   chrome.
4. Force a drift: POST an over-cap line via the e2e request fixture (or
   toggle `available` locally) → confirm the localized correction panel.
5. Unset `STRIPE_SECRET_KEY` → submit → localized unavailable panel, Cart
   line preserved.
6. Toggle `whatsappBubble`/`mobileStickyCta` in Site Config → verify no
   overlap with the buy button or the bottom band on a mobile viewport.

#### Expected Test Results

- Single-decision purchase page in both Locales inside the same Feed
  Shell as the landing; all ADR 00-004 behaviors (re-validation,
  idempotency, drift, degradation, gate) verified; share surface
  intact; no chrome occlusion; post-checkout pages keep classic chrome.

### Temporary Test Controls

`[ADR 03-002]`

- `PURCHASE_SURFACE_ENABLED` — same pre-existing control (unchanged).
- Test-mode Stripe keys in non-production envs — pre-existing
  (`TestModeBanner` signals the mode).

### Completion Criteria

`[ADR 03-002]` `[ADR 00-004]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit/e2e)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] Temporary test controls documented
- [ ] `purchase.tsx` and retired section components removed after reference search
- [ ] Outbound Share Surface functional on the Simplified Purchase Surface (both Locales)
- [ ] `/checkout` renders inside the Feed Shell (both Locales, all widths); no classic header/footer there
- [ ] `/checkout/success` and `/checkout/cancel` keep classic chrome
- [ ] Shell nav entries on `/checkout` resolve to `/{locale}#…` landing units
- [ ] `?fit=` preselection works for available Variants; sold-out never linked
- [ ] WhatsApp bubble clears the bottom band on the purchase route

---

## Cross-Cutting Requirements

`[ADR 03-002]`

- **ADR stamping:** every ADR-implementing unit carries the required
  stamp (see "ADR Stamping Requirement"); ADR 00-002/00-004/00-009
  stamps carried on boundary-relevant units (chrome mounts, checkout
  submit, WhatsApp surfaces). `[ADR 03-002]`
- **Identifier hygiene:** the mirrored platform's name, marks, copy, and
  UI text never enter tracked files; the decorative handle is own-brand
  text, never a link and never a real third-party account name;
  placeholders/synthetic values only in env examples and tests.
  `[ADR 00-007]` `[ADR 03-002]`
- **Two-Locale parity:** every new user-facing string ships in `pt` +
  `en`; catalogs keep key-for-key parity (enforced by the parity test).
  `[ADR 00-005]`
- **No new dynamic surface:** no Route Handlers, no middleware duties,
  no request-time rendering, no third-party scripts; the feed is static
  output + client-local Islands; Site Config reads reuse the existing
  path. `[ADR 00-002]`
- **Cookieless posture preserved:** decorative interactions emit no
  events; no beacons, pixels, or tracking parameters are added.
  `[ADR 00-008]`
- **Checkout contract preserved:** `/api/checkout`, `validateCart`, and
  the fail-closed Purchase-Surface Gate are untouched; the request body
  stays `{items, locale, attemptId}`. The shell wrap is presentation
  only — and it stops at the purchase route: the success/cancel
  PSP-return pages keep classic chrome. `[ADR 00-004]` `[ADR 00-002]`
  `[ADR 03-002]`
- **Design tokens only:** all styling uses the canonical Brand Palette /
  Design Tokens (light-theme blue-accent mapping in "Visual Tokens —
  Canonical Palette Mapping"); no hard-coded palette values outside the
  token layer; no UI-kit components. `[ADR 03-001]`
- **Media pipeline:** all feed imagery from in-repo masters via the
  framework image component; placeholders are token-styled compositions,
  not external assets. `[ADR 00-006]`
- **Modernize, don't rewrite:** reuse Cart context, `lib/whatsapp.ts`,
  `lib/navigation.ts`, LanguageToggle, TestModeBanner,
  `isPurchaseSurfaceEnabled`, message namespaces; delete dead code only
  after reference search. `[ADR 00-001]` `[ADR 00-007]`
- **Branch/commit discipline:** shared-branch convention; commits only
  with explicit user instruction. `[ADR 00-007]`

## Risks & Mitigations

`[ADR 03-002]`

| Risk | Impact | Mitigation |
|------|--------|------------|
| Decorative affordances read as functional (dead taps) | Medium | Style them as content, not controls; like toggle is the only reactive glyph; reviewed in user testing per ADR 03-002's accepted trade-off |
| Gate leakage — a checkout link renders while `PURCHASE_SURFACE_ENABLED` is unset | High | Single `purchaseSurfaceEnabled` prop threaded from the server layout; e2e asserts zero `/checkout` hrefs on `/pt`,`/en` while gated |
| Bottom-chrome stacking (bottom nav, WhatsApp bubble, buy CTA) occludes actions | Medium | Raised bubble offset; single consolidated bottom band; bounding-box e2e check + manual mobile review (ADR 00-009 constraint) |
| One-product feed feels thin/repetitive | Medium | Content-angle posts (craft, proof, FAQ) + branded placeholders; feed capped at posts the content supports |
| Two chrome systems (Feed Shell vs classic) drift visually | Low | Shared tokens and primitives; `chrome-frame.tsx` is the single decision point for which chrome renders — its suppression set is exactly the shell's routes (`/`, `/checkout`) |
| Dead anchors — shell section entries (`#feed`/`#products`/`#post-faq`) have no target on the purchase route | Medium | Route-aware entry construction (`returnToFeed` → localized `/{locale}#…` links); e2e asserts the hrefs on `/en/checkout` |
| Bottom-band occlusion of the buy card on the purchase route | Medium | Shell's `pb-20` clearance under `mobileStickyCta`; bounding-box e2e + manual mobile review (ADR 00-009 constraint) |
| Operator confusion — toggles now hide feed units; header/footer inert on landing | Low | Admin labels/hints updated to feed vocabulary; `normalizeSiteConfig` untouched so stored configs behave |
| Thin real-media set (4 images) makes posts look samey | Low | Distribute the 4 masters across product posts; placeholder compositions carry brand motifs; male masters remain a pre-existing M2 gap, not this plan's scope |
| Legal links point at not-yet-built routes | Low | Inert placeholders until M4 legal pages land (temporary control) |

## Open Questions for the Owner

`[ADR 03-002]`

1. Decorative handle string for Post Card headers — propose `@holyfans`
   as plain brand text (never a link). Confirm it does not collide with
   a third-party handle the brand doesn't own; alternatives: a
   locale-free brand tagline fragment. `[ADR 00-007]` `[ADR 03-002]`
2. Feed post set, captions, and authored like counts — approve the
   proposed 8-post list and its copy in both Locales. `[ADR 00-005]`
3. Suggestions Rail content while the catalog holds one product —
   approve variant suggestions + a "coming soon" drop card as the rail's
   content. `[ADR 03-002]`
4. Whether legal pages (Privacy/Terms) land before or after this
   restyle ships — affects when the rail's legal links go live.
   `[ADR 03-002]`

## Completion Verification

`[ADR 03-002]`

Before marking this plan as complete, verify:
- [ ] All milestones have been reviewed
- [ ] All sub-tasks in each milestone have been checked
- [ ] Code has been searched for each implementation
- [ ] Missing items have been documented or implemented
- [ ] Each section is stamped with its ADR reference(s)
- [ ] code-quality-reviewer and adr-governor gates passed per milestone
- [ ] Deleted components have zero remaining importers
- [ ] A verification report has been generated
