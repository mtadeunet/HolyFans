# ADR 03-001: Design System and Visual Identity — Token-Driven, Tailwind-Based, Canonical Implemented Palette

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-006 (Media and Asset Pipeline)

## Context

HolyFans sells premium Christian clothing; the visual identity must
communicate craft, reverence, and quality rather than mass-market e-commerce.
A consistent design system is required so the small team can build a coherent,
high-end UI without a dedicated designer on every decision. The working
Storefront already carries a defined Design Token layer — a light, clean
surface scheme with a navy-and-gold brand identity and serif-led typography —
that the owner has been iterating on. Rather than re-seed a visual system from
scratch, the design decision ratifies the implemented token layer as canonical
and extends it where it is thin. Brand masters: the owner has supplied
high-resolution raster logo marks (halo mark and wordmark), committed to the
repo per ADR 00-006; a vector master is the ideal form for print/QR work but
is not a blocker.

## Decision

The visual system is **Design-Token-driven, styled with Tailwind CSS, using
the implemented Brand Palette as canonical**.

- **Styling technology: Tailwind CSS.** Utility-first styling extended
  through Design Tokens as the single source of truth for color, spacing,
  typography, radius, and elevation. Component classes and shared primitives
  are built on those tokens; no values are hard-coded outside the token
  layer.
- **Brand Palette (canonical, as implemented):**
  - Deep navy `primary` — `#1e3a5f` (accents, headings, authority,
    text-on-light surfaces).
  - Gold `accent` — `#d4af37` (calls to action, highlights, premium
    detailing).
  - Clean light surfaces — white `background` `#ffffff`, near-white
    `surface` `#f8fafc`, light `border` `#e2e8f0`.
  - Text — primary `#1a202c`, secondary `#4a5568`.
  - Product-design accents — rose `#e11d48`, sea blue `#1e3a8a`, gold
    `#d4af37`/`#fbbf24` — reserved for garment artwork and design imagery,
    not UI chrome.
  - Semantic meaning: deep navy = trust, heaven, the Virgin's mantle; gold =
    divine, sacred, premium craft. The navy/gold pairing is the identity's
    core, carried on a clean light scheme that reads as premium retail
    rather than mass-market.
- **Typography direction:** a high-contrast **serif display face for
  headings** — Transitional/Didone character, evoking religious-art gravitas
  and editorial craft — paired with a clean, legible **humanist/geometric
  sans for body and UI**; a **flowing script accent face** is used sparingly
  for faith-themed flourishes only. Generous whitespace, a refined type
  scale, and restrained ornamentation (fine rules, small caps, sacred-geometry
  motifs where appropriate) carry the premium feel.
- **Component approach:** a small set of bespoke UI primitives (buttons,
  cards, product sections, navigation, forms) built on the tokens — no
  generic UI-kit look; the store must read as a custom premium brand, not a
  template.
- **Brand marks:** the owner-supplied raster logo masters are the canonical
  brand imagery for header/footer/favicon use; a vector master is the ideal
  form for print and QR scaling and should be adopted when supplied
  (desirable, not blocking).
- **Accessibility:** palette use respects contrast requirements; the dark
  navy/light surface pairings are the default text surfaces to keep premium
  contrast legible.

## Consequences

**Positive:**
- A single Design-Token source of truth yields visual consistency and makes
  rebranding/theming changes localized and safe.
- Ratifying the implemented palette keeps docs and UI in lock-step — no
  greenfield re-skinning of a working, owner-iterated storefront.
- Navy-and-gold on a light surface scheme delivers premium retail presence:
  clean, reverent, and differentiated from template e-commerce.
- Tailwind speeds development for a small team while tokens keep the output
  bespoke rather than generic.
- No external UI library dependency means full control over the premium
  look.

**Negative / trade-offs:**
- The light scheme diverges from the darker tones of the rendered QR
  artifact; the identity pairing (navy/gold) is preserved but the artifact
  is no longer the palette's literal seed.
- A bespoke primitive set requires building components a UI kit would
  provide for free — more upfront design/build work.
- Utility-first markup requires team discipline to keep components
  token-faithful rather than sliding into arbitrary values.
- Raster-only logo masters limit print/QR scaling until a vector arrives.
- The script accent face must stay sparing — overuse would cheapen the
  premium tone it is meant to elevate.

## Alternatives Considered

- **Re-derive the palette directly from the rendered QR artifact's darker
  navy/cyan scheme** — Rejected: the implemented light premium scheme is
  what the Storefront ships and the owner has iterated on; the navy/gold
  identity semantics are preserved in the canonical tokens, and re-skinning
  a working UI to match an artifact would churn design without a quality
  gain.
- **Component/UI library (e.g., MUI, Chakra, pre-styled systems)** —
  Rejected: yields a generic app look at odds with a premium custom brand;
  theming a library to this level of bespoke identity costs more than it
  saves.
- **Vanilla CSS / CSS Modules** — Rejected: slower to develop and lacks a
  built-in token/utility system; higher maintenance for a small team.
- **CSS-in-JS runtime libraries** — Rejected: adds runtime cost and is
  unnecessary with a token-driven, largely static-rendered approach.
- **Sans-led modern-minimal typography** — Rejected: insufficiently
  distinguishes the premium, reverent brand character; the serif-led
  direction is the differentiator.
