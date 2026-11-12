# ADR 00-009: WhatsApp Deep-Link Channels — Client-Resolved Vendor Deep Links for Customer Messaging

## Status

Proposed

## Related

ADR 00-002 (Rendering and Hosting Model)
ADR 00-005 (Internationalization)
ADR 00-007 (Quality Tooling and CI)
ADR 00-008 (Analytics and Consent)
ADR 03-002 (Landing Page Composition)

## Context

The Storefront sells premium items to a Portuguese-first market where WhatsApp
is the dominant personal-messaging channel, and the brand's positioning is
high-touch: pre-purchase questions (sizing, availability, small-run requests)
materially affect conversion for a small, deliberately managed catalog with
manual Fulfillment. The operator needs a contact channel that reaches them
directly, costs nothing to operate, and requires no new infrastructure.
Visitors also benefit from a low-friction way to share the store with their
own contacts — organic word-of-mouth is the store's cheapest distribution
channel.

The architecture constrains the shape of any solution. ADR 00-002 confines
request-time compute to an enumerated dynamic surface — a new inbound channel
(webhook, message receiver) or a third-party embed would violate that
boundary. ADR 00-005 requires all copy in both Locales. ADR 00-007 forbids
real-world identifiers in tracked files — which includes the operator's
contact number. ADR 00-008 permits only Cookieless Analytics, so no
tracking-capable widget, beacon, or tag may be introduced.

## Decision

All customer-facing WhatsApp interaction is implemented as **the vendor's
published click-to-chat / share deep-link mechanism, resolved entirely
client-side**. The Storefront constructs a deep link; the visitor's own
device opens it in the vendor's application or web surface. There is no
server-side messaging integration, no message brokering, and no third-party
widget service — the Storefront never sends, receives, or stores a message.

- **Inbound Contact Surface:** a persistent floating control on every
  Storefront page opens a chat addressed to the **Store Messaging Number** —
  the operator-supplied WhatsApp contact number. The Store Messaging Number
  is operator-supplied environment configuration on the Hosting Platform and
  is never committed to tracked files (identifier hygiene, ADR 00-007);
  because it is public client-facing configuration, it is inlined at build
  time. When no Store Messaging Number is configured, the surface renders
  nothing — it fails closed, matching the Storefront's fail-closed posture.
  The surface is operator-toggleable through Site Config and the Admin
  Console like other global chrome, reusing the existing Edge Config read
  path — it introduces no new request-time capability.
- **Outbound Share Surface:** a control on the canonical purchase block lets
  a visitor compose a message containing the Storefront's canonical URL on
  the Store Domain to send to their own contacts. It shares only the
  canonical URL — never a preview or deployment URL — requires no
  configuration and no store identifier, and is therefore ungated.
- Both surfaces resolve into the visitor's external WhatsApp context; once
  the deep link is followed, the interaction is entirely outside the
  Storefront.
- All user-facing copy on both surfaces is localized in both Locales —
  Portuguese (Primary Locale) first, English secondary — per ADR 00-005.

## Consequences

**Positive:**
- Zero new dynamic surface: no Route Handler, no inbound channel, no external
  script or iframe — the enumerated boundary of ADR 00-002 is preserved
  untouched.
- Free to operate; the operator answers on a channel and device they already
  use, matching the primary market's dominant messaging habit.
- Both surfaces are plain navigation — no cookies, no personal data, no
  third-party runtime — fully compatible with Cookieless Analytics and the
  no-consent-banner posture of ADR 00-008.
- Identifier hygiene preserved: the Store Messaging Number lives only in
  Hosting Platform environment configuration and untracked local env files;
  tracked files carry no real-world identifier.
- Fail-closed default: an unconfigured deployment simply omits the Inbound
  Contact Surface — no broken control or dead link is ever rendered.
- The Outbound Share Surface turns visitors into distribution with a
  canonical, SEO-safe URL — organic reach at zero cost.

**Negative / trade-offs:**
- Inbound-only: visitors can start a conversation, but the Storefront cannot
  send automated order confirmations, shipping updates, or re-engagement
  messages over WhatsApp — order lifecycle signals remain PSP-native per
  ADR 00-004. Automated order messaging would require a future server-side
  integration under a new ADR.
- The Store Messaging Number is build-inlined public configuration: changing
  it requires a rebuild and redeploy — it cannot be retargeted at request
  time through Site Config the way the QR Redirect Route destination can.
  Accepted: the number changes rarely, and keeping it in environment
  configuration preserves identifier hygiene without widening the
  credential-scoped Admin Console write path.
- Once deployed, the Store Messaging Number is public by design — inspectable
  and scrapable by anyone; it must be a number the operator is comfortable
  exposing as a business contact.
- Deep links open an external context the Storefront cannot observe: there
  are no delivery metrics and no "chat started" signal — contact intent is
  observable only as aggregate engagement under Cookieless Analytics
  (ADR 00-008), and conversion from a chat to a purchase is unattributed.
- The floating surface competes for mobile viewport space with other global
  chrome (the Feed Shell's consolidated bottom navigation band); placement
  must never occlude navigation or purchase actions — a presentation
  constraint, not a mechanism change.
- Visitors without the vendor's application or account get only the vendor's
  own web fallback; no alternative contact channel is implied or duplicated.

## Alternatives Considered

- **WhatsApp Cloud API (server-side messaging integration)** — Rejected:
  requires Meta business verification and app review, per-conversation
  pricing, and a webhook receiver — a new inbound channel that the
  enumerated dynamic surface of ADR 00-002 forecloses — all disproportionate
  for a small store with modest contact volume. May be revisited under a new
  ADR if automated order notifications become a requirement.
- **Third-party chat-widget services (embedded vendor widgets)** — Rejected:
  recurring subscription cost, external JavaScript and off-brand chrome that
  compromises the premium presentation, and an intermediary that shares
  visitor data — incompatible with the Cookieless Analytics posture of
  ADR 00-008.
- **Native share API only** — Rejected: the platform-native share sheet is
  unsupported on desktop browsers, silently removing the share affordance
  for a large share of traffic; the vendor's share deep link works uniformly
  on desktop and mobile.
- **Store Messaging Number committed to tracked files** — Rejected: violates
  the identifier-hygiene rule (ADR 00-007); real-world identifiers must
  never enter tracked files.
