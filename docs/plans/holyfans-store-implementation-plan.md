# HolyFans Store — Implementation Plan (Modernize + Real Payments)

## Purpose

Master implementation plan for the HolyFans online store: hardening and
completing the recovered Next.js storefront and connecting it to real
payments, from repository hygiene through production launch. This plan gates
implementation: no application code changes are made until this plan and its
governing ADRs are approved.

Governing documents:
- `docs/adr/PROJECT.md` — project description
- `docs/adr/TERMINOLOGY.md` — canonical glossary (all terms used verbatim)
- `docs/adr/00-core/00-001 … 00-008` and `docs/adr/03-ui/03-001` — the ADR set

## Architecture Summary (per ADRs)

- **Framework:** Next.js (App Router), React, strict TypeScript, Tailwind;
  Server Components with client-side Islands for interactivity. `[ADR 00-001]`
- **Rendering/hosting:** Vercel Hosting Platform — statically generated
  storefront per Locale, Edge Config reads for Site Config, and an
  enumerated dynamic surface: the Request-Time Middleware (Locale
  routing/detection, Admin Console gating, QR-path canonicalization) plus
  the Route Handler set (QR redirect read, Admin Console write path, single
  checkout handler on the Node runtime). `[ADR 00-002]`
- **QR Redirect Route:** permanent Route Handler at `/qrcoderedirect` reading
  its destination from Site Config, `/` fallback, locale-neutral, `noindex`,
  e2e-tested invariant. `[ADR 00-003]`
- **Commerce:** in-repo Product Data, client-side Cart, Stripe Hosted
  Checkout via the single checkout Route Handler with server-side
  re-validation; EUR; PT payment methods; PSP-native notifications only —
  no webhook receiver. `[ADR 00-004]` `[ADR 00-002]`
- **i18n:** `pt` Primary Locale + `en`, both under URL prefixes; root resolves
  by browser-language detection defaulting to `pt`; no `dev` pseudo-locale.
  `[ADR 00-005]`
- **Media:** in-repo masters incl. brand assets; framework image
  optimization; QR Generator retained as offline repo tooling. `[ADR 00-006]`
- **Quality/CI:** TypeScript strict, ESLint + Prettier, unit + e2e tests on
  built output, GitHub Actions as merge gate, deploys via the Hosting
  Platform's Git integration, git branch conventions. `[ADR 00-007]`
- **Analytics:** cookieless, privacy-first platform-native analytics; QR
  signal via request-level observability; conversions from the PSP.
  `[ADR 00-008]`
- **Design system:** Tailwind + Design Tokens; the implemented Brand
  Palette is canonical. `[ADR 03-001]`

## ADR Stamping Requirement (mandatory for all implementation work)

Every unit of functionality that implements ADR-defined behavior MUST carry a
stamp comment in the form:

```
Implements ADR <number>: <ADR title> - "<quoted ADR section/requirement>"
```

- Stamp individual units — components, functions, modules, route files,
  config entries, tests — not just whole files.
- Use the language-appropriate doc format (TS/JS docblock `/** … */`,
  Python docstring, Markdown comment).
- Tests exercising ADR-defined behavior carry the same stamp.
- No new technology, communication pattern, or system boundary may be
  introduced without an ADR. If implementation reveals an unclear or blocking
  ADR/plan, the developer MUST escalate to the user, referencing the document.

## Repo State Note (implementation context, not architecture)

**The codebase is recovered, not lost.** The full Next.js application source
was restored from the project's GitHub remote with history intact; branches
`master`, `develop`, `staging` exist on the remote. The earlier spec's
greenfield premise (total source loss) is void; this plan modernizes and
completes the existing codebase.

Verified stack: Next.js 16 App Router, React 19, TypeScript 5.9 strict,
Tailwind 3.4, next-intl 4 (locales `pt`+`en`, both prefixed, root detection
defaulting `pt`), `@vercel/edge-config` (Site Config + QR target),
`@vercel/analytics` (wired). Working surfaces: single-product landing in
`app/[locale]/`, Cart context, `/qrcoderedirect` Route Handler, password-gated
`/admin` writing Site Config via the platform API.

**Known problems this plan fixes:**
- `.env.production` is TRACKED and contains the real domain value — must be
  untracked and moved to environment configuration (M0).
- `.github/workflows/deploy.yml` is STALE — targets a GitHub Pages static
  export that no longer exists (M0).
- `next lint` is deprecated in Next 16 and no ESLint/Prettier config exists;
  zero tests; no `STRIPE_*` env entries in `.env.example` (M0/M3).
- Checkout is SIMULATED — the purchase section fabricates order numbers with
  no PSP integration (M3).
- Product imagery referenced by Product Data is absent from `public/` (M2).
- Cart is in-memory only — no on-device persistence (M3).
- Pre-existing identifier-hygiene issues inside recovered tracked CODE files
  (a real domain and social URLs in constants, a real social URL as an admin
  form placeholder). These are pre-existing code state — remediation is an
  M0 work item, NOT a docs violation. Docs keep using `<store-domain>`.
- Dead artifacts: stale `out/` static-export stub, `.git.broken`, stale
  `.next/` cache, an orphaned duplicate global stylesheet, an unwired legacy
  checkout component variant (M0/M1 cleanup after reference checks).
- `next.config.js` image `remotePatterns` allows ANY HTTPS host — must be
  constrained to an explicit allowlist (M0). `[ADR 00-006]`

## Milestone Overview

