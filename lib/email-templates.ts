import type { Locale } from '@/lib/i18n';
import { SITE_CONFIG } from '@/lib/constants';

/**
 * Implements ADR 00-013: Email Delivery Channel — "Every send's
 * content is a localized template (both Locales, ADR 00-005) with
 * in-repo defaults: plain text with light branded HTML, no external
 * template service, no provider-side template storage. The
 * customer-facing sends' copy — Thank-You Email, Capture
 * Acknowledgment, Restock Notification — is operator-editable Site
 * Config data (an `emails` group normalized field-by-field over the
 * in-repo defaults like every Site Config group, ADR 03-003) ...
 * Each send exposes exactly three fields per Locale — subject,
 * heading, body — plus a shared per-Locale header and footer common
 * to every customer-facing send; the header and footer carry the
 * operator's brand imagery through an `{image:path,size:Npx|N%}`
 * tag — the `,size:` parameter optional — that resolves only
 * Store-domain asset paths — `public/` files served from the
 * Storefront's own origin (the logo asset by default),
 * never an external URL. Dynamic values interpolate through a fixed
 * per-send tag vocabulary — `{product}`, `{variant}`, `{name}`,
 * `{date}`, `{brand}`, `{image:path}` — so the operator edits text,
 * never markup or structure; the consent-purpose line and the
 * purchase CTA stay code-owned. Operator-facing sends (the contact
 * relay, the Operator Order Alert) remain code-fixed."
 *
 * Pure template builders for the channel's five sends: the Contact
 * Form relay, the customer Thank-You Email, the Operator Order Alert,
 * the Capture Acknowledgment, and the Restock Notification. Each
 * returns `{subject, text, html}` —
 * plain text always, a light branded HTML companion for
 * customer-facing mail. Operator-facing mail (the relay and the
 * alert) renders in the Primary Locale; customer-facing mail renders
 * in the recipient's Locale. The three customer-facing builders also
 * accept the whole Site Config `emails` group — the send kind's
 * overrides resolved per field over the in-repo copy tables below
 * plus the shared header/footer resolving over
 * `DEFAULT_SHARED_COPY`.
 */

/** One rendered email. */
export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

const BRAND_NAME = SITE_CONFIG.name;

/** Escape visitor-supplied content before it enters HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape operator/visitor text for the HTML part, turning line breaks
 * into `<br>` so multi-line body fields keep their breaks — the
 * `white-space:pre-wrap` intent the relay's message block expresses.
 * Operator copy is untrusted exactly like visitor input: it escapes
 * through the same path (ADR 00-013 — "the operator edits text, never
 * markup").
 */
function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>');
}

/* ── `{image:path[,size:…]}` tag (ADR 00-013) — brand imagery inside
   editable text. The tag resolves only Store-domain asset paths —
   `public/` files served from the Storefront's own origin — so the
   operator can never reach an external URL. An optional `,size:Npx`
   or `,size:N%` parameter sizes the rendered image; a malformed size
   makes the whole tag render literally — the same visible-mistake
   posture as an invalid path. The text-vs-HTML divergence lives in
   the escape/render step rather than `interpolateTags`: the HTML part
   renders a valid tag as `<img>`, the text part strips it (decorative
   imagery), and an invalid tag renders literally — the same posture
   as unknown tags. ── */

/** The `{image:…}` tag shape — `image:` plus everything up to `}`. */
const EMAIL_IMAGE_TAG = /\{image:([^{}]*)\}/g;

/**
 * The path grammar an `{image:…}` tag must satisfy: a root-relative
 * path of URL-safe characters only — no scheme, no host, no query,
 * no spaces — so the resolved `src` is always the Storefront's own
 * origin plus a `public/` asset path.
 */
const EMAIL_IMAGE_PATH = /^\/[A-Za-z0-9_./-]+$/;

/**
 * The `,size:` parameter's grammar — `size:` plus an integer in `px`
 * or `%`, nothing else (no spaces, no extra parameters, no other
 * units). Bounds are enforced at parse: px 16–600, % 1–100.
 */
const EMAIL_IMAGE_SIZE = /^size:(\d+)(px|%)$/;

/**
 * Whether a tag's path part is a usable `public/` asset path: matches
 * {@link EMAIL_IMAGE_PATH} and carries no `..` segment, so the path
 * can never walk out of the served root (`{image:/../x}` is invalid).
 *
 * @param path - The `{image:…}` tag's path part.
 * @returns `true` when the path can back an image.
 */
function isEmailImagePath(path: string): boolean {
  return EMAIL_IMAGE_PATH.test(path) && !path.split('/').includes('..');
}

/**
 * One parsed `{image:…}` tag — the validated `public/` asset path
 * plus the optional `,size:` rendering width.
 */
interface EmailImageTag {
  path: string;
  size?: { value: number; unit: 'px' | '%' };
}

/**
 * Parse an `{image:…}` tag's inner text — `PATH` or `PATH,size:SIZE`
 * (ADR 00-013). Splits on the first `,`: the path before it must
 * satisfy {@link isEmailImagePath}; a parameter after it must be
 * exactly `size:Npx` or `size:N%` within bounds (px 16–600, % 1–100)
 * — a wrong unit, a missing `size:` prefix, an out-of-range value, or
 * extra parameters make the whole tag malformed. With no `,` the
 * inner text is the path alone, so a `size:` glued onto the path is
 * just an invalid path.
 *
 * @param inner - The captured tag body (the text between `image:` and
 *   `}`).
 * @returns The parsed tag, or `null` when the tag renders literally.
 */
function parseEmailImageTag(inner: string): EmailImageTag | null {
  const comma = inner.indexOf(',');
  const path = comma === -1 ? inner : inner.slice(0, comma);
  if (!isEmailImagePath(path)) return null;
  if (comma === -1) return { path };
  const size = EMAIL_IMAGE_SIZE.exec(inner.slice(comma + 1));
  if (!size) return null;
  const value = Number(size[1]);
  const unit = size[2] === 'px' ? 'px' : '%';
  const inRange =
    unit === 'px' ? value >= 16 && value <= 600 : value >= 1 && value <= 100;
  return inRange ? { path, size: { value, unit } } : null;
}

