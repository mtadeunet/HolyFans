# WhatsApp Deep-Link Channels — Implementation Plan

## Purpose

`[ADR 00-009]`

Implementation plan for the owner-approved WhatsApp surfaces: the Inbound
Contact Surface (a floating click-to-chat control addressed to the Store
Messaging Number) and the Outbound Share Surface (a share-via-WhatsApp
control on the canonical purchase block). Both are built on the vendor's
published click-to-chat / share deep-link mechanism resolved client-side —
no WhatsApp Cloud API, no backend work, no third-party widget services. This
plan carries ALL implementation detail; ADR 00-009 carries none by rule.

Governing documents:
- `docs/adr/00-core/00-009-whatsapp-deep-link-channels.md` — the decision
- `docs/adr/TERMINOLOGY.md` — canonical glossary (all terms used verbatim,
  incl. Store Messaging Number, Inbound Contact Surface, Outbound Share
  Surface)
- `docs/adr/00-core/00-002`, `00-005`, `00-007`, `00-008` — constraining
  ADRs (dynamic-surface boundary, i18n, hygiene/tooling, analytics)
- `docs/plans/holyfans-store-implementation-plan.md` — master plan this
  feature lands on top of

## Architecture Summary (per ADRs)

`[ADR 00-009]`

- **Mechanism:** the vendor's published click-to-chat / share deep-link
  mechanism, resolved entirely client-side; the Storefront constructs deep
  links, the visitor's device opens them. No server-side messaging, no
  inbound channel, no third-party script — the enumerated dynamic surface of
  ADR 00-002 is unchanged. `[ADR 00-009]` `[ADR 00-002]`
- **Inbound Contact Surface:** floating control on every Storefront page,
  addressed to the Store Messaging Number from Hosting Platform environment
  configuration; fail-closed (renders nothing) when unconfigured;
  toggleable through Site Config / Admin Console like other global chrome.
  `[ADR 00-009]`
- **Outbound Share Surface:** control on the canonical purchase block
  sharing the canonical Store Domain URL; ungated, configuration-free.
  `[ADR 00-009]`
- **Localization:** all copy in `pt` (Primary Locale) + `en` through the
  existing message catalogs. `[ADR 00-005]` `[ADR 00-009]`
- **Hygiene & quality:** no real-world identifiers in tracked files; unit
  tests for the deep-link helpers; all quality gates apply.
  `[ADR 00-007]` `[ADR 00-009]`

## ADR Stamping Requirement (mandatory for all implementation work)

`[ADR 00-009]`

Every unit of functionality that implements ADR-defined behavior MUST carry
a stamp comment in the form:

```
Implements ADR <number>: <ADR title> - "<quoted ADR section/requirement>"
```

For this plan the canonical stamp is:

```
Implements ADR 00-009: WhatsApp Deep-Link Channels — Client-Resolved Vendor
Deep Links for Customer Messaging - "<quoted ADR 00-009 requirement>"
```

- Stamp individual units — helpers, components, config entries, tests — not
  just whole files (TS docblock `/** … */`).
- Tests exercising ADR-defined behavior carry the same stamp.
- No new technology, communication pattern, or system boundary may be
  introduced without an ADR. If implementation reveals an unclear or
  blocking ADR/plan, the developer MUST escalate to the user, referencing
  the document.

## Milestone Overview

`[ADR 00-009]`

| # | Milestone | ADRs | Delivers |
|---|-----------|------|----------|
| 1 | WhatsApp Deep-Link Surfaces | 00-009, 00-002, 00-005, 00-007 | `lib/whatsapp.ts` helpers, `whatsappBubble` chrome key, floating chat bubble, purchase-block share control, i18n keys, `.env.example` doc, unit tests |

Single milestone — the feature is one decision with two small surfaces on
existing infrastructure (Site Config chrome, message catalogs, env config).

---

## Milestone 1: WhatsApp Deep-Link Surfaces

`[ADR 00-009]`

### Description

`[ADR 00-009]`

