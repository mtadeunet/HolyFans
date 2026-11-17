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
that performs Locale routing and country-signal Locale resolution at
request time: the Hosting Platform's per-request country signal decides
the Locale, with browser-language detection as the fallback for requests
carrying no country signal.
A development pseudo-locale is not part of the product's public surface.

## Decision

The Storefront uses the framework's integrated internationalized routing with
a **prefix-per-Locale** URL strategy and exactly two Locales:

- **`pt` — Primary Locale**, the default; **`en` — secondary Locale**. Both
  are served under their own path prefix: `/pt/` and `/en/`. Every page URL
  carries its Locale explicitly.
- The site root resolves the visitor's Locale at request time from the
  Hosting Platform's per-request **country signal** and forwards them to
  the matching prefixed tree:
  - a visitor geolocated in one of the **Portuguese-Speaking Markets**
    (Portugal, Brazil, Angola, Mozambique, Cape Verde, Guinea-Bissau,
    São Tomé and Príncipe, Timor-Leste, Equatorial Guinea, Macau) is
    forwarded to the `pt` tree outright;
  - a visitor geolocated in any other country is forwarded to the `en`
    tree outright;
  - only requests carrying **no country signal** (e.g., local
    development) fall through to **browser-language detection**, which
    defaults to `pt` — the Primary Locale — for undetectable languages.
- A visible language switcher lets visitors move between Locales; the choice
  is expressed by the URL itself (prefixes), not by hidden state.
- Each Locale is a complete statically generated page tree; SEO parity is
  provided through per-Locale metadata and hreflang cross-linking (with an
  `x-default` entry pointing at the Primary Locale tree).
- The QR Redirect Route (ADR 00-003) is locale-neutral and sits outside
  the Locale tree: its destination is operator-configured, with a
  site-root fallback that forwards to the detected Locale per the rule
  above; the Admin Console is likewise outside localization.
- Only the two real Locales ship. A development-only pseudo-locale is not
  part of the architecture — no `dev` locale is generated or deployed.
- Translations are maintained as versioned message catalogs alongside the
  code, one per Locale, covering all UI strings and page copy, held to
  key-for-key parity.

## Consequences

**Positive:**
- Uniform prefixing makes every URL's Locale explicit — shareable,
  bookmarkable, canonical for search engines, and unambiguous for caching.
- Country-of-origin detection lands visitors from the
  Portuguese-Speaking Markets on `pt` and all other visitors on `en`
  deterministically, independent of their browser settings, while
  browser-language detection still resolves requests carrying no
  country signal and defaults to `pt`.
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
- Detection correctness matters: a misbehaving country signal or
  browser-language detector could misroute visitors; the `pt` default
  bounds the damage.
- The country signal overrides language preference as the Locale
  decider: a Portuguese speaker visiting from outside the
  Portuguese-Speaking Markets is routed to `en`, and an English speaker
  inside one is routed to `pt`; either must correct the routing via the
  language switcher — accepted because country of origin is a stronger
  market signal than browser language.
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
- **Browser-language detection alone (no country signal)** — Rejected:
  browser language is a weaker market signal than country of origin; the
  Hosting Platform's per-request country signal lands
  Portuguese-Speaking-Market visitors on `pt` and all other visitors on
  `en` deterministically, without depending on their browser language
  settings.
- **Country signal alone (no browser-language fallback)** — Rejected: it
  provides no resolution path for requests carrying no country signal
  (e.g., local development); browser-language detection covers that
  residual case and defaults to `pt`.
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