/**
 * Render the `{image:path[,size:…]}` tags in an already-HTML-escaped
 * field — the HTML side of the tag's text-vs-HTML split (ADR 00-013:
 * the tag "resolves only Store-domain asset paths — `public/` files
 * served from the Storefront's own origin"). Escaping runs first so
 * operator markup is already inert; a valid path's own character set
 * can then never carry HTML into the `src` attribute (still escaped
 * for completeness). A `,size:Npx` tag carries the width on the
 * `width` attribute — Outlook honors the attribute where it can
 * ignore CSS — while `,size:N%` stays CSS-only because percentage
 * `width` attributes are unreliable (desktop Outlook may degrade to
 * the image's natural size — the accepted caveat). An invalid tag
 * renders literally — the escaped tag text stays as typed. Nested
 * braces can't form a tag (`[^{}]*` rejects them), so
 * `{image:a{image:/b.png}}` renders the inner tag and leaves the
 * outer braces as literal debris — reachable only from operator copy,
 * never from an interpolated value (those arrive brace-free).
 *
 * @param escaped - The field after {@link escapeHtml} /
 *   {@link escapeHtmlMultiline}.
 * @returns The field with valid image tags replaced by `<img>` markup.
 */
function renderEmailImages(escaped: string): string {
  return escaped.replace(EMAIL_IMAGE_TAG, (match, inner: string) => {
    const image = parseEmailImageTag(inner);
    if (!image) return match;
    const src = escapeHtml(`${SITE_CONFIG.url}${image.path}`);
    if (!image.size) {
      return `<img src="${src}" alt="" style="display:inline-block;max-width:160px;height:auto;border:0;vertical-align:middle;">`;
    }
    return image.size.unit === 'px'
      ? `<img src="${src}" width="${image.size.value}" style="width:${image.size.value}px;max-width:100%;height:auto;display:inline-block;" alt="">`
      : `<img src="${src}" style="width:${image.size.value}%;height:auto;display:inline-block;" alt="">`;
  });
}

/**
 * Implements ADR 00-013: Email Delivery Channel — an editable field
 * rendered for the HTML part: escape, then resolve `{image:…}`
 * tags into `<img>` markup ({@link renderEmailImages}). Single-line
 * fields keep their text shape — no `<br>` conversion — while a valid
 * image tag still renders (harmless inline imagery).
 *
 * @param value - The interpolated operator copy.
 * @returns The field's HTML rendering.
 */
function emailFieldHtml(value: string): string {
  return renderEmailImages(escapeHtml(value));
}

/**
 * The multi-line form of {@link emailFieldHtml} — body and shared
 * header/footer fields keep their line breaks as `<br>` around the
 * rendered imagery.
 *
 * @param value - The interpolated operator copy.
 * @returns The field's HTML rendering.
 */
function emailFieldHtmlMultiline(value: string): string {
  return renderEmailImages(escapeHtmlMultiline(value));
}

/**
 * The text-part side of the `{image:path[,size:…]}` tag (ADR 00-013):
 * valid image tags strip out — the imagery is decorative — and a tag
 * occupying a whole line takes its line break with it, so
 * `body\n{image:/x.png,size:80px}\ntext` renders `body\ntext` rather
 * than leaving a floating blank line (the tag-body `[^{}]*` eats the
 * `,size:` parameter too); the whitespace a mid-line strip leaves
 * behind collapses sensibly. Invalid tags render literally, matching
 * the unknown-tag posture.
 *
 * @param value - The interpolated operator copy.
 * @returns The field's plain-text rendering without imagery.
 */