Add both WhatsApp surfaces using the vendor deep-link mechanism: a pure
URL-builder module, a fail-closed floating Inbound Contact Surface driven by
the Store Messaging Number env config and a `whatsappBubble` chrome toggle,
and an ungated Outbound Share Surface in the purchase block sharing the
canonical store URL. No backend work; no new dynamic surface.

### Features Implemented

`[ADR 00-009]`

- **Deep-link helpers — `lib/whatsapp.ts` (new):** two pure, dependency-free
  functions constructing the vendor's deep links. `[ADR 00-009]`
  - `whatsappChatUrl(number, message)` — normalizes `number` to digits-only
    (strips `+`, whitespace, and punctuation defensively); returns `null`
    for empty/invalid input; otherwise builds the vendor click-to-chat deep
    link (`https://wa.me/<digits>?text=<encoded>`) with `message`
    URI-encoded.
  - `whatsappShareUrl(text)` — builds the vendor share deep link
    (`https://wa.me/?text=<encoded>`) with `text` URI-encoded.
- **Store Messaging Number env config:** `NEXT_PUBLIC_WHATSAPP_NUMBER` —
  digits-only international format (country code + subscriber number, no
  `+`, spaces, or punctuation). Public client-side configuration,
  build-inlined; set only in Hosting Platform environment configuration and
  untracked local env files. When unset or empty, the Inbound Contact
  Surface renders nothing — fail-closed. `[ADR 00-009]` `[ADR 00-007]`
- **`.env.example` documentation:** the `NEXT_PUBLIC_WHATSAPP_NUMBER` key is
  documented with a format comment and an empty placeholder value only —
  never a real number. `[ADR 00-007]` `[ADR 00-009]`
- **Chrome key `whatsappBubble` — `lib/site-config.ts`:** add
  `'whatsappBubble'` to the `ChromeKey` union, to `CHROME_KEYS` (so
  `normalizeSiteConfig` merges it like other chrome), and to
  `DEFAULT_SITE_CONFIG.chrome` with default `true`. `[ADR 00-009]`
  `[ADR 00-002]`
- **Admin Console label — `app/admin/admin-form.tsx`:** add
  `CHROME_LABELS.whatsappBubble` with a label and hint identifying it as the
  floating WhatsApp chat control. `[ADR 00-009]` `[ADR 00-002]`
- **Inbound Contact Surface — `components/layout/whatsapp-bubble.tsx`
  (new client component):** `[ADR 00-009]` `[ADR 00-005]` `[ADR 03-001]`
  - Fixed bottom-right anchor; `z-40`; bottom offset clears the
    MobileStickyCta (~64px) on mobile viewports so it never occludes the
    purchase CTA.
  - Renders `null` when `NEXT_PUBLIC_WHATSAPP_NUMBER` is unset/empty —
    fail-closed.
  - Anchor with `target="_blank" rel="noopener noreferrer"`, href built by
    `whatsappChatUrl(NEXT_PUBLIC_WHATSAPP_NUMBER, prefilled_message)`;
    WhatsApp glyph as inline SVG — no external icon dependency.
  - Translated `aria_label`, `tooltip`, and `prefilled_message` from the
    `whatsapp` message namespace; styled on Design Tokens / Brand Palette.
- **Layout mount — `app/[locale]/layout.tsx`:** render the Inbound Contact
  Surface gated on `siteConfig.chrome.whatsappBubble`, alongside the
  existing `mobileStickyCta` mount — same Site Config read path, no new
  request-time capability. `[ADR 00-009]` `[ADR 00-002]`
- **Outbound Share Surface — `components/sections/product-gallery.tsx`:**
  beneath the Add-to-Cart control in the canonical purchase block, a share
  control whose href is `whatsappShareUrl(canonical URL + translated share
  text)`. The URL is always the canonical `SITE_CONFIG.url`
  (`NEXT_PUBLIC_BASE_URL` on `<store-domain>`) — never `window.location`,
  never a preview or deployment URL. Ungated — requires no configuration.
  Opens in a new tab with `rel="noopener noreferrer"`; translated
  `share_label`. `[ADR 00-009]` `[ADR 00-005]`