| # | Milestone | ADRs | Delivers |
|---|-----------|------|----------|
| 0 | Repository Hygiene & Tooling Baseline | 00-002, 00-004, 00-006, 00-007 | Untracked env files, interim purchase-surface gate, ESLint+Prettier, test scaffold, CI quality gate, dead-artifact cleanup |
| 1 | Verification & Hardening on the Existing App | 00-002, 00-003, 00-005, 00-007 | QR invariant e2e, i18n audit, token audit, branded 404, noindex coverage |
| 2 | Product Data & Media Pipeline | 00-001, 00-004, 00-006, 03-001 | Formalized Product Data model, real imagery via image optimization, brand masters wired |
| 3 | Real Stripe Checkout | 00-002, 00-004, 00-007 | `POST /api/checkout` Route Handler, Hosted Checkout handoff, async/degradation/drift states, cart persistence |
| 4 | Legal, Performance & Launch | 00-002, 00-004, 00-005, 00-007, 00-008 | Legal pages, numeric perf/a11y gates, security headers, live payments on `<store-domain>` |

Milestones are sequential (each depends on the previous). M2 and M3 could
overlap on separate files, but sequential delivery is recommended for the
small team.

---

## Milestone 0: Repository Hygiene & Tooling Baseline

### Description

Make the recovered tree safe to work in and enforceable by tooling: remove
the tracked environment file and its real identifier, replace the stale
deploy workflow with a CI quality gate, install the lint/format/test stack
the project currently lacks, constrain the open image allowlist, gate off
the live simulated purchase surface, and clear dead artifacts. Output is
the same working application, now clean, gated, and testable — no
user-visible feature changes except one deliberate protective change: the
simulated purchase surface is hidden until M3 (see the interim gate
below).

### Features Implemented

- Environment hygiene: `.env.production` removed from version control (its
  values moved to the Hosting Platform's environment configuration and to
  untracked local env files); `.gitignore` extended to cover all real env
  files; `.env.example` extended with the `STRIPE_*` entries the project
  will need (secret values never tracked). `[ADR 00-007]` `[ADR 00-002]`
- Secrets audit outcome (recorded, resolved): a full git-history scan
  confirms that only `.env.example` (template, empty values) and
  `.env.production` (`NODE_ENV` plus the public base-URL value — no live
  secrets or credentials) were ever committed. Consequence: untracking
  `.env.production` suffices; NO credential rotation is required; a
  history scrub is explicitly recorded as not warranted.
  `[ADR 00-007]`
- Identifier-hygiene remediation in tracked code (pre-existing recovered
  state — plan item, not a docs violation): the real domain and social URLs
  in shared constants move to environment-driven or placeholder-neutral
  values; the admin form's real social placeholder becomes a generic
  placeholder. `[ADR 00-007]`
- Interim purchase-surface gate (URGENT — lands first within M0): the
  simulated checkout is reachable in production today — the Locale-prefixed
  checkout page returns 200 publicly and its submit flow fabricates
  `HF######` order confirmations for real customers. A code-level gate
  hides the purchase surface until M3: the checkout page renders the
  not-found response and purchase CTAs/links to it are suppressed while a
  single `PURCHASE_SURFACE_ENABLED` flag is unset (the flag name is carried
  in `.env.example` with no real values). A code gate is chosen over a
  Site Config section toggle deliberately: no existing Site Config key
  covers the checkout page, and Site Config reads fail open to defaults —
  an Edge Config outage would silently re-expose the surface. The gate is
  therefore fail-closed and liftable only by an explicit change.
  `[ADR 00-002]` `[ADR 00-004]`