function stripEmailImages(value: string): string {
  return value
    // A valid tag occupying a whole line is deleted with the line
    // break that opened it — the trailing `\n` (lookahead) becomes the
    // surviving break, so consecutive tag-only lines collapse too.
    .replace(
      /(?:^|\n)[^\S\n]*\{image:([^{}]*)\}[^\S\n]*(?=\n|$)/g,
      (match, inner: string) => (parseEmailImageTag(inner) ? '' : match)
    )
    .replace(EMAIL_IMAGE_TAG, (match, inner: string) =>
      parseEmailImageTag(inner) ? '' : match
    )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n|\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The shared branded HTML wrapper. For customer-facing sends the
 * header and footer come from the resolved `emails.shared` copy —
 * operator text escaped like every editable field, with `{image:path}`
 * tags rendering the Storefront's own assets as `<img>` (ADR 00-013).
 * Operator-facing sends (the contact relay, the Order Alert) pass no
 * shared copy and keep the code-fixed brand mark and footer line.
 *
 * @param body - The send's letter markup.
 * @param shared - The resolved shared header/footer copy; absent on
 *   code-fixed operator-facing sends.
 * @returns The full HTML document.
 */
function htmlShell(body: string, shared?: EmailSharedCopy): string {
  // Header: resolved shared copy (text + image tags) for
  // customer-facing sends, the code-fixed brand mark for
  // operator-facing sends.
  const header = shared
    ? shared.headerText
      ? `<p style="margin:0 0 4px;font-size:15px;color:#374151;line-height:1.5;">${emailFieldHtmlMultiline(shared.headerText)}</p>`
      : ''
    : `<p style="margin:0 0 4px;font-size:20px;letter-spacing:0.02em;">${BRAND_NAME}</p>`;
  // Footer: resolved shared copy for customer-facing sends, the
  // code-fixed brand line for operator-facing sends.
  const footer = shared
    ? shared.footerText
      ? `<p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;font-family:system-ui,sans-serif;">${emailFieldHtmlMultiline(shared.footerText)}</p>`
      : ''
    : `${BRAND_NAME} · ${escapeHtml(SITE_CONFIG.url)}`;
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#fafafa;font-family:Georgia,'Times New Roman',serif;color:#111827;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
      ${header}
      <div style="height:2px;width:48px;background:#0369a1;margin-bottom:24px;"></div>
      ${body}
      <div style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;">
        ${footer}
      </div>
    </div>
  </body>
</html>`;
}

/* ── Operator-editable copy (ADR 00-013) — the `emails` Site Config
   group: a `shared` per-Locale header/footer common to every
   customer-facing send, plus per send kind a per-Locale
   `{subject, heading, body}` override. The types, field lists, and
   normalizer live here beside the copy tables they override — the
   same module-owns-its-domain split as `lib/promotions.ts`
   (ADR 03-003). ── */

/**
 * Implements ADR 00-013: Email Delivery Channel — "The customer-facing
 * sends' copy — Thank-You Email, Capture Acknowledgment, Restock
 * Notification — is operator-editable Site Config data ... Operator-
 * facing sends (the contact relay, the Operator Order Alert) remain
 * code-fixed." The send kinds an `emails` group may override — the
 * three customer-facing sends only.
 */
export const EMAIL_SEND_KINDS = [
  'thankYou',
  'captureAck',
  'restock',
] as const;
export type EmailSendKind = (typeof EMAIL_SEND_KINDS)[number];

/**
 * Every editable template the `emails` group carries — the `shared`
 * header/footer plus the three send kinds. The Admin Console's Email
 * Templates section iterates this list for its template selector.
 */
export const EMAIL_TEMPLATE_KEYS = [
  'shared',
  ...EMAIL_SEND_KINDS,
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

/**
 * Every copy field the editable sends expose — exactly `subject`,
 * `heading`, `body` per Locale (ADR 00-013). `subject` and `heading`
 * are single-line fields that never carry line breaks; `body` is the
 * multi-line field where operator newlines render as `<br>` in the
 * HTML part.
 */
export type EmailCopyField = 'subject' | 'heading' | 'body';

/**
 * The fields every send kind exposes — identical for all three sends
 * (ADR 00-013: "exactly three fields per Locale — subject, heading,
 * body"): one shared list so the normalizer and the Admin Console
 * share a single source of truth and a stored document can never
 * carry copy a send does not use.
 */
const EMAIL_COPY_FIELDS: readonly EmailCopyField[] = [
  'subject',
  'heading',
  'body',
];

/** The copy fields that never carry line breaks. */
export const EMAIL_SINGLE_LINE_FIELDS: readonly EmailCopyField[] = [
  'subject',
  'heading',
];

const SINGLE_LINE_FIELDS: ReadonlySet<EmailCopyField> = new Set(
  EMAIL_SINGLE_LINE_FIELDS
);

/** Field-length caps: single-line copy stays short; body copy is bounded. */
export const EMAIL_SINGLE_LINE_MAX = 150;
export const EMAIL_MULTI_LINE_MAX = 2000;

/**
 * The shared header/footer fields (ADR 00-013: "a shared per-Locale
 * header and footer common to every customer-facing send; the header
 * and footer carry the operator's brand imagery through an
 * `{image:path}` tag"). Both are multi-line text fields — imagery and
 * text compose inside the same copy via the image tag, so no separate
 * URL-list fields exist.
 */
export const EMAIL_SHARED_TEXT_FIELDS = [
  'headerText',
  'footerText',
] as const;
export type EmailSharedTextField = (typeof EMAIL_SHARED_TEXT_FIELDS)[number];

/**
 * The shared header/footer copy for one Locale — what every
 * customer-facing send wraps around its letter. Brand imagery lives
 * inside the text through `{image:path}` tags; blank/missing fields
 * normalize to the in-repo defaults.
 */
export interface EmailSharedCopy {
  headerText?: string;
  footerText?: string;
}

/**
 * Implements ADR 00-013: Email Delivery Channel — the interpolation
 * vocabulary: "a fixed per-send tag vocabulary — `{product}`,
 * `{variant}`, `{name}`, `{date}`, `{brand}`, `{image:path}`".
 * `{brand}` is available in every customer-facing send; `{name}` and
 * `{date}` apply to the Thank-You Email; `{product}`, `{variant}`,
 * and `{date}` apply to the solicited single-purpose sends;
 * `{image:path}` — with its optional `,size:Npx|N%` parameter — works
 * in every editable text field. Exported per
 * kind so the Admin Console can display each template's available
 * tags. Unsupported tags render literally in the output.
 */
export const EMAIL_SEND_TAGS: Record<EmailSendKind, readonly string[]> = {
  thankYou: ['name', 'date', 'brand', 'image:/path/to.png,size:80px'],
  captureAck: ['product', 'variant', 'date', 'brand', 'image:/path/to.png,size:80px'],
  restock: ['product', 'variant', 'date', 'brand', 'image:/path/to.png,size:80px'],
};

/** The tags the shared header/footer supports — `{brand}` and `{image:path[,size:…]}`. */
export const EMAIL_SHARED_TAGS: readonly string[] = [
  'brand',
  'image:/path/to.png,size:80px',
];

/**
 * The `{name}` fallback when the send carries no customer name — a
 * locale-appropriate word rather than a blank spot in the greeting.
 */
const EMAIL_NAME_FALLBACK: Record<Locale, string> = {
  pt: 'cliente',
  en: 'friend',
};

/**
 * Implements ADR 00-013: Email Delivery Channel — the operator-editable
 * copy of one customer-facing send: per Locale, the three fields
 * `subject`/`heading`/`body` as replacement text. Tags from the send
 * kind's `EMAIL_SEND_TAGS` vocabulary interpolate the send's dynamic
 * values like the Promotion Bar's `{remaining}` (ADR 03-003) while
 * "dynamic values ... stay code-interpolated". Every field is
 * optional — a missing or blank field falls back to the in-repo
 * default copy.
 */
export type EmailTemplateOverride = Partial<
  Record<Locale, Partial<Record<EmailCopyField, string>>>
>;

/** The shared group's per-Locale override shape — every field optional. */
export type EmailSharedOverride = Partial<
  Record<Locale, Partial<EmailSharedCopy>>
>;

/**
 * Site Config's `emails` group: the `shared` header/footer override
 * plus one override object per send kind.
 */
export type EmailOverrides = Record<EmailSendKind, EmailTemplateOverride> & {
  shared: EmailSharedOverride;
};

/** The all-defaults `emails` group — no overrides anywhere. */
export const EMPTY_EMAIL_OVERRIDES: EmailOverrides = {
  shared: {},
  thankYou: {},
  captureAck: {},
  restock: {},
};

/**
 * The channel's editable Locales — inlined (`['pt','en']`) rather than
 * imported because `locales` lives behind next-intl's server-only
 * module and this file must stay client-importable for the Admin
 * Console form.
 */
const EMAIL_LOCALES: readonly Locale[] = ['pt', 'en'];

/**
 * Normalize the `emails.shared` group: known Locales and the shared
 * text fields only — multi-line like `body` ({@link EMAIL_MULTI_LINE_MAX}
 * cap) since imagery and text compose inside the same copy through
 * `{image:path}` tags; legacy `headerImageUrls`/`footerImageUrls` keys
 * drop naturally via the field whitelist — no migration. Same
 * blank-drops-to-default posture as the send kinds. Never throws.
 *
 * @param raw - The untrusted `siteConfig.emails.shared` value.
 * @returns The well-formed shared overrides per Locale.
 */
function normalizeSharedOverride(raw: unknown): EmailSharedOverride {
  const out: EmailSharedOverride = {};
  if (!raw || typeof raw !== 'object') return out;
  const byLocale = raw as Record<string, unknown>;
  for (const locale of EMAIL_LOCALES) {
    const fieldsSource = byLocale[locale];
    if (!fieldsSource || typeof fieldsSource !== 'object') continue;
    const fields = fieldsSource as Record<string, unknown>;
    const clean: EmailSharedCopy = {};
    for (const field of EMAIL_SHARED_TEXT_FIELDS) {
      const value = fields[field];
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed.length === 0) continue;
      clean[field] = trimmed.slice(0, EMAIL_MULTI_LINE_MAX);
    }
    // Empty per-Locale objects are dropped too — the stored document
    // stays an honest set of overrides, not padding.
    if (Object.keys(clean).length > 0) {
      out[locale] = clean;
    }
  }
  return out;
}

/**
 * Implements ADR 00-013: Email Delivery Channel — the `emails` group is
 * "normalized field-by-field over the in-repo defaults like every Site
 * Config group, ADR 03-003": the `shared` group plus known send kinds,
 * Locales (both Locales, ADR 00-005 — {@link EMAIL_LOCALES}), and each
 * kind's declared fields only; unknown keys ignored — the old
 * `greeting`/`intro`/`why`/`cta`/`blessing`/`footer` override keys
 * simply drop out here, no migration needed; non-string and
 * blank/whitespace values dropped so a blanked field falls back to
 * the default; single-line fields carrying line breaks rejected;
 * surviving values trimmed and capped
 * ({@link EMAIL_SINGLE_LINE_MAX} / {@link EMAIL_MULTI_LINE_MAX}).
 * Never throws.
 *
 * @param raw - The untrusted `siteConfig.emails` value.
 * @returns The well-formed overrides per send kind.
 */
export function normalizeEmailOverrides(raw: unknown): EmailOverrides {
  const out: EmailOverrides = {
    shared: {},
    thankYou: {},
    captureAck: {},
    restock: {},
  };
  if (!raw || typeof raw !== 'object') return out;
  const source = raw as Record<string, unknown>;
  out.shared = normalizeSharedOverride(source.shared);
  for (const kind of EMAIL_SEND_KINDS) {
    const kindSource = source[kind];
    if (!kindSource || typeof kindSource !== 'object') continue;
    const byLocale = kindSource as Record<string, unknown>;
    for (const locale of EMAIL_LOCALES) {
      const fieldsSource = byLocale[locale];
      if (!fieldsSource || typeof fieldsSource !== 'object') continue;
      const fields = fieldsSource as Record<string, unknown>;
      const clean: Partial<Record<EmailCopyField, string>> = {};
      for (const field of EMAIL_COPY_FIELDS) {
        const value = fields[field];
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        // A blanked field is the operator asking for the default —
        // drop it so resolution falls back (Promotion Campaign
        // precedent, ADR 03-003).
        if (trimmed.length === 0) continue;
        const singleLine = SINGLE_LINE_FIELDS.has(field);
        // Single-line fields reject line breaks outright — a subject
        // or heading can never carry one.
        if (singleLine && /[\r\n]/.test(trimmed)) continue;
        clean[field] = trimmed.slice(
          0,
          singleLine ? EMAIL_SINGLE_LINE_MAX : EMAIL_MULTI_LINE_MAX
        );
      }
      // Empty per-Locale objects are dropped too — the stored document
      // stays an honest set of overrides, not padding.
      if (Object.keys(clean).length > 0) {
        out[kind][locale] = clean;
      }
    }
  }
  return out;
}

/**
 * Implements ADR 00-013: Email Delivery Channel — "a fixed per-send
 * tag vocabulary". Replace every `{tag}` the dictionary supplies with
 * the send's code-supplied value; any other `{word}` renders
 * literally — the same substitution rule as the Promotion Bar's
 * `{remaining}` (ADR 03-003). `{image:…}` tags carry a colon and so
 * never match this `{word}` grammar — they pass through to the
 * escape/render step where `renderEmailImages`/`stripEmailImages`
 * own the text-vs-HTML divergence. Interpolation happens before the
 * HTML escape pass, so the single `escapeHtml` covers visitor-supplied
 * values like the customer name; structure stays code-owned —
 * placeholders interpolate inside operator text, never markup.
 * Substituted values lose every `{`/`}` — braces are never
 * legitimate in a name/product/variant/date, and stripping them keeps
 * a visitor-typed value (the customer name is Stripe
 * `customer_details.name`) from smuggling a second-order `{image:…}`
 * tag into the render pass, where it would resolve a visitor-authored
 * `<img>` in the HTML part and vanish from the text part.
 *
 * @param text - Copy possibly carrying tags.
 * @param tags - The send kind's tag dictionary (subset of
 *   `EMAIL_SEND_TAGS` keys).
 * @param singleLine - Whether the target field is single-line
 *   (`subject`, `heading`). When true, CR/LF inside a tag value
 *   collapses to a space — a code-supplied value like the customer
 *   name can never split the rendered field the way `trim()`-only
 *   sanitizing would allow.
 * @returns The interpolated string.
 */
function interpolateTags(
  text: string,
  tags: Record<string, string>,
  singleLine = false
): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(tags, key)) return match;
    // Neutralize braces in the substituted value so a visitor-typed
    // `{image:/evil.png}` can only ever render as literal text.
    const value = tags[key].replace(/[{}]/g, '');
    return singleLine ? value.replace(/[\r\n]+/g, ' ') : value;
  });
}

/**
 * The Locale the send actually renders in — the Primary-Locale
 * fallback the copy tables already apply (`defaults[locale] ??
 * defaults.pt`), needed where the Locale itself formats output
 * (`{date}`, the `{name}` fallback).
 *
 * @param locale - The requested Locale (possibly unsupported).
 * @returns `'pt'` or `'en'`.
 */
function resolvedEmailLocale(locale: Locale): Locale {
  return locale === 'en' ? 'en' : 'pt';
}

/**
 * Format a `{date}` tag value in the send's Locale — e.g.
 * `15 de janeiro de 2025` for pt. `Intl.DateTimeFormat` keeps the
 * formatting locale-correct without a date library.
 *
 * @param date - The date to render (order date or send date); an
 *   invalid Date falls back to now rather than throwing a
 *   `RangeError` out of `format` — the webhook path can never 500 on
 *   a malformed upstream timestamp.
 * @param locale - The send's effective Locale.
 * @returns The localized long date, on the store's market calendar
 *   (`Europe/Lisbon`) rather than the runtime host's zone.
 */
function formatEmailDate(date: Date, locale: Locale): string {
  const safe = Number.isFinite(date.getTime()) ? date : new Date();
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    // Implements ADR 00-005: the store's market is Portugal — `{date}`
    // renders the Store Domain's calendar day regardless of host TZ.
    timeZone: 'Europe/Lisbon',
  }).format(safe);
}

/**
 * Implements ADR 00-013: Email Delivery Channel — the `emails` group
 * "normalized field-by-field over the in-repo defaults": the effective
 * per-Locale copy for one send — each field is the operator's
 * non-empty override when present, else the in-repo default. The
 * merged table feeds the send's builder unchanged, so an untuned
 * field renders exactly the default copy.
 *
 * @param defaults - The send kind's in-repo copy table.
 * @param locale - The recipient's Locale (Primary-Locale fallback,
 *   same posture as the builders).
 * @param override - The send kind's `emails` overrides.
 * @returns The effective copy for `locale`.
 */
function resolveEmailCopy(
  defaults: Record<Locale, EmailSendCopy>,
  locale: Locale,
  override?: EmailTemplateOverride
): EmailSendCopy {
  const base = defaults[locale] ?? defaults.pt;
  const fields = override?.[locale];
  if (!fields) return base;
  const merged: EmailSendCopy = { ...base };
  for (const field of EMAIL_COPY_FIELDS) {
    const value = fields[field];
    // Stored overrides are already normalized to non-empty strings
    // whose single-line fields carry no line breaks; the re-check
    // keeps the resolver honest for hand-built (unnormalized) input.
    if (
      typeof value === 'string' &&
      value.trim().length > 0 &&
      !(SINGLE_LINE_FIELDS.has(field) && /[\r\n]/.test(value))
    ) {
      merged[field] = value;
    }
  }
  return merged;
}

/**
 * The effective shared header/footer copy for one Locale: each field
 * is the operator's override when it resolves to something
 * non-empty, else the {@link DEFAULT_SHARED_COPY} default — the same
 * merge posture as `resolveEmailCopy`. `{brand}` interpolates in the
 * resolved text fields; `{image:…}` tags stay verbatim here and
 * resolve at render — they need the text-vs-HTML split the escape/
 * render step owns.
 *
 * @param locale - The recipient's Locale (Primary-Locale fallback).
 * @param override - The `emails.shared` overrides.
 * @returns The effective shared copy for `locale`.
 */
function resolveSharedCopy(
  locale: Locale,
  override?: EmailSharedOverride
): EmailSharedCopy {
  const effective = resolvedEmailLocale(locale);
  const merged: EmailSharedCopy = { ...DEFAULT_SHARED_COPY[effective] };
  const fields = override?.[locale];
  if (fields) {
    for (const field of EMAIL_SHARED_TEXT_FIELDS) {
      const value = fields[field];
      // Same re-check posture as `resolveEmailCopy` for a hand-built
      // (unnormalized) override: blank values never win over the
      // default. Shared fields are multi-line — line breaks stay.
      if (typeof value === 'string' && value.trim().length > 0) {
        merged[field] = value;
      }
    }
  }
  // Merge first, interpolate once — `{brand}` resolves in both paths.
  return {
    headerText: interpolateTags(merged.headerText ?? '', {
      brand: BRAND_NAME,
    }),
    footerText: interpolateTags(merged.footerText ?? '', {
      brand: BRAND_NAME,
    }),
  };
}

/* ── Contact Form relay (ADR 00-014) — operator-facing, Primary
   Locale. The visitor's own words are quoted verbatim. ── */

export interface ContactRelayInput {
  name: string;
  email: string;
  subject?: string;
  message: string;
  locale: string;
}

export function contactRelay(input: ContactRelayInput): EmailTemplate {
  const heading = input.subject?.trim()
    ? input.subject.trim()
    : 'Nova mensagem';
  const subject = `[Contacto] ${heading}`;
  const text = [
    'Nova mensagem do formulário de contacto:',
    '',
    `Nome: ${input.name || '(sem nome)'}`,
    `Email: ${input.email}`,
    `Idioma do visitante: ${input.locale}`,
    '',
    input.message,
    '',
    '— Responda diretamente a este email para contactar o visitante.',
  ].join('\n');
  const html = htmlShell(
    `<p style="font-size:14px;color:#6b7280;margin:0 0 16px;font-family:system-ui,sans-serif;">
       Nova mensagem do formulário de contacto
     </p>
     <p style="margin:0 0 4px;font-size:14px;"><strong>Nome:</strong> ${escapeHtml(input.name || '(sem nome)')}</p>
     <p style="margin:0 0 4px;font-size:14px;"><strong>Email:</strong> ${escapeHtml(input.email)}</p>
     <p style="margin:0 0 16px;font-size:14px;"><strong>Idioma:</strong> ${escapeHtml(input.locale)}</p>
     <p style="margin:0;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(input.message)}</p>
     <p style="margin:20px 0 0;font-size:12px;color:#6b7280;font-family:system-ui,sans-serif;">
       Responda diretamente a este email para contactar o visitante.
     </p>`
  );
  return { subject, text, html };
}

/* ── Thank-You Email (ADR 00-015) — customer-facing, session
   Locale. Complements the PSP's native receipt. ── */

/** The per-Locale copy shape every editable send resolves to. */
export type EmailSendCopy = {
  subject: string;
  heading: string;
  body: string;
};

/**
 * The Thank-You Email's per-Locale copy. The default heading carries
 * the `{name}` tag — it renders the customer's name or the Locale's
 * fallback word where the old greeting appended it. The default body
 * merges the old body and blessing lines into the single body field;
 * the old footer line merged into `DEFAULT_SHARED_COPY`'s footer.
 */
const THANK_YOU_COPY: Record<Locale, EmailSendCopy> = {
  pt: {
    subject: 'Obrigado pela sua encomenda',
    heading: 'Obrigado pela sua encomenda, {name}!',
    body: 'A sua compra foi confirmada e vamos começar a preparar a sua peça com todo o cuidado que ela merece. Receberá também o recibo de pagamento do nosso parceiro de pagamentos.\n\nQue esta peça seja uma bênção para si — e uma forma elegante de partilhar a sua fé.',
  },
  en: {
    subject: 'Thank you for your order',
    heading: 'Thank you for your order, {name}!',
    body: "Your purchase is confirmed and we will start preparing your piece with all the care it deserves. You will also receive a payment receipt from our payment provider.\n\nMay this piece be a blessing to you — and an elegant way to share your faith.",
  },
};

export interface ThankYouEmailInput {
  /** The customer's name — code-supplied for the `{name}` tag. */
  customerName?: string;
  /** The order/session date for the `{date}` tag; defaults to now. */
  orderDate?: Date;
}

/**
 * Implements ADR 00-013: Email Delivery Channel — the Thank-You
 * Email's copy is "operator-editable Site Config data": `emails` is
 * the whole `emails` group, with `emails.thankYou` merged per field
 * over `THANK_YOU_COPY` by `resolveEmailCopy` and `emails.shared`
 * resolving the header/footer over `DEFAULT_SHARED_COPY`. The send's
 * tag vocabulary is `{name}`, `{date}`, `{brand}` — the name falls
 * back to a locale-appropriate word when the session has none, and
 * the date renders the order/session date via `Intl.DateTimeFormat`.
 *
 * @param locale - The Checkout Session's Locale (Primary-Locale
 *   fallback for an unsupported value).
 * @param input - The send's code-supplied tag values.
 * @param emails - The operator's `emails` overrides group.
 * @returns The rendered `{subject, text, html}` template.
 */
export function thankYouEmail(
  locale: Locale,
  input: ThankYouEmailInput = {},
  emails?: EmailOverrides
): EmailTemplate {
  const effective = resolvedEmailLocale(locale);
  const shared = resolveSharedCopy(locale, emails?.shared);
  const copy = resolveEmailCopy(THANK_YOU_COPY, locale, emails?.thankYou);
  const tags: Record<string, string> = {
    brand: BRAND_NAME,
    name: input.customerName?.trim() || EMAIL_NAME_FALLBACK[effective],
    date: formatEmailDate(input.orderDate ?? new Date(), effective),
  };
  const subject = stripEmailImages(
    interpolateTags(copy.subject, tags, true)
  );
  const heading = interpolateTags(copy.heading, tags, true);
  const body = interpolateTags(copy.body, tags);
  // The text part strips `{image:…}` tags — decorative imagery —
  // before the copy assembles, so a tag-only header/footer line drops
  // out instead of leaving a bare blank line.
  const headerText = stripEmailImages(shared.headerText ?? '');
  const footerText = stripEmailImages(shared.footerText ?? '');
  const text = [
    ...(headerText ? [headerText, ''] : []),
    stripEmailImages(heading),
    '',
    stripEmailImages(body),
    ...(footerText ? ['', footerText] : []),
  ].join('\n');
  const html = htmlShell(
    `<p style="margin:0 0 16px;font-size:18px;line-height:1.5;">${emailFieldHtml(heading)}</p>
     <p style="margin:0;font-size:15px;line-height:1.6;">${emailFieldHtmlMultiline(body)}</p>`,
    shared
  );
  return { subject, text, html };
}

/* ── Operator Order Alert (ADR 00-015) — operator-facing, Primary
   Locale. Carries the fulfillment picture. ── */

export interface OrderAlertLine {
  name: string;
  quantity: number;
  unitAmountCents: number;
}

export interface OrderAlertInput {
  sessionId: string;
  lines: OrderAlertLine[];
  totalCents: number;
  customerEmail?: string;
  customerName?: string;
  shippingAddress?: string;
  shippingOption?: string;
  /** `'paid'` or `'awaiting'` — delayed-confirmation methods arrive
   *  unpaid. */
  paymentState: 'paid' | 'awaiting';
}

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export function orderAlertEmail(input: OrderAlertInput): EmailTemplate {
  const pending = input.paymentState === 'awaiting';
  const subject = pending
    ? `[Encomenda] Pagamento pendente — ${input.sessionId.slice(-8)}`
    : `[Encomenda] Nova encomenda paga — ${input.sessionId.slice(-8)}`;
  const lines = input.lines.map(
    (line) =>
      `  ${line.quantity}× ${line.name} — ${eur(line.unitAmountCents)} un.`
  );
  const text = [
    pending
      ? 'Nova encomenda — a aguardar pagamento (ex.: Multibanco).'
      : 'Nova encomenda paga.',
    '',
    'Artigos:',
    ...lines,
    `  Total: ${eur(input.totalCents)}`,
    '',
    `Cliente: ${input.customerName ?? '—'} <${input.customerEmail ?? '—'}>`,
    `Envio: ${input.shippingAddress ?? '—'}`,
    `Método de envio: ${input.shippingOption ?? '—'}`,
    `Estado do pagamento: ${pending ? 'a aguardar' : 'pago'}`,
    '',
    `Sessão: ${input.sessionId}`,
  ].join('\n');
  const rows = input.lines
    .map(
      (line) =>
        `<tr><td style="padding:4px 12px 4px 0;font-size:14px;">${line.quantity}× ${escapeHtml(line.name)}</td>` +
        `<td style="padding:4px 0;font-size:14px;text-align:right;">${eur(line.unitAmountCents)} un.</td></tr>`
    )
    .join('');
  const html = htmlShell(
    `<p style="font-size:14px;color:${pending ? '#b45309' : '#047857'};margin:0 0 16px;font-family:system-ui,sans-serif;font-weight:600;">
       ${pending ? 'Nova encomenda — a aguardar pagamento (ex.: Multibanco)' : 'Nova encomenda paga'}
     </p>
     <table style="margin:0 0 12px;border-collapse:collapse;"><tbody>${rows}</tbody></table>
     <p style="margin:0 0 16px;font-size:14px;"><strong>Total: ${eur(input.totalCents)}</strong></p>
     <p style="margin:0 0 4px;font-size:14px;"><strong>Cliente:</strong> ${escapeHtml(input.customerName ?? '—')} &lt;${escapeHtml(input.customerEmail ?? '—')}&gt;</p>
     <p style="margin:0 0 4px;font-size:14px;"><strong>Envio:</strong> ${escapeHtml(input.shippingAddress ?? '—')}</p>
     <p style="margin:0 0 4px;font-size:14px;"><strong>Método:</strong> ${escapeHtml(input.shippingOption ?? '—')}</p>
     <p style="margin:0;font-size:12px;color:#6b7280;font-family:system-ui,sans-serif;">
       Sessão: ${escapeHtml(input.sessionId)}
     </p>`
  );
  return { subject, text, html };
}

/* ── Solicited single-purpose sends (ADR 00-015) — list member,
   submission/consent-record Locale. The Capture Acknowledgment and the
   Restock Notification are the same letter: heading, body, an
   optional purchase link, and the code-fixed why-you-got-this line —
   wrapped by the shared header/footer. ── */

/**
 * The inputs shared by the solicited notices. `productUrl` and
 * `ctaLabel` travel together — set for the Restock Notification's
 * purchase link, absent for the Capture Acknowledgment (it carries no
 * link; it promises the Restock Notification instead). The CTA label
 * is code-fixed per send (ADR 00-013: "the consent-purpose line and
 * the purchase CTA stay code-owned").
 */
interface SolicitedNoticeInput {
  productName: string;
  variantLabel: string;
  /** Canonical purchase URL in the recipient's Locale. */
  productUrl?: string;
  /** The CTA button's label — required when `productUrl` is set. */
  ctaLabel?: string;
  /** The send date for the `{date}` tag; defaults to now. */
  sendDate?: Date;
}

/**
 * Render one solicited single-purpose send from its resolved copy
 * table — defaults merged with the operator's `emails.<kind>`
 * overrides by the calling builder. `subject`/`heading`/`body`
 * interpolate the kind's tag vocabulary before render. The purchase
 * link is the only structural divergence: when present it adds a
 * bare-URL line to the text part and a CTA button to the HTML part.
 * The consent-purpose why-line stays code-fixed and renders in small
 * print between the letter and the shared footer, exactly as the old
 * `why` line did.
 *
 * @param copy - The resolved per-Locale copy table.
 * @param whyLine - The send's code-fixed consent-purpose line.
 * @param shared - The resolved shared header/footer copy.
 * @param effective - The send's effective Locale (for `{date}`).
 * @param input - Product, Variant label, date, and the optional link.
 * @returns The rendered `{subject, text, html}` template.
 */
function solicitedNoticeEmail(
  copy: EmailSendCopy,
  whyLine: string,
  shared: EmailSharedCopy,
  effective: Locale,
  input: SolicitedNoticeInput
): EmailTemplate {
  const tags: Record<string, string> = {
    brand: BRAND_NAME,
    product: input.productName,
    variant: input.variantLabel,
    date: formatEmailDate(input.sendDate ?? new Date(), effective),
  };
  const subject = stripEmailImages(
    interpolateTags(copy.subject, tags, true)
  );
  const heading = interpolateTags(copy.heading, tags, true);
  const body = interpolateTags(copy.body, tags);
  // The link renders only when both fields arrived — `productUrl`
  // alone never produces a URL line or an empty button.
  const link =
    input.productUrl !== undefined && input.ctaLabel !== undefined
      ? { url: input.productUrl, cta: input.ctaLabel }
      : undefined;
  // Same `{image:…}` strip posture as the Thank-You Email: imagery is
  // decorative and never leaves tag debris in the text part.
  const headerText = stripEmailImages(shared.headerText ?? '');
  const footerText = stripEmailImages(shared.footerText ?? '');
  const text = [
    ...(headerText ? [headerText, ''] : []),
    stripEmailImages(heading),
    '',
    stripEmailImages(body),
    ...(link ? ['', link.url] : []),
    '',
    whyLine,
    ...(footerText ? ['', footerText] : []),
  ].join('\n');
  // Assembled as paragraphs joined with the shell's indentation so the
  // output matches the pre-shared-footer rendering structure.
  const paragraphs = [
    `<p style="margin:0 0 16px;font-size:18px;line-height:1.5;">${emailFieldHtml(heading)}</p>`,
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">\n       ${emailFieldHtmlMultiline(body)}\n     </p>`,
    ...(link
      ? [
          `<p style="margin:0 0 20px;">\n       <a href="${escapeHtml(link.url)}" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-family:system-ui,sans-serif;">\n         ${escapeHtml(link.cta)}\n       </a>\n     </p>`,
        ]
      : []),
    `<p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;font-family:system-ui,sans-serif;">\n       ${escapeHtmlMultiline(whyLine)}\n     </p>`,
  ];
  return {
    subject,
    text,
    html: htmlShell(paragraphs.join('\n     '), shared),
  };
}