- **i18n — `messages/en.json` + `messages/pt.json`:** new `whatsapp`
  namespace, key-for-key parity in both Locales: `[ADR 00-005]`
  `[ADR 00-009]`
  - `aria_label` — accessible name for the floating control
  - `tooltip` — hover/hint text on the floating control
  - `prefilled_message` — message preloaded into the visitor's chat
  - `share_label` — label for the Outbound Share Surface
  - `share_text` — message text accompanying the canonical URL when sharing
- **Unit tests — vitest:** cover `whatsappChatUrl` (digits normalization,
  message encoding, empty/invalid input → `null`) and `whatsappShareUrl`
  (text encoding, output shape). Stamped per the ADR Stamping Requirement.
  `[ADR 00-007]` `[ADR 00-009]`

### Dependencies

`[ADR 00-009]`

- Previous milestones: none in this plan. Assumes the master plan's existing
  infrastructure is in place: Site Config / `ChromeKey` mechanism and Edge
  Config read path (`lib/site-config.ts`, layout mount), message catalogs,
  and the vitest scaffold.
- External: the owner sets `NEXT_PUBLIC_WHATSAPP_NUMBER` in the Hosting
  Platform's environment configuration — owner action, never committed.

### Build and Launch Verification

`[ADR 00-009]`

- Build command: `npm run build`
- Launch command: `npm run dev` (and `npm run start` after build)
- Verification steps:
  1. `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`
     all pass.
  2. With `NEXT_PUBLIC_WHATSAPP_NUMBER` set (synthetic value): the floating
     control appears on `/pt` and `/en`; clicking it opens a chat deep link
     addressed to that number with the Locale-correct prefilled message.
  3. With the variable unset: the floating control renders nothing on any
     page — no dead anchor, no console error.
  4. The Outbound Share Surface appears under Add-to-Cart in both Locales
     and shares `SITE_CONFIG.url` + translated text.
  5. Toggling `whatsappBubble` off in Site Config hides the floating
     control; the share control remains visible (ungated).
- Expected result: both surfaces work in both Locales; the Inbound Contact
  Surface fails closed and is operator-toggleable.

### Testing Instructions

`[ADR 00-009]`

#### What to Test

- Helpers: digit normalization (strips `+`, spaces, punctuation), message
  URI-encoding, empty/invalid number → `null`, share-URL shape.
- Inbound Contact Surface: visible when configured; absent when unset;
  `target="_blank"` + `rel="noopener noreferrer"`; translated
  aria-label/tooltip/prefilled message per Locale; bottom offset clears
  MobileStickyCta on mobile.
- Outbound Share Surface: shares the canonical URL (never
  preview/deploy/current-location URL); translated label/text; ungated.
- Toggle: `whatsappBubble` off in Site Config hides only the floating
  control.
- i18n: `whatsapp` namespace parity across `pt`/`en`.
- Hygiene: no real number anywhere in tracked files; `.env.example` carries
  a placeholder only.

#### How to Test

1. `npm run test` → helper unit tests green.
2. Set `NEXT_PUBLIC_WHATSAPP_NUMBER` to a synthetic digits-only value in a
   non-production env → verify the bubble on `/pt` and `/en` and the deep
   link target.
3. Unset the variable → confirm the bubble renders nothing.
4. Toggle `whatsappBubble` in a preview Edge Config → bubble hides/shows;
   share control unaffected.
5. Activate the share control in both Locales → confirm the composed text
   contains `SITE_CONFIG.url` and the translated share text.
6. Search tracked files for any real number → zero hits.

#### Expected Test Results

- Unit tests pass; fail-closed behavior verified; both surfaces localized
  and functional; no identifier leakage.

### Temporary Test Controls

`[ADR 00-009]`

- A synthetic digits-only `NEXT_PUBLIC_WHATSAPP_NUMBER` value set in
  non-production environments to exercise the Inbound Contact Surface
  before the real Store Messaging Number is configured. Purpose: lets the
  fail-closed and happy paths both be verified without a real identifier.
  Removal: the real Store Messaging Number is set by the owner in the
  Hosting Platform's production environment at/after verification; the
  synthetic value is never committed and does not persist in production.

