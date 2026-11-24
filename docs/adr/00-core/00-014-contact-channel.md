# ADR 00-014: Contact Channel — In-Shell Contact Form Relayed to the Support Inbox

## Status

Proposed

## Related

ADR 00-002 (Rendering and Hosting Model)
ADR 00-005 (Internationalization)
ADR 00-007 (Quality Tooling and CI)
ADR 00-008 (Analytics and Consent)
ADR 00-009 (WhatsApp Deep-Link Channels — withdrawn)
ADR 00-011 (Page Model and Product Routes)
ADR 00-013 (Email Delivery Channel)
ADR 03-002 (Landing Page Composition)

## Context

Customers need a written channel to reach the store: pre-purchase
questions, order support, and anything ill-suited to a chat message.
The channel the corpus earlier sanctioned — a WhatsApp inbound
contact surface recorded under ADR 00-009 — was first soft-
withdrawn (the operator could not staff a chat channel, so the
floating control was left unconfigured) and has since been removed
entirely by owner decision: the channel is withdrawn and ADR 00-009
stands empty; the Storefront ships no vendor deep links, no floating
control, and no share control. Email is the contact channel the
Storefront presents, and the delivery channel of ADR 00-013 provides
the pipe.

The shape is constrained on three sides. Presentation: the Feed
Shell is the Storefront's composition, and the owner has decided
the contact surface joins it — navigating to contact replaces the
Feed Surface's content with the form while the shell's navigation
chrome (Nav Rail, mobile bottom band) stays. The page model of
ADR 00-011 describes a Landing Page plus Product Pages; the contact
surface is a third page kind alongside them. Mechanism: ADR 00-002
confines request-time compute to an enumerated dynamic surface —
the form's submission needs a new enumerated Route Handler hardened
to the norm of its siblings. Privacy: ADR 00-008 permits no
persistence of visitor personal data outside sanctioned captures —
the message is relayed, not stored, so the channel introduces no
keyspace at all.

## Decision

The contact channel is a **Contact Page inside the Feed Shell**
carrying a **Contact Form** that relays to the **Support Inbox**
through the delivery channel of ADR 00-013 — a new enumerated
contact Route Handler on the Node runtime. Nothing submitted is
persisted or logged; the delivered email is the record.

- **Contact Page.** A Locale-prefixed route — `/<Locale>/contact` —
  hosted in the Feed Shell like the Landing and Product Pages:
  the Feed Surface carries the Contact Form while the Nav Rail and
  the mobile bottom band persist. It is a third page kind beside
  the Landing Page and Product Pages — an auxiliary support page
  composed inside the shell rather than under the classic
  header/footer chrome (ADR 00-011, ADR 03-002). It renders per
  request like every page in the Locale tree — performing the
  shared Site Config read for shell chrome — and adds no new
  request-time capability.
- **Navigation.** The shell's `contact` navigation entry is an
  internal Locale-routed link to the Contact Page and is always
  rendered. The shared entry definition keeps the desktop Nav
  Rail and the mobile bottom band identical. The removed WhatsApp
  channel (ADR 00-009, withdrawn) is not offered on the Contact
  Page; the form is the channel.
- **Contact Form.** An Island in the Feed Surface: the visitor's
  name, their email address (required — it is the reply path),
  an optional subject, and the message, plus a honeypot field
  invisible to humans. A purpose-bound consent line at the capture
  point states the single purpose — answering the inquiry — in the
  visitor's Locale. States are localized: idle, sending, sent (an
  in-page confirmation), and a graceful unavailable state.
- **Contact Route Handler.** One new Route Handler joins the
  enumerated dynamic surface of ADR 00-002 on the Node runtime. It
  is hardened to the norm of the checkout, like, and
  stock-notification endpoints: input caps on body size and field
  lengths, strict validation (email shape and length bound, a
  Locale that must be supported, a honeypot that must be empty),
  per-IP rate limiting in the shared window, and fail-closed
  behavior — when the delivery channel is unconfigured it answers
  the graceful unavailable state and never reports a success it did
  not send. On success it performs exactly one send through the
  delivery channel: the message body and the visitor's name and
  address to the Support Inbox, with `Reply-To` set to the
  visitor's email so the operator answers by replying. The
  submitted content is never logged and never written to the
  managed store — the delivered email in the Support Inbox is the
  record, and the channel creates no persisted personal data.