/* ── Capture Acknowledgment (ADR 00-015) — list member, submission
   Locale. Solicited single-purpose send: confirms the capture landed. ── */

const CAPTURE_ACK_COPY: Record<Locale, EmailSendCopy> = {
  pt: {
    subject: 'Recebemos o seu pedido — {product}',
    heading: 'Está na lista',
    body: 'Obrigado — registámos o seu pedido para ser avisado quando {product} — {variant} voltar ao stock. Avisamo-lo assim que estiver novamente disponível.',
  },
  en: {
    subject: "We've received your request — {product}",
    heading: "You're on the list",
    body: "Thank you — we've saved your request to be notified when {product} — {variant} is back in stock. We'll email you as soon as it's available again.",
  },
};

/**
 * The Capture Acknowledgment's code-fixed consent-purpose line (ADR
 * 00-013: "the consent-purpose line ... stay[s] code-owned") — the old
 * why-you-got-this sentence merged with the purpose-bound footer so
 * the send stays inside the single consent purpose: it is about the
 * stock notification itself, never marketing (ADR 00-010).
 */
const CAPTURE_ACK_WHY: Record<Locale, string> = {
  pt: `${BRAND_NAME} — recebeu este email porque pediu para ser avisado quando esta variante voltasse ao stock; guardamos o seu email apenas para este aviso.`,
  en: `${BRAND_NAME} — you received this email because you asked to be notified when this variant comes back in stock; we keep your email only for this notification.`,
};