- CI quality gate: the stale GitHub-Pages static-export workflow is removed
  and replaced by a workflow running install → lint → format check →
  typecheck → unit tests → secret/identifier scan (gitleaks-class, per
  ADR 00-007's hygiene provision) → production build on every change. CI
  never deploys — previews and production deploys are owned by the Hosting
  Platform's Git integration. `[ADR 00-007]` `[ADR 00-002]`
- Lint/format stack: ESLint 9 flat config with the framework's recommended
  config (`eslint-config-next`) plus Prettier; `package.json` scripts
  (`lint`, `format`, `typecheck`, `test`, `test:e2e`) wired — the
  deprecated `next lint` command is not used. `[ADR 00-007]`
- Test scaffold: unit test runner wired; e2e runner scaffolded (Playwright
  or a justified equivalent) for the contract tests landing in M1–M3.
  `[ADR 00-007]`
- Image allowlist: `remotePatterns` constrained from any-HTTPS wildcard to
  an explicit list (empty or minimal — served imagery is in-repo masters).
  `[ADR 00-006]`
- Dead-artifact cleanup: stale `out/`, `.git.broken`, stale `.next/` caches
  removed; the orphaned duplicate global stylesheet and the unwired legacy
  checkout component deleted **after** a reference search confirms zero
  importers/usages. `[ADR 00-007]`
- All work lands on the shared-branch convention (`develop` → `staging` →
  `master`); **commits are made only with explicit user instruction**
  (mandatory project rule). `[ADR 00-007]`

### Dependencies

- Previous milestones: none.
- External: Node LTS, npm; Hosting Platform project + dashboard access to
  move env values (owner action); the existing GitHub remote (already
  present).

### Build and Launch Verification

- Build command: `npm run build`
- Launch command: `npm run dev` (and `npm run start` after build)
- Verification steps:
  1. `npm install` completes cleanly with the new dev dependencies.
  2. `npm run dev` serves the existing storefront unchanged.
  3. `npm run lint`, `npm run format` check, `npm run typecheck`,
     `npm run test`, `npm run build` all pass.
  4. `git ls-files` shows no `.env*` file with real values; the real domain
     string no longer appears in tracked files.
  5. The CI workflow runs green on a pushed branch; no deploy workflow
     exists.
- Expected result: identical app behavior, green gates, clean tree.

### Testing Instructions

#### What to Test

- Toolchain: install/lint/format/typecheck/test/build all green.
- Hygiene: no tracked env files with real values; no real-world identifiers
  in tracked code (search for the domain and known social handles); the
  secret/identifier scan runs and blocks on a planted test secret.
- Purchase-surface gate: both Locale checkout pages render the not-found
  response while the gate flag is unset; no purchase CTA links to the
  checkout page; flipping the flag in a non-production environment
  restores the surface for verification.
- Regression: the storefront renders identically before and after cleanup
  (visual spot-check of `/pt` and `/en`), the purchase surface aside.
- CI: the quality-gate workflow executes end-to-end on a test branch,
  including the secret/identifier scan.

#### How to Test

1. Fresh checkout → `npm install` → `npm run build` → `npm run start`.
2. Search tracked files for the real domain string and social URLs → zero
   hits.
3. Push a branch → confirm the Actions workflow runs all steps to green,
   including the scan; push a throwaway commit with a planted test secret
   → the scan fails the build; revert it.
4. Browse `/pt`, `/en`, `/qrcoderedirect`, `/admin` — unchanged behavior;
   `/pt/checkout` and `/en/checkout` return the not-found response and no
   purchase CTA links to them.
5. Set `PURCHASE_SURFACE_ENABLED` in a non-production environment → the
   purchase surface reappears for verification; unset again.

#### Expected Test Results

- All commands exit 0; CI green; storefront behavior unchanged except the
  gated purchase surface; hygiene sweep clean; scan proven blocking.

### Temporary Test Controls

- `PURCHASE_SURFACE_ENABLED` gate flag — code-level switch (off by
  default) that keeps the simulated purchase surface hidden until the real
  checkout exists. Purpose: stops fabricated `HF######` order
  confirmations from reaching real customers while checkout is simulated.
  Flipped on only in non-production environments so M3 can develop and
  verify the real flow; removed at M4 launch once the real checkout is
  verified live.

### Completion Criteria

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] Temporary test controls documented
- [ ] No tracked env file or code file contains real identifiers/secrets
- [ ] Purchase surface gated off in both Locales (not-found response; no
  purchase CTA links); `PURCHASE_SURFACE_ENABLED` control documented

---

## Milestone 1: Verification & Hardening on the Existing App

### Description

Prove the recovered application's public contracts and harden its gaps: the
QR Redirect Route's permanent invariant becomes an e2e-tested contract, the
i18n middleware behavior is audited against ADR 00-005, the token layer is
audited for off-token drift, and the not-found/indexing surfaces are
branded and correct — all without changing what shoppers see.

### Features Implemented

- QR Redirect Route invariant e2e: `GET /qrcoderedirect` resolves (never
  404) and redirects; honors the Site Config destination; falls back to `/`
  when unset or when Edge Config is unreadable; Locale-prefixed variants
  (`/pt/qrcoderedirect`, `/en/qrcoderedirect`) canonicalize to the bare
  route; response is not indexed. `[ADR 00-003]` `[ADR 00-007]`
- Admin Console security audit: `/admin` fails closed (401) without the
  configured credential, passes with it, and carries `noindex`; verified by
  automated test. Hardening: a brute-force throttle/lockout on the
  password gate (attempt cap or exponential back-off on repeated 401s) so
  the shared credential cannot be enumerated online. `[ADR 00-002]`
  `[ADR 00-007]`
- QR destination write-path validation: the Admin Console write path
  validates the QR Redirect Route destination before persisting —
  well-formed URL only, internal path or `https` targets only, with a
  warn/block on obviously dead or unexpected external targets — and
  performs a post-retarget self-check that displays where the route
  currently points (destination read-back plus a resolve check). The e2e
  invariant cannot catch a bad target — the route still resolves to
  *somewhere* — so the write path is the control point for the
  printed-QR contract. `[ADR 00-003]` `[ADR 00-002]`
- i18n audit: middleware behavior verified against ADR 00-005 — both
  Locales prefixed, root detection defaults to `pt`, `en` visitors land on
  `/en/`; message-catalog parity unit test (every `pt` key exists in `en`
  and vice versa); internal links/route generation audited for unprefixed
  leaks; canonical + hreflang presence including `x-default` verified or
  scheduled for M4. `[ADR 00-005]` `[ADR 00-007]`
- Design-token audit: sweep components for hard-coded palette values
  outside the token layer and correct to Design Tokens; confirm a single
  canonical global stylesheet (duplicate stylesheet cleanup completed per
  M0 reference check). `[ADR 03-001]`
- Localized not-found: a branded, localized not-found experience covering
  both Locales (Primary Locale by default) replaces the generic page; a
  missing Locale-prefixed URL renders the on-brand 404. `[ADR 00-005]`
  `[ADR 03-001]`
- Indexing hygiene: `noindex` confirmed on the QR Redirect Route and the
  Admin Console; preview deployments verified to stay out of the index
  (platform setting or `X-Robots-Tag`). `[ADR 00-003]` `[ADR 00-002]`