- **Gate posture.** The contact channel is not the purchase
  surface: it is NOT behind the Purchase-Surface Gate and must work
  pre-launch, when support contact matters most.
- **Abuse posture.** The honeypot, input caps, and per-IP rate
  limit bound the relay's spam exposure; no CAPTCHA or third-party
  challenge script is introduced — it would conflict with the
  Cookieless Analytics posture of ADR 00-008 and degrade the
  premium first impression. The relay sends to exactly one
  configured address — it cannot be abused to spam arbitrary
  recipients.
- **Localization.** Every user-facing string — labels, consent
  line, states, and the page's copy — is authored in both Locales
  through the versioned message catalogs (ADR 00-005). The relayed
  message itself carries the visitor's Locale so the operator can
  reply in kind.

## Consequences

**Positive:**
- A written contact channel that needs nothing from the operator
  beyond reading their existing mailbox — no chat staffing, no new
  inbox, no third-party widget.
- Presentation stays coherent: the form is a first-class shell
  page with the navigation the visitor already knows, rather than
  a bolt-on page or modal.
- One enumerated Route Handler inside the ADR 00-002 boundary, on
  the Node runtime already used by its siblings — minimal new
  attack surface.
- Zero persisted personal data: the relay stores nothing, so the
  channel adds no keyspace, no retention obligation beyond the
  mailbox itself, and nothing to join against.
- The nav contact entry becomes ungated and internal — one less
  configuration dependency in the shell's navigation.
- Pre-launch usable: ungated by the Purchase-Surface Gate, support
  contact works from day one.

**Negative / trade-offs:**
- A public form that sends email is an abuse target: the rate
  limit, honeypot, and single-destination design bound it, but a
  motivated sender can still push messages to the Support Inbox
  — volume is capped, not zero.
- The relay is a live provider dependency at submit time: a
  delivery-channel outage shows as the unavailable state — honest
  but a dead end for the visitor at that moment.
- No spam filtering beyond the honeypot: sophisticated human spam
  passes through to the inbox, where the mailbox's own filtering
  is the backstop.
- The Contact Page is a third page kind: the page model's
  vocabulary now covers Landing, Product, and auxiliary in-shell
  pages — a small widening of ADR 00-011's two-kind framing.
- Sent-state honesty is weaker than the stock capture: a
  successful send means "accepted by the provider," not "seen by
  the operator" — a limitation any relay shares.

## Alternatives Considered

- **A mailto link instead of a form** — Rejected: pushes the
  visitor out to their mail client (often unconfigured on mobile),
  exposes the inbox address to scrapers, collects no structured
  fields, and cannot carry Locale context — a strictly worse
  experience for the channel the operator will actually answer.
- **A modal or popover on the Contact nav entry** — Rejected: the
  owner decided the surface is a shell page — content replaced,
  menu kept. A modal adds dismissal/focus-management chrome the
  shell doesn't need for a channel visitors may dwell on.
- **Classic header/footer page outside the shell** — Rejected:
  inconsistent composition — every visitor-facing route lives in
  the Feed Shell; a legacy-chrome page would reintroduce the
  superseded layout for one page.
- **Persisting submissions in the managed store (a contact log)**
  — Rejected: creates retained personal data with a retention and
  deletion burden for zero capability — the delivered email IS the
  record; the mailbox is the store.
- **Third-party form services or chat widgets** — Rejected, as in
  ADR 00-010: external scripts and vendor data-sharing conflict
  with the Cookieless Analytics posture of ADR 00-008 and hand the
  visitor's message to an intermediary.
- **CAPTCHA / challenge-response gate** — Rejected: a third-party
  challenge script conflicts with the no-external-script posture;
  the honeypot plus rate limit suffices at this volume, and the
  relay's single-destination design caps abuse value.
- **Auto-acknowledgment email to the visitor** — Deferred: a
  courteous receipt is a second send per submission and a
  deliverability surface; the in-page confirmation is the
  acknowledgment at launch. May be revisited if support volume
  makes it valuable.
- **Keeping WhatsApp as an alternative channel on the page** —
  Rejected: the operator cannot staff chat; presenting an
  unstaffed channel is a broken promise. The surface has since been
  removed entirely (ADR 00-009 withdrawn); a future chat channel
  would require a new ADR.