export interface CaptureAckEmailInput {
  productName: string;
  variantLabel: string;
  /** The send date for the `{date}` tag; defaults to now. */
  sendDate?: Date;
}

/**
 * Implements ADR 00-015: Transactional Notifications — the Capture
 * Acknowledgment carries "the product and Variant identified, the
 * promise that the Restock Notification follows — in the submission's
 * own Locale". Rendered by the stock-notification Route Handler's
 * success path; the why-you-got-this line keeps the send inside the
 * single consent purpose — it is about the stock notification
 * itself, never marketing (ADR 00-010).
 *
 * @param locale - The submission's Locale (falls back to the Primary
 *   Locale for an unsupported value, same as the sibling builders).
 * @param input - The product name and Variant display label the
 *   capture was scoped to.
 * @param emails - The operator's `emails` overrides group (ADR
 *   00-013): `emails.captureAck` merges per field over
 *   `CAPTURE_ACK_COPY`, `emails.shared` resolves the header/footer.
 * @returns The rendered `{subject, text, html}` template.
 */
export function captureAckEmail(
  locale: Locale,
  input: CaptureAckEmailInput,
  emails?: EmailOverrides
): EmailTemplate {
  const effective = resolvedEmailLocale(locale);
  const shared = resolveSharedCopy(locale, emails?.shared);
  const copy = resolveEmailCopy(CAPTURE_ACK_COPY, locale, emails?.captureAck);
  return solicitedNoticeEmail(
    copy,
    CAPTURE_ACK_WHY[effective],
    shared,
    effective,
    input
  );
}