- Site Config read-path audit: storefront sections/chrome and the QR
  destination confirmed to degrade to defaults on Edge Config failure;
  behavior documented. `[ADR 00-002]`
- e2e suite green: both Locale trees render; QR invariant; admin
  fail-closed. `[ADR 00-007]`

### Dependencies

- Previous milestones: M0.
- External: a non-production Edge Config value for testing QR retargeting
  (preview environment), owner approval for any Edge Config writes in
  production.

### Build and Launch Verification

- Build command: `npm run build`
- Launch command: `npm run dev` / `npm run start` (or preview deployment)
- Verification steps:
  1. `/pt/` renders Portuguese, `/en/` renders English; `/` resolves to a
     prefixed Locale.
  2. `curl -sI <host>/qrcoderedirect` → redirect, never 404; set a test
     destination in Site Config → `curl` shows the new target; clear it →
     falls back to `/`.
  3. `curl -sI <host>/admin` without credentials → 401.
  4. A bogus URL under each Locale → branded localized 404.
  5. `npm run test:e2e` → all contract tests green.
- Expected result: public contracts verified and protected by tests.

### Testing Instructions

#### What to Test

- QR invariant: resolves, retargets, falls back, canonicalizes, `noindex`.
- QR write path: malformed/non-https destinations rejected; post-retarget
  self-check shows the current target and its resolution status.
- Admin auth: fail-closed without password, `noindex` present, brute-force
  throttle/lockout engages on repeated failures.
- i18n: prefix routing, root detection default, message parity, link audit.
- Tokens: no off-token hard-coded colors; single global stylesheet.
- 404/indexing: branded 404 in both Locales; previews `noindex`.

#### How to Test

1. `npm run test:e2e` → QR/admin/locale contract suite green.
2. `curl` the QR route through set/unset/failure Edge Config states.
3. Attempt to save a malformed or non-`https` QR destination via the Admin
   Console → rejected with a useful error; save a valid one → the
   self-check displays the new target and its resolution status.
4. Hammer `/admin` with wrong passwords → the throttle/lockout engages.
5. Toggle Site Config in a preview env → storefront sections respond;
   break the connection string → defaults render.
6. `npm run test` → message-parity and config-normalization unit tests
   green.
7. Visit a nonexistent path in both Locales → branded 404.

#### Expected Test Results

- All contract tests pass; every audit finding is either fixed or filed as
  a tracked item with owner visibility.

### Temporary Test Controls

- A test Edge Config destination for the QR Redirect Route in preview
  environments; removed/reverted to `/` fallback before launch (M4).
- A deliberately misconfigured Edge Config scenario (invalid connection
  string) used only in preview to verify fallbacks; documented, not shipped.

### Completion Criteria

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (incl. e2e: QR invariant, admin auth, locale trees)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] Temporary test controls documented

---

## Milestone 2: Product Data & Media Pipeline

### Description

Turn the working single-product page into a properly modeled catalog and
give it real imagery: a formalized in-repo Product Data model (with
Availability Flags and per-Variant Purchase Caps) feeding the existing
sections, owner-supplied product and brand masters committed and served
through the framework's image optimization, and validation that keeps bad
data from shipping. Topology: "properly modeled" means structured Product
Data behind the existing single-landing sections — the launch catalog is
one primary product with Variants, and additional products or sections are
additive within the same landing; the M4 sitemap therefore stays the two
Locale trees and Product structured data applies to the landing's catalog
block.

### Features Implemented

- Product Data model: structured, versioned catalog entries in-repo (name,
  localized descriptions, EUR price, Variants — including a per-Variant
  `maxQuantity` Purchase Cap field — imagery references, Availability Flag)
  typed against the existing product types; build/test-time validation of
  required fields, price shape, and Variant integrity. `[ADR 00-004]`
  `[ADR 00-001]`
- Catalog wiring: existing sections (gallery, variation selector, purchase
  surfaces) bound to the formalized Product Data model; sold-out state
  rendered from the Availability Flag; EUR VAT-inclusive price display.
  `[ADR 00-004]` `[ADR 03-001]`
- Media pipeline: real product masters committed in-repo and served through
  the framework's image component (responsive, modern formats); the missing
  `/images/*` references resolved; art-directed crops curated.
  `[ADR 00-006]`
- Brand assets: the owner's raster logo masters (brand-assets location)
  wired into header/footer/favicon and social-card imagery; favicon set.
  `[ADR 00-006]` `[ADR 03-001]`
- Locale parity: every product string in `pt` and `en`; EUR formatting per
  Locale. `[ADR 00-005]`
- Unit tests: Product Data integrity (required fields, valid Variants,
  Purchase Cap shape), message-catalog completeness across Locales.
  `[ADR 00-007]`

### Dependencies

- Previous milestones: M1.
- External: product photography/AI imagery masters from the owner; final
  product copy in both languages; price list (EUR, VAT-inclusive); vector
  logo master if available (nice-to-have, not blocking — `[ADR 03-001]`).

### Build and Launch Verification

- Build command: `npm run build`
- Launch command: `npm run dev` / `npm run start`
- Verification steps:
  1. Product sections render real imagery in both Locales.
  2. A flagged sold-out Variant shows the sold-out state and cannot be
     added to the Cart.
  3. Served images are responsive modern formats (inspect emitted markup).
  4. A deliberately malformed catalog entry fails validation in tests.
  5. `npm run test` (unit) green.
- Expected result: premium bilingual product experience on real data.

### Testing Instructions

#### What to Test