### Completion Criteria

`[ADR 00-009]`

- [ ] All features implemented
- [ ] Build succeeds
- [ ] Application launches successfully
- [ ] All tests pass (lint/format/typecheck/build/unit)
- [ ] Code quality review performed by code-quality-reviewer and all issues fixed
- [ ] ADR compliance review performed by adr-governor and all violations resolved
- [ ] User testing completed successfully
- [ ] Temporary test controls documented
- [ ] No real-world identifier (number, domain, account) in any tracked file
- [ ] Fail-closed and toggle behavior verified in both Locales

---

## Cross-Cutting Requirements

`[ADR 00-009]`

- **ADR stamping:** every ADR-implementing unit carries the required stamp
  (see "ADR Stamping Requirement"). `[ADR 00-009]`
- **Identifier hygiene:** no real phone numbers, domains, or account names
  in tracked files; `.env.example` and tests use placeholders only.
  `[ADR 00-007]` `[ADR 00-009]`
- **Two-Locale parity:** every user-facing string ships in `pt` + `en` via
  the `whatsapp` message namespace; catalogs keep key-for-key parity.
  `[ADR 00-005]` `[ADR 00-009]`
- **No new dynamic surface:** no Route Handlers, no middleware duties, no
  request-time rendering, no third-party scripts — the ADR 00-002 boundary
  is untouched; the bubble mounts through the existing Site Config read
  path. `[ADR 00-002]` `[ADR 00-009]`
- **Canonical URL only:** the share surface always uses `SITE_CONFIG.url`
  on `<store-domain>` — never a preview, deployment, or current-location
  URL. `[ADR 00-009]`
- **Cookieless posture preserved:** deep links are plain navigation — no
  cookies, beacons, or tracking parameters are added.
  `[ADR 00-008]` `[ADR 00-009]`
- **Modernize, don't rewrite:** extend existing chrome/config/message
  patterns; no gratuitous refactors. `[ADR 00-001]`

## Risks & Mitigations

`[ADR 00-009]`

| Risk | Impact | Mitigation |
|------|--------|------------|
| Store Messaging Number is build-inlined — changing it needs a redeploy | Low | Accepted trade-off in ADR 00-009; number changes are rare; documented for the owner. |
| Number is public once deployed (scrapable) | Low | By design — it's a business contact; owner confirms the number is one they are comfortable exposing. |
| Floating control occludes the MobileStickyCta on small screens | Medium | Bottom offset clears the CTA (~64px) on mobile; `z-40` layering; verified visually on mobile viewports. |
| Unconfigured env hides the surface silently — owner may think it's broken | Low | Fail-closed behavior is documented in `.env.example`, this plan, and the ADR; the Admin Console toggle exists independently. |
| No delivery/conversion metrics on WhatsApp interactions | Low | Accepted in ADR 00-009 / 00-008; aggregate engagement only under Cookieless Analytics. |
| Malformed `NEXT_PUBLIC_WHATSAPP_NUMBER` set by operator | Low | Helper normalizes to digits-only and returns `null` on empty input — the surface still fails closed. |

## Open Questions for the Owner (resolve before launch)

`[ADR 00-009]`

1. Provide the Store Messaging Number (a real WhatsApp-capable business
   number) to set as `NEXT_PUBLIC_WHATSAPP_NUMBER` in the Hosting
   Platform's environment configuration — never in tracked files.
   `[ADR 00-009]` `[ADR 00-007]`
2. Confirm final copy tone for `prefilled_message` and `share_text` in both
   Locales (defaults provided in the message catalogs). `[ADR 00-005]`

## Completion Verification

`[ADR 00-009]`

Before marking this plan as complete, verify:
- [ ] All milestones have been reviewed
- [ ] All sub-tasks in each milestone have been checked
- [ ] Code has been searched for each implementation
- [ ] Missing items have been documented or implemented
- [ ] Each section is stamped with its ADR reference(s)
- [ ] code-quality-reviewer and adr-governor gates passed per milestone
- [ ] A verification report has been generated