/* ── Restock Notification (ADR 00-015) — list member, consent-
   record Locale. Solicited single-purpose send. ── */

const RESTOCK_COPY: Record<Locale, EmailSendCopy> = {
  pt: {
    subject: 'De volta ao stock: {product}',
    heading: 'Está de volta!',
    body: 'Pediu para ser avisado quando {product} — {variant} voltasse ao stock. Está disponível agora, em quantidade limitada.',
  },
  en: {
    subject: 'Back in stock: {product}',
    heading: "It's back!",
    body: "You asked to be told when {product} — {variant} came back in stock. It's available now, in limited quantity.",
  },
};

/**
 * The Restock Notification's code-fixed pieces (ADR 00-013: "the
 * consent-purpose line and the purchase CTA stay code-owned") — the
 * consent-purpose why-line (the old `why` merged with the
 * resolved-purpose footer sentence) and the CTA button label
 * rendered between the body and the shared footer.
 */
const RESTOCK_FIXED: Record<Locale, { why: string; cta: string }> = {
  pt: {
    why: `${BRAND_NAME} — recebeu este email porque pediu para ser notificado quando esta variante voltasse ao stock; este aviso foi enviado uma única vez e o seu pedido de notificação ficou resolvido.`,
    cta: 'Ver o produto',
  },
  en: {
    why: `${BRAND_NAME} — you received this email because you asked to be notified when this variant came back in stock; this notice was sent once and your notification request is now resolved.`,
    cta: 'View the product',
  },
};