- Product Data: validation catches missing price, bad Variant, bad cap.
- Catalog: Variants, sold-out display, EUR formatting, `maxQuantity`
  surfaced to the Cart layer.
- Images: modern formats + responsive sizes; no 404 image references.
- Brand: new logo marks visible in header/footer/favicon.
- Locale parity: both languages complete; no untranslated strings.

#### How to Test

1. Add a deliberately broken Product Data entry → `npm run test` /
   `npm run build` must fail validation; then revert.
2. Browse `/pt/` and `/en/`; switch a Variant; flag an item sold out and
   confirm UI reflects it and blocks add-to-cart.
3. Inspect generated image markup for AVIF/WebP + srcset; check devtools
   network for 404s.
4. `npm run test` → unit suite green.

#### Expected Test Results

- Validation catches bad data; pages render correctly in both Locales;
  images optimized and present; tests pass.

### Temporary Test Controls

- Placeholder/sample product entries and imagery so the catalog can be
  exercised before final owner assets arrive — flagged and replaced by
  real masters before launch (M4).

### Completion Criteria

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (unit + build validation)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] Temporary test controls documented
- [ ] No missing image references (404 sweep clean)

---

## Milestone 3: Real Stripe Checkout

### Description

Replace the simulated order submission with a real payment handoff: a
single checkout Route Handler on the Node runtime creates Stripe Checkout
Sessions from a server-side re-validated Cart, the shopper completes payment
on the Stripe-hosted page with Portuguese methods, and all failure, drift,
and asynchronous-payment states are handled — inside the enumerated dynamic
surface of ADR 00-002.

### Features Implemented

- Checkout Route Handler (`POST /api/checkout`, Node runtime — required by
  the Stripe SDK): receives Cart line identifiers + quantities; re-validates
  every line server-side against Product Data (prices, Variants,
  Availability Flags, per-Variant `maxQuantity` Purchase Caps — never trusts
  client prices); creates a Stripe Checkout Session; returns the Hosted
  Checkout URL. `[ADR 00-004]` `[ADR 00-002]`
- Simulated-submit replacement: the purchase section's fabricated order
  flow (local address/payment-method collection, fake `HF######` order
  numbers, 3-second fake delay) is replaced by a submit that posts the Cart
  to the Route Handler and redirects to the Hosted Checkout page — shipping
  address and payment method are collected by Stripe, not by local forms.
  `[ADR 00-004]`
- Hosted Checkout: Stripe-hosted payment page in EUR with cards, MB Way,
  Multibanco, and wallets enabled for the PT market; premium-consistent
  branding via the PSP's controls. `[ADR 00-004]`
- Shipping: the Route Handler configures `shipping_address_collection` plus
  shipping options/rates on the Checkout Session, so shipping cost is
  displayed to the shopper BEFORE payment (EU price transparency).
  Rates/values are owner-supplied configuration (see Dependencies), never
  hard-coded. `[ADR 00-004]`
- Idempotent submit: the submit control disables on first use and retries
  are idempotent — no duplicate Checkout Sessions. `[ADR 00-004]`
- Cart persistence + caps: the Cart persists on-device across visits and
  clamps quantities to per-Variant Purchase Caps. `[ADR 00-004]`
- Success/cancel flows: dedicated success and cancel pages in both Locales;
  cart cleared once a Checkout Session completes (paid or pending-payment
  issued). The Session is created locale-correct: the Stripe `locale`
  parameter is set from the shopper's Locale and `success_url`/`cancel_url`
  point back into the matching Locale tree, so the shopper lands on the
  right language's post-checkout page. `[ADR 00-004]` `[ADR 00-005]`
- Async payment handling (Multibanco and other delayed-confirmation
  methods): the localized post-checkout page presents a distinct
  "payment pending — complete at the ATM or homebanking with the issued
  reference" state, separate from "paid". The operator MUST be notified of
  asynchronous outcomes (`checkout.session.async_payment_succeeded` /
  `async_payment_failed`) via Stripe-native notification configuration
  (Dashboard email alerts) — NOT a webhook endpoint. REQUIRED: an
  un-notified async failure means the operator would fulfill an unpaid
  order. `[ADR 00-004]` `[ADR 00-002]`
- Order notification: Stripe-native notifications only — the operator
  receives order details via Stripe Dashboard email alerts and the customer
  receives the PSP-hosted receipt, driving manual Fulfillment. No webhook
  receiver exists or is permitted: ADR 00-002's enumerated-Route-Handler
  boundary and ADR 00-004's foreclosure stand. `[ADR 00-004]` `[ADR 00-002]`
