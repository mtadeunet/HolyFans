# HolyFans — Project Description

HolyFans is an online store selling high-quality Christian clothing. The brand
occupies a premium market position: high-quality design, a higher-price sector,
and details and finishings that are usually handmade, raising the perceived and
real value of each product. All content is safe-for-work; no age gate is
required.

## Market

- Primary market: Portugal. The store operates on the Store Domain
  (`<store-domain>`) with Portuguese as the primary locale and English as the
  supported secondary locale.
- Currency: EUR.

## Catalog Character

- Small catalog: a limited set of products and variants rather than a large,
  frequently changing inventory.
- Products are premium, small-run items; availability may be limited and
  managed deliberately rather than through automated warehousing.

## Hard Constraints

- The route `/qrcoderedirect` on `<store-domain>` must keep working forever.
  Printed materials bearing a QR code that encodes this URL already exist.
- Identifier hygiene: real-world identifiers (domain names, account names,
  tags, post IDs, URLs, usernames) must never be written into tracked files.
  Documents use placeholders such as `<store-domain>`.
- The implemented Design Tokens define the canonical Brand Palette; brand
  masters (logo) are committed to the repository.
- The Storefront is a hybrid-static web application on the chosen Hosting
  Platform: premium presentation quality and fast page loads are part of the
  brand's value proposition.

## Architecture Documentation

- ADRs live in `docs/adr/` under domain subdirectories (`00-core`, `03-ui`).
- The canonical glossary is `docs/adr/TERMINOLOGY.md`.
- Implementation plans live in `docs/plans/`.
- ADR validation reports live in `docs/adr-reports/`.