export interface RestockEmailInput {
  productName: string;
  variantLabel: string;
  /** Canonical purchase URL in the recipient's Locale. */
  productUrl: string;
  /** The send date for the `{date}` tag; defaults to now. */
  sendDate?: Date;
}

/**
 * Implements ADR 00-015: Transactional Notifications — the Restock
 * Notification carries "the product and Variant identified, a link to
 * the recipient's Locale-prefixed Product Page, a why-you-got-this
 * line, and the operator identity/legal footer". The code-fixed CTA
 * supplies the link's button label; the consent record's Locale
 * drives the language.
 *
 * @param locale - The consent record's Locale (Primary-Locale fallback,
 *   same as the sibling builders).
 * @param input - The product name, Variant display label, and canonical
 *   purchase URL.
 * @param emails - The operator's `emails` overrides group (ADR
 *   00-013): `emails.restock` merges per field over `RESTOCK_COPY`,
 *   `emails.shared` resolves the header/footer.
 * @returns The rendered `{subject, text, html}` template.
 */
export function restockEmail(
  locale: Locale,
  input: RestockEmailInput,
  emails?: EmailOverrides
): EmailTemplate {
  const effective = resolvedEmailLocale(locale);
  const shared = resolveSharedCopy(locale, emails?.shared);
  const copy = resolveEmailCopy(RESTOCK_COPY, locale, emails?.restock);
  const fixed = RESTOCK_FIXED[effective];
  return solicitedNoticeEmail(copy, fixed.why, shared, effective, {
    ...input,
    ctaLabel: fixed.cta,
  });
}