- Checkout degradation (implements ADR 00-002's failure posture): a
  localized "checkout unavailable" state is shown when Session creation
  fails (handler error, Stripe outage, mid-handoff failure), telling the
  shopper to retry later; the Cart is preserved. `[ADR 00-002]`
  `[ADR 00-004]`
- Cart drift handling: the handler re-validates every Cart line against
  current Product Data at Session creation. On divergence (price changed,
  Variant removed or flagged sold out), checkout is refused and the shopper
  sees a localized "cart updated — review changes" state listing what
  changed; the Cart is corrected to match Product Data before retry.
  `[ADR 00-004]`
- Checkout abuse protection: the checkout Route Handler applies basic rate
  limiting and input caps (request size and line-count limits) so the only
  shopper-facing write surface cannot be trivially spammed into Session
  creation; throttled requests surface as the "checkout unavailable"
  state. `[ADR 00-002]`
- Sold-out enforcement: items with a false Availability Flag cannot be
  added or checked out (re-validated in the handler). `[ADR 00-004]`
- Stripe env config: `STRIPE_*` keys live only in Hosting Platform env vars
  and untracked local env files; `.env.example` carries the key names only.
  `[ADR 00-007]`
- e2e test: product → cart → checkout-session creation (test mode) →
  redirect to Hosted Checkout; sold-out item blocked; over-cap quantity
  rejected. `[ADR 00-007]`

### Dependencies

- Previous milestones: M2.
- External: Stripe account (Portuguese business, to enable MB Way/
  Multibanco); publishable + secret keys (secret stored as platform env
  variable, never in the repo); Stripe Dashboard notification configuration
  by the owner.
- External — owner-supplied shipping data: countries served, shipping
  options/rates, and any free-shipping threshold; feeds the Checkout
  Session shipping configuration (unresolved).
- **OWNER DECISION — unresolved:** tax calculation mode. ADR 00-004's
  default is VAT-inclusive pricing (prices presented and charged include
  VAT, as required for EU consumer sales). The alternative — a PSP tax
  service such as Stripe Tax computing tax at checkout — is a PSP
  capability not covered by ADR 00-004; if chosen, ADR 00-004's pricing
  statement must be revisited before implementation. Blocks final checkout
  configuration.

### Build and Launch Verification

- Build command: `npm run build`
- Launch command: `npm run dev` / preview deployment
- Verification steps:
  1. Add two Variants to the Cart; cart persists across reload.
  2. Checkout → redirected to Stripe Hosted Checkout (test mode); shipping
     options and cost visible before payment.
  3. Complete a test payment → land on the localized "paid" success page;
     cart cleared.
  4. Complete a Multibanco test-mode checkout → land on the localized
     "payment pending" state (distinct from "paid") showing the payment
     reference.
  5. Attempt to checkout a sold-out item → blocked; attempt an over-cap
     quantity → rejected.
  6. Force a handler failure (invalid key in a preview env) → localized
     "checkout unavailable" state; Cart preserved; double-submit creates no
     duplicate Session.
  7. Change a price / flag a Variant sold out after adding to Cart →
     checkout refused with the "cart updated — review changes" state.
  8. Operator receives test order notification via Stripe-native
     configuration.
- Expected result: end-to-end purchase works in Stripe test mode, including
  async-payment pending state, checkout degradation, and cart-drift
  handling.

### Testing Instructions

#### What to Test

- Cart: add/remove/qty/persistence/totals; `maxQuantity` clamp; both
  Locales.
- Handler: correct Session creation; server-side price/quantity validation;
  rejects tampered prices, over-cap quantities, and sold-out items.
- Shipping: address collection on the Session; shipping cost shown before
  payment.
- Checkout: redirect to Stripe; success/cancel pages localized; order
  notification.
- Async payments: Multibanco "payment pending" state is distinct from
  "paid"; operator alerted on async success/failure via Stripe-native
  configuration.
- Degradation/drift: handler failure shows "checkout unavailable" and keeps
  the Cart; no duplicate Sessions on retry; cart drift shows "cart updated"
  with corrected contents.
- Payments: MB Way/Multibanco/cards appear in test-mode checkout.

#### How to Test

1. Use Stripe test-mode keys; run a full purchase with Stripe test
   cards/methods.
2. Tamper a client price (devtools) → confirm the handler rejects it.
3. Set an Availability Flag off → confirm purchase is blocked end-to-end.
4. Run a Multibanco test-mode checkout → confirm the "payment pending"
   state and the Stripe-native operator alert for the async outcome.
5. Change a Product Data price or flag a Variant sold out after adding it
   to the Cart → confirm the "cart updated — review changes" state and
   corrected totals on retry.
6. Point the handler at an invalid key → confirm "checkout unavailable"
   renders, Cart persists, and repeated submits create no duplicates.
7. `npm run test:e2e` → checkout smoke green.

#### Expected Test Results

- Successful test purchase with correct totals and methods; tamper/
  sold-out/over-cap blocked; localized post-checkout pages including the
  distinct "payment pending" state; degradation and cart-drift states
  verified.

### Temporary Test Controls

- **Stripe test-mode keys** used throughout; a documented flag/env setting
  (`STRIPE_*` test vs live) switches modes. **Removed/secured at M4 launch**
  by setting live keys in the host environment only.
- **`PURCHASE_SURFACE_ENABLED` gate flag** (introduced in M0) is enabled in
  test/preview environments so the real checkout flow can be exercised
  end-to-end; production stays gated until M4 launch. Removed at M4.
- A visible "TEST MODE" banner on checkout-related UI while test keys are
  active; auto-hidden when live keys are set. Removed at launch.

### Completion Criteria

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (incl. e2e checkout smoke)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully (test-mode purchase)
- [ ] Temporary test controls documented
- [ ] No secrets in tracked files (identifier/secret hygiene verified)
- [ ] Simulated order flow fully removed — no fabricated order numbers

---

## Milestone 4: Legal, Performance & Launch

### Description

Final polish and go-live: SEO surface (per-Locale metadata, hreflang,
sitemap, structured data, OpenGraph), cookieless analytics verified —
including the QR-scan signal via platform request observability — required
legal/compliance pages, performance and accessibility pass against numeric
gates, then production launch on the Store Domain with live payments and a
full verification sweep.

### Features Implemented

- SEO: per-Locale titles/descriptions, canonical + hreflang cross-links
  between the `pt`/`en` trees including `x-default` pointing at the Primary
  Locale tree, sitemap covering both Locales and the QR Redirect Route's
  destination, Product structured data, OpenGraph/social cards, robots.
  `[ADR 00-005]` `[ADR 00-002]`
- Analytics: platform-native Cookieless Analytics verified on the Store
  Domain; QR Redirect Route visits confirmed as a tracked signal via the
  Hosting Platform's request-level observability (the route resolves
  server-side before any client beacon); no cookie/consent banner.
  `[ADR 00-008]` `[ADR 00-003]`
