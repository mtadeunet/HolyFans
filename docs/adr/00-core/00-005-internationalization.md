# ADR 00-005: Internationalization — Portuguese-Primary, Two-Locale, Uniform Prefix Routing

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-002 (Rendering and Hosting Model)
ADR 00-003 (Permanent QR Redirect Route)

## Context

The Storefront's primary market is Portugal; the Primary Locale is Portuguese
(`pt`). English (`en`) is supported for international visitors and future
reach. All content is authored in both Locales; no other locales are planned
at launch. Localization must cover: page copy and UI strings, locale-
appropriate formatting (EUR prices, dates), SEO signals so each Locale ranks
in its market (hreflang, per-Locale URLs, translated metadata), and a clear,
persistent way for visitors to switch language. The Storefront's framework-
integrated internationalization layer already implements this via middleware
that performs Locale routing and browser-language detection at request time.
A development pseudo-locale is not part of the product's public surface.

## Decision

The Storefront uses the framework's integrated internationalized routing with
a **prefix-per-Locale** URL strategy and exactly two Locales:

- **`pt` — Primary Locale**, the default; **`en` — secondary Locale**. Both
  are served under their own path prefix: `/pt/` and `/en/`. Every page URL
  carries its Locale explicitly.
- The site root resolves the visitor's Locale by **browser-language
  detection** at request time and forwards them to the matching prefixed
  tree, defaulting to `pt` — the primary market's Locale.
- A visible language switcher lets visitors move between Locales; the choice
  is expressed by the URL itself (prefixes), not by hidden state.
- Each Locale is a complete statically generated page tree; SEO parity is
  provided through per-Locale metadata and hreflang cross-linking (with an
  `x-default` entry pointing at the Primary Locale tree).
- The QR Redirect Route (ADR 00-003) is locale-neutral, sits outside the
  Locale tree, and forwards to the site root; the Admin Console is likewise
  outside localization.
- Only the two real Locales ship. A development-only pseudo-locale is not
  part of the architecture — no `dev` locale is generated or deployed.
- Translations are maintained as versioned message catalogs alongside the
  code, one per Locale, covering all UI strings and page copy, held to
  key-for-key parity.

## Consequences

**Positive:**
- Uniform prefixing makes every URL's Locale explicit — shareable,
  bookmarkable, canonical for search engines, and unambiguous for caching.
- Browser detection at the root routes international visitors correctly
  while always landing Portuguese-first visitors on `pt`.
- Symmetric trees keep sitemap, hreflang, and canonical logic uniform
  across both Locales.
- Adding a third Locale later is an additive change (new prefix + new
  message catalog), not a re-architecture.
- Middleware-based routing handles Locale concerns in one place, ahead of
  page rendering.

**Negative / trade-offs:**
- Portuguese loses bare-root URLs: the root is now a redirect hop into
  `/pt/` — a small SEO/UX cost accepted for routing uniformity (the
  redirect is server-side and cacheable).
- Detection correctness matters: a misbehaving detector could misroute
  visitors; the `pt` default bounds the damage.
- Every content change must be authored in two languages — ongoing editorial
  cost — and message-catalog parity must be enforced by tooling.
- Dropping the development pseudo-locale removes a developer convenience;
  developers must validate UI strings against the real `pt`/`en` catalogs.

## Alternatives Considered

- **`pt` at the bare root, `en` prefixed** — Rejected: asymmetric prefixing
  leaves the root's Locale implicit, complicates detection and
  canonicalization (unprefixed URLs map to `pt` but must coexist with
  detected-language redirects), and gives shared URLs ambiguous Locale
  semantics. Uniform prefixes keep every URL explicit and match the
  working middleware configuration.
- **No prefix with browser-negotiated language (content negotiation /
  cookie-based)** — Rejected: produces one URL serving different content,
  which is bad for SEO, sharing, and caching; the URL must identify the
  Locale.
- **Separate domains or subdomains per Locale** — Rejected: splits domain
  authority, complicates deployment and TLS, and is heavier than needed
  for one primary market.
- **Three Locales including a `dev` pseudo-locale in the shipped site** —
  Rejected: a pseudo-locale in production output pollutes the sitemap and
  public surface; development aids must not ship.
- **Client-side runtime translation (no per-Locale pages)** — Rejected:
  breaks SEO and progressive enhancement, and forces JavaScript for basic
  reading — incompatible with the premium, statically generated model.