/* ── Default copy export — the Admin Console's Email Templates
   section pre-fills each editable field with the effective value
   (operator override ?? this in-repo default). ── */

/**
 * Implements ADR 00-013: Email Delivery Channel — the in-repo default
 * shared header/footer copy per Locale: the store's own full logo
 * carried by the `{image:path}` tag as the default header — "the
 * logo asset by default" served from the Storefront's own origin
 * (the same `SITE_CONFIG.url` base the Restock Notification's
 * `productUrl` derives from) — and the brand sign-off line as the
 * default footer. Exposed for the Admin Console: the Email Templates
 * section pre-fills fields so the operator sees the copy that will
 * send before tuning it.
 */
export const DEFAULT_SHARED_COPY: Record<Locale, EmailSharedCopy> = {
  pt: {
    headerText: '{image:/logo/logo-full.png}',
    footerText: `${BRAND_NAME} — para qualquer questão, responda a este email ou fale connosco na nossa página de contacto.`,
  },
  en: {
    headerText: '{image:/logo/logo-full.png}',
    footerText: `${BRAND_NAME} — for any question, reply to this email or reach us on our contact page.`,
  },
};

/**
 * Implements ADR 00-013: Email Delivery Channel — the in-repo default
 * copy per customer-facing send kind, exposed for the Admin Console:
 * the Email Templates section pre-fills fields so the operator sees
 * the copy that will send before tuning it.
 */
export const DEFAULT_EMAIL_TEMPLATES: Record<
  EmailSendKind,
  Record<Locale, EmailSendCopy>
> = {
  thankYou: THANK_YOU_COPY,
  captureAck: CAPTURE_ACK_COPY,
  restock: RESTOCK_COPY,
};