- Legal/compliance pages (both Locales): terms, privacy policy, returns/
  withdrawal rights, shipping, contact/imprint details — EU/PT consumer
  requirements. Content supplied by owner; architect provides structure.
  `[ADR 00-005]`
- Invoicing compliance (legal scope): Portuguese law requires a certified
  per-sale invoice (fatura) for each order. The invoicing path — PSP
  invoicing capability (e.g., Stripe Invoicing) vs PT-certified invoicing
  software — is an unresolved OWNER DECISION and external dependency (see
  Dependencies); a compliant invoicing path MUST exist before the first
  live order. This is distinct from the tax-calculation decision in M3.
  `[ADR 00-004]`
- Performance & accessibility pass with numeric gates: LCP ≤ 2.5 s,
  CLS ≤ 0.1, INP ≤ 200 ms (measured at p75), Lighthouse accessibility
  ≥ 95, plus a per-route image-weight budget — total first-load image
  weight ≤ 500 KB per route, no single image over ~200 KB — verified
  against built output; contrast/keyboard/screen-reader check against the
  design system. Note: surfaces that read Site Config render at request
  time under the hybrid model (ADR 00-002) — not pure SSG — so these
  budgets are interpreted against request-time responses, not only cached
  static output. `[ADR 00-002]` `[ADR 03-001]`
- Security headers: response headers configured at the Hosting Platform
  (Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, frame
  protection — via platform header configuration or equivalent mechanism);
  preview deployments carry `noindex` (X-Robots-Tag or the platform's
  preview indexing setting) so staging URLs never enter the index.
  `[ADR 00-002]`
- Production launch: live Stripe keys in platform env, test-mode controls
  removed, final content in place, deploy to `<store-domain>` and verify
  the QR Redirect Route and a live payment end-to-end. `[ADR 00-002]`
  `[ADR 00-004]` `[ADR 00-003]`
- Launch checklist + owner UAT sign-off.

### Dependencies

- Previous milestones: M3.
- External: legal text (owner/qualified source), Stripe live keys, final
  product copy/imagery, DNS/domain live, social card imagery.
- **OWNER DECISION — unresolved:** invoicing path (PSP invoicing capability
  vs PT-certified invoicing software; PT law requires a certified invoice
  per sale). Launch-gated: no live orders until a compliant path exists.

### Build and Launch Verification

- Build command: `npm run build`
- Launch command: production deploy from the production branch
- Verification steps:
  1. Sitemap + hreflang validate; social cards render in validators.
  2. `https://<store-domain>/qrcoderedirect` resolves live and appears in
     platform request metrics.
  3. A real (low-value) purchase completes on live keys; order notification
     received; refund the test order.
  4. Lighthouse/Web-Vitals pass meets the numeric gates (LCP ≤ 2.5 s,
     CLS ≤ 0.1, INP ≤ 200 ms, accessibility ≥ 95); per-route image-weight
     budget verified.
  5. Legal pages present and linked in both Locales.
- Expected result: live, discoverable, measurable, compliant store on
  `<store-domain>`.

### Testing Instructions

#### What to Test

- SEO: metadata/hreflang/sitemap/structured data correct and validated.
- Analytics: pageviews recorded; QR-route hits visible in request metrics;
  no consent banner.
- Legal/compliance: required pages present, linked, both Locales.
- Performance/accessibility: numeric budgets met (LCP/CLS/INP, a11y score,
  image weight).
- Live checkout: real purchase works; test-mode controls gone.

#### How to Test

1. Run SEO validators (rich-results test, sitemap check, OG debugger).
2. Trigger `/qrcoderedirect` and confirm the hit in platform request
   observability; watch analytics for real visits.
3. Place a real small purchase on live keys → verify → refund.
4. Lighthouse audit + manual a11y pass.
5. Full e2e suite on the production build.

#### Expected Test Results

- All validations pass; live order succeeds; site is indexable, measurable,
  compliant, and fast.

### Temporary Test Controls

- None new — all temporary controls from earlier milestones are removed at
  this milestone (test keys replaced by live keys in platform env;
  placeholder products replaced by real catalog; preview QR test
  destination reverted; the M0 purchase-surface gate flag removed once the
  real checkout is verified live).

### Completion Criteria

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully on `<store-domain>`
- [ ] All tests pass (unit + e2e on production build)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully (owner UAT)
- [ ] Temporary test controls documented (and confirmed removed)
- [ ] `/qrcoderedirect` verified live + tracked
- [ ] Live purchase verified and refunded

---

## Cross-Cutting Requirements

- **ADR stamping:** every ADR-implementing unit carries the required stamp
  (see "ADR Stamping Requirement"). `[all ADRs]`
- **Identifier hygiene:** no real domains, account names, post IDs, or
  secrets in tracked files; `<store-domain>` placeholder used in
  docs/tests. Pre-existing identifiers inside recovered tracked code are an
  M0 remediation item — tracked but grandfathered until fixed; no NEW
  identifiers may be introduced. `[ADR 00-007]`
