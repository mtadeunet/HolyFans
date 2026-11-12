# ADR 03-001: Design System and Visual Identity — Token-Driven, Tailwind-Based, Canonical Implemented Palette

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-006 (Media and Asset Pipeline)
ADR 03-002 (Landing Page Composition)

## Context

HolyFans sells premium Christian clothing presented through a landing
composition that mirrors a creator-subscription platform's feed visual
language (ADR 03-002). The visual identity must carry that genre —
light surfaces, a familiar interactive accent, comfortable long-scroll
reading — while staying recognizably HolyFans through its marks and
typography. A consistent design system is required so the small team
can build a coherent UI without a dedicated designer on every
decision. The Storefront carries a defined Design Token layer that the
owner has been iterating on; rather than re-seed a visual system from
scratch, the design decision ratifies the token layer as canonical and
extends it where it is thin. Brand masters: the owner has supplied
high-resolution raster logo marks (halo mark and wordmark), committed
to the repo per ADR 00-006; a vector master is the ideal form for
print/QR work but is not a blocker.

## Decision

The visual system is **Design-Token-driven, styled with Tailwind CSS, using
the implemented Brand Palette as canonical**.

- **Styling technology: Tailwind CSS.** Utility-first styling extended
  through Design Tokens as the single source of truth for color, spacing,
  typography, radius, and elevation. Component classes and shared primitives
  are built on those tokens; no values are hard-coded outside the token
  layer.
- **Brand Palette (canonical):** a light-theme scheme mirroring the
  creator-subscription platform's feed visual language:
  - Near-white `background` — the page wash behind the feed and rails.
  - White `surface` — card surfaces (Post Cards, rail cards, the
    Simplified Purchase Surface).
  - Bright blue `primary` — a sky-family blue carrying the interactive
    accent: calls to action, links, active and highlighted states.
  - Deepened blue `accent` — the hover/emphasis companion of the
    primary blue.
  - Text — near-black `text-primary`; light-gray `text-secondary` for
    captions, metadata, and secondary copy.
  - `border` — light gray, defining card edges and rail separators.
  - Product-design accents — rose, sea blue, gold — reserved for
    garment artwork and design imagery, not UI chrome.
  - Semantic meaning: the bright blue accent carries the feed genre's
    familiar link/affordance language; the clean light scheme keeps the
    editorial feed legible over long scrolls. Brand recognizability is
    carried by the marks and the serif display voice rather than by a
    bespoke color pairing.
- **Typography direction:** a clean, legible **humanist/geometric sans
  is the default face** for body text and all UI chrome; a
  high-contrast **serif display face** — Transitional/Didone character,
  evoking religious-art gravitas and editorial craft — is retained
  exclusively for the brand mark and headings, where it carries the
  identity's editorial voice. No script or decorative accent face is
  used. Generous whitespace and a refined type scale carry the
  composed, editorial feel.
- **Component approach:** a small set of bespoke UI primitives (buttons,
  cards, product sections, navigation, forms) built on the tokens — no
  generic UI-kit look; the store must read as a custom brand executing
  the feed visual language, not a template.
- **Brand marks:** the owner-supplied raster logo masters are the canonical
  brand imagery for header/footer/favicon use; a vector master is the ideal
  form for print and QR scaling and should be adopted when supplied
  (desirable, not blocking).
- **Accessibility:** palette use respects contrast requirements; the
  near-black text on light surface pairings are the default text
  surfaces to keep long-scroll feed content legible, and the bright
  blue accent is paired with light surfaces that preserve readable
  contrast for interactive elements.

## Consequences

**Positive:**
- A single Design-Token source of truth yields visual consistency and makes
  rebranding/theming changes localized and safe.
- Ratifying the implemented palette keeps docs and UI in lock-step — no
  greenfield re-skinning of a working, owner-iterated storefront.
- The light scheme with a bright blue accent makes the Feed Shell
  composition and its chrome read as one coherent genre — the palette
  reinforces the composition instead of fighting it — while the
  conventional accent color gives links and calls to action a familiar
  affordance language.
- Confining the serif display face to the brand mark and headings keeps
  a distinctive editorial voice inside the genre's neutral, sans-led
  reading experience.
- Tailwind speeds development for a small team while tokens keep the output
  bespoke rather than generic.
- No external UI library dependency means full control over the visual
  identity.

**Negative / trade-offs:**
- The bespoke premium color pairing is traded away — brand
  recognizability now rests on the marks and the serif headings rather
  than on palette; the light feed scheme risks reading as generic if
  tokens drift toward the reference's exact values, so the accent
  weight and type treatment must stay own-brand.
- The light scheme diverges from the darker tones of the rendered QR
  artifact; the artifact is not the palette's seed.
- A bespoke primitive set requires building components a UI kit would
  provide for free — more upfront design/build work.
- Utility-first markup requires team discipline to keep components
  token-faithful rather than sliding into arbitrary values.
- Raster-only logo masters limit print/QR scaling until a vector arrives.

## Alternatives Considered

- **Deep navy + gold premium scheme** — Rejected in favor of the
  feed-platform light aesthetic the composition now mirrors; the
  bespoke pairing's distinctiveness is traded for genre coherence, and
  recognizability moves to the marks and the serif headings.
- **Re-derive the palette directly from the rendered QR artifact's darker
  scheme** — Rejected: the canonical scheme is the light feed-platform
  palette the Storefront ships and the owner has iterated on;
  re-skinning a working UI to match a print artifact would churn design
  without a quality gain.
- **Component/UI library (e.g., MUI, Chakra, pre-styled systems)** —
  Rejected: yields a generic app look at odds with a premium custom brand;
  theming a library to this level of bespoke identity costs more than it
  saves.
- **Vanilla CSS / CSS Modules** — Rejected: slower to develop and lacks a
  built-in token/utility system; higher maintenance for a small team.
- **CSS-in-JS runtime libraries** — Rejected: adds runtime cost and is
  unnecessary with a token-driven, largely static-rendered approach.
- **Fully sans typography (serif removed entirely)** — Rejected: the
  serif display voice on the brand mark and headings is the identity's
  editorial differentiator inside the genre's sans-led visual language;
  removing it would erase the remaining brand character.