- **Terminology:** all docs/comments use `docs/adr/TERMINOLOGY.md` terms
  verbatim (Cart, Checkout Session, Availability Flag, Purchase Cap, QR
  Redirect Route, Brand Palette, Primary Locale, Site Config, Admin
  Console, Route Handler, Edge Config, Fulfillment, …).
- **Two-Locale parity:** every user-facing feature ships in `pt` + `en`.
  `[ADR 00-005]`
- **Static-first storefront:** no per-request rendering for storefront
  content beyond what Site Config reads already require; the only
  request-time compute is the enumerated dynamic surface of ADR 00-002 —
  the Request-Time Middleware (Locale routing/detection, Admin Console
  gating, QR-path canonicalization) plus the Route Handler set (QR read,
  Admin Console write path, checkout) — plus Edge Config reads.
  `[ADR 00-002]`
- **Modernize, don't rewrite:** existing working components are hardened
  and extended; no gratuitous refactors outside milestone scope.
  `[ADR 00-001]`

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tracked `.env.production` with the real domain remains until M0 remediation | Medium | M0's first work item; treated as exposure; untrack + env-config move lands before other work. |
| Edge Config outage breaks section toggles / QR retargeting | Medium | Default-fallback on every read (`/` for the QR route) per ADR 00-002/00-003; M1 audits the failure path. |
| Simulated checkout is live in production today — `/<locale>/checkout` returns 200 and fabricates `HF######` order confirmations for real customers | High | M0's first-order interim gate (`PURCHASE_SURFACE_ENABLED`, fail-closed, code-level) hides the purchase surface until M3 replaces the simulated flow; M4 verifies a real live purchase. |
| Cart is in-memory only — items lost on reload | Medium | Cart persistence is an M3 feature; documented gap until then. |
| Product imagery absent from `public/` | Medium | M2 commits real masters; placeholder imagery flagged as temporary until then. |
| Stripe Checkout needs the Node-runtime handler → couples checkout to platform functions | Medium | Handler is small and isolated; Stripe Payment Links are an accepted interim launch expedient if blocked (ADR 00-004 alternatives). |
| Manual Availability Flags → possible oversell of handmade runs | Medium | Accepted at launch volumes; operator monitors; revisit with an inventory ADR if volume grows. |
| MB Way/Multibanco eligibility depends on the Stripe account's country | Medium | Owner must confirm a PT Stripe account; Mollie is the designated fallback PSP (ADR 00-004). |
| Delayed-confirmation payments (Multibanco) could be fulfilled unpaid if the async outcome is missed | Medium | Stripe-native operator alerts on async success/failure are REQUIRED in M3; operator verifies payment status in the PSP before Fulfillment. |
| Vendor lock-in (Edge Config, Route Handler runtimes, Git-integrated deploys) | Low–Medium | Accepted per ADR 00-002; static output stays portable; concepts (Site Config, QR redirect) survive re-platforming. |
| Admin Console protected by a single shared password | Low | Fail-closed middleware gate; credential env-managed; any stronger auth model requires a new ADR. |
| Legal/VAT/fatura compliance needs owner's legal input | Medium | Flagged as external dependencies in M3/M4; launch gates on them. |

## Open Questions for the Owner (resolve before implementation)

1. Confirm the Stripe account is a Portuguese business so MB Way +
   Multibanco are available. `[ADR 00-004]`
2. Provide Hosting Platform dashboard access to move env values out of the
   tracked `.env.production` and to configure `STRIPE_*`, `EDGE_CONFIG`,
   and admin credentials. `[ADR 00-007]` `[ADR 00-002]`
3. Provide product photography/AI imagery masters and final product copy in
   both languages, with the EUR VAT-inclusive price list. `[ADR 00-006]`
   `[ADR 00-004]`
4. Provide shipping data — countries served, rates/options, any
   free-shipping threshold — for Checkout Session configuration (blocks
   M3). `[ADR 00-004]`
5. Decide tax calculation mode: VAT-inclusive pricing (ADR 00-004 default)
   vs a PSP tax service such as Stripe Tax; choosing the latter requires
   revisiting ADR 00-004 first. `[ADR 00-004]`
6. Decide the invoicing path: PSP invoicing vs PT-certified invoicing
   software — PT law requires a certified invoice (fatura) per sale; launch
   gate. `[ADR 00-004]`
7. Provide a vector logo master for print/QR work if available (raster
   masters are committed; vector is ideal-but-not-blocking). `[ADR 00-006]`
   `[ADR 03-001]`
8. Provide legal texts (terms, privacy, returns/withdrawal, imprint).
   `[ADR 00-005]`
9. Confirm the launch QR Redirect Route destination: the live route
   currently redirects to the brand's external social-media profile (the
   current operator-set Site Config value) — confirm whether that remains
   the launch target or a storefront/campaign destination should be set,
   and confirm the test destination used during M1–M3. `[ADR 00-003]`
10. Sign off on the Hosting Platform paid-tier budget — commercial use
    requires the appropriate paid platform tier per ADR 00-002.
    `[ADR 00-002]`

## Completion Verification

Before marking this plan as complete, verify:
- [ ] All milestones have been reviewed
- [ ] All sub-tasks in each milestone have been checked
- [ ] Code has been searched for each implementation
- [ ] Missing items have been documented or implemented
- [ ] Each section is stamped with its ADR reference(s)
- [ ] code-quality-reviewer and adr-governor gates passed per milestone
- [ ] A verification report has been generated
