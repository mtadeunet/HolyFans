import type { Locale } from '@/lib/i18n';
import { SITE_CONFIG } from '@/lib/constants';

/**
 * Implements ADR 00-013: Email Delivery Channel — "Every send's
 * content is an in-repo, localized template (both Locales, ADR
 * 00-005): plain text with light branded HTML, no external template
 * service, no provider-side template storage."
 *
 * Pure template builders for the channel's five sends: the Contact
 * Form relay, the customer Thank-You Email, the Operator Order Alert,
 * the Capture Acknowledgment, and the Restock Notification. Each
 * returns `{subject, text, html}` —
 * plain text always, a light branded HTML companion for
 * customer-facing mail. Operator-facing mail (the relay and the
 * alert) renders in the Primary Locale; customer-facing mail renders
 * in the recipient's Locale.
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
 * The shared branded HTML wrapper: brand mark as text, accent rule,
 * the message body, and a quiet footer. Deliberately light — one
 * accent color and system fonts, no external assets — so the email
 * renders everywhere and loads nothing.
 */
function htmlShell(body: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#fafafa;font-family:Georgia,'Times New Roman',serif;color:#111827;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
      <p style="margin:0 0 4px;font-size:20px;letter-spacing:0.02em;">${BRAND_NAME}</p>
      <div style="height:2px;width:48px;background:#0369a1;margin-bottom:24px;"></div>
      ${body}
      <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;font-family:system-ui,sans-serif;">
        ${BRAND_NAME} · ${escapeHtml(SITE_CONFIG.url)}
      </p>
    </div>
  </body>
</html>`;
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

const THANK_YOU_COPY: Record<
  Locale,
  {
    subject: string;
    greeting: string;
    body: string;
    blessing: string;
    footer: string;
  }
> = {
  pt: {
    subject: 'Obrigado pela sua encomenda',
    greeting: 'Obrigado pela sua encomenda!',
    body: 'A sua compra foi confirmada e vamos começar a preparar a sua peça com todo o cuidado que ela merece. Receberá também o recibo de pagamento do nosso parceiro de pagamentos.',
    blessing:
      'Que esta peça seja uma bênção para si — e uma forma elegante de partilhar a sua fé.',
    footer:
      'Para qualquer questão sobre a sua encomenda, responda a este email ou fale connosco na nossa página de contacto.',
  },
  en: {
    subject: 'Thank you for your order',
    greeting: 'Thank you for your order!',
    body: 'Your purchase is confirmed and we will start preparing your piece with all the care it deserves. You will also receive a payment receipt from our payment provider.',
    blessing:
      'May this piece be a blessing to you — and an elegant way to share your faith.',
    footer:
      'For any question about your order, reply to this email or reach us on our contact page.',
  },
};

export function thankYouEmail(
  locale: Locale,
  customerName?: string
): EmailTemplate {
  const copy = THANK_YOU_COPY[locale] ?? THANK_YOU_COPY.pt;
  const greeting = customerName
    ? `${copy.greeting.replace('!', '')}, ${customerName}!`
    : copy.greeting;
  const text = [
    greeting,
    '',
    copy.body,
    '',
    copy.blessing,
    '',
    copy.footer,
  ].join('\n');
  const html = htmlShell(
    `<p style="margin:0 0 16px;font-size:18px;line-height:1.5;">${escapeHtml(greeting)}</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(copy.body)}</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.6;font-style:italic;color:#075985;">
       ${escapeHtml(copy.blessing)}
     </p>
     <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;font-family:system-ui,sans-serif;">
       ${escapeHtml(copy.footer)}
     </p>`
  );
  return { subject: copy.subject, text, html };
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
   Restock Notification are the same letter: heading, intro, an
   optional purchase link, the why-you-got-this line, and the
   purpose-bound footer. ── */

/**
 * The per-Locale copy shape shared by the solicited single-purpose
 * sends: `subject` and `intro` interpolate the product (and Variant),
 * the rest are fixed lines.
 */
interface SolicitedNoticeCopy {
  subject: (product: string) => string;
  heading: string;
  intro: (product: string, variant: string) => string;
  why: string;
  footer: string;
}

/**
 * The inputs shared by the solicited notices. `productUrl` and
 * `ctaLabel` travel together — set for the Restock Notification's
 * purchase link, absent for the Capture Acknowledgment (it carries no
 * link; it promises the Restock Notification instead).
 */
interface SolicitedNoticeInput {
  productName: string;
  variantLabel: string;
  /** Canonical purchase URL in the recipient's Locale. */
  productUrl?: string;
  /** The CTA button's label — required when `productUrl` is set. */
  ctaLabel?: string;
}

/**
 * Render one solicited single-purpose send from its selected copy
 * table. The purchase link is the only structural divergence: when
 * present it adds a bare-URL line to the text part and a CTA button to
 * the HTML part; both parts stay identical to the pre-extraction
 * per-send builders.
 *
 * @param copy - The Locale-selected copy table.
 * @param input - Product, Variant label, and the optional link fields.
 * @returns The rendered `{subject, text, html}` template.
 */
function solicitedNoticeEmail(
  copy: SolicitedNoticeCopy,
  input: SolicitedNoticeInput
): EmailTemplate {
  const subject = copy.subject(input.productName);
  const intro = copy.intro(input.productName, input.variantLabel);
  // The link renders only when both fields arrived — `productUrl`
  // alone never produces a URL line or an empty button.
  const link =
    input.productUrl !== undefined && input.ctaLabel !== undefined
      ? { url: input.productUrl, cta: input.ctaLabel }
      : undefined;
  const text = [
    copy.heading,
    '',
    intro,
    ...(link ? ['', link.url] : []),
    '',
    copy.why,
    '',
    copy.footer,
  ].join('\n');
  // Assembled as paragraphs joined with the shell's indentation so the
  // output is byte-identical to the two builders this replaces.
  const paragraphs = [
    `<p style="margin:0 0 16px;font-size:18px;line-height:1.5;">${escapeHtml(copy.heading)}</p>`,
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">\n       ${escapeHtml(intro)}\n     </p>`,
    ...(link
      ? [
          `<p style="margin:0 0 20px;">\n       <a href="${escapeHtml(link.url)}" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-family:system-ui,sans-serif;">\n         ${escapeHtml(link.cta)}\n       </a>\n     </p>`,
        ]
      : []),
    `<p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;font-family:system-ui,sans-serif;">\n       ${escapeHtml(copy.why)} ${escapeHtml(copy.footer)}\n     </p>`,
  ];
  return { subject, text, html: htmlShell(paragraphs.join('\n     ')) };
}

/* ── Capture Acknowledgment (ADR 00-015) — list member, submission
   Locale. Solicited single-purpose send: confirms the capture landed. ── */

const CAPTURE_ACK_COPY: Record<Locale, SolicitedNoticeCopy> = {
  pt: {
    subject: (product) => `Recebemos o seu pedido — ${product}`,
    heading: 'Está na lista',
    intro: (product, variant) =>
      `Obrigado — registámos o seu pedido para ser avisado quando ${product} — ${variant} voltar ao stock. Avisamo-lo assim que estiver novamente disponível.`,
    why: 'Recebeu este email porque pediu para ser avisado quando esta variante voltasse ao stock.',
    footer: `${BRAND_NAME} — guardamos o seu email apenas para este aviso.`,
  },
  en: {
    subject: (product) => `We've received your request — ${product}`,
    heading: "You're on the list",
    intro: (product, variant) =>
      `Thank you — we've saved your request to be notified when ${product} — ${variant} is back in stock. We'll email you as soon as it's available again.`,
    why: 'You received this email because you asked to be notified when this variant comes back in stock.',
    footer: `${BRAND_NAME} — we keep your email only for this notification.`,
  },
};

export interface CaptureAckEmailInput {
  productName: string;
  variantLabel: string;
}

/**
 * Implements ADR 00-015: Transactional Notifications — the Capture
 * Acknowledgment carries "the product and Variant identified, the
 * promise that the Restock Notification follows — in the submission's
 * own Locale". Rendered by the stock-notification Route Handler's
 * success path; the why-you-got-this line and the purpose-bound footer
 * keep the send inside the single consent purpose — it is about the
 * stock notification itself, never marketing (ADR 00-010).
 *
 * @param locale - The submission's Locale (falls back to the Primary
 *   Locale for an unsupported value, same as the sibling builders).
 * @param input - The product name and Variant display label the
 *   capture was scoped to.
 * @returns The rendered `{subject, text, html}` template.
 */
export function captureAckEmail(
  locale: Locale,
  input: CaptureAckEmailInput
): EmailTemplate {
  const copy = CAPTURE_ACK_COPY[locale] ?? CAPTURE_ACK_COPY.pt;
  return solicitedNoticeEmail(copy, input);
}

/* ── Restock Notification (ADR 00-015) — list member, consent-
   record Locale. Solicited single-purpose send. ── */

const RESTOCK_COPY: Record<Locale, SolicitedNoticeCopy & { cta: string }> = {
  pt: {
    subject: (product) => `De volta ao stock: ${product}`,
    heading: 'Está de volta!',
    intro: (product, variant) =>
      `Pediu para ser avisado quando ${product} — ${variant} voltasse ao stock. Está disponível agora, em quantidade limitada.`,
    cta: 'Ver o produto',
    why: 'Recebeu este email porque pediu para ser notificado quando esta variante voltasse ao stock.',
    footer: `${BRAND_NAME} — este aviso foi enviado uma única vez; o seu pedido de notificação ficou resolvido.`,
  },
  en: {
    subject: (product) => `Back in stock: ${product}`,
    heading: "It's back!",
    intro: (product, variant) =>
      `You asked to be told when ${product} — ${variant} came back in stock. It's available now, in limited quantity.`,
    cta: 'View the product',
    why: 'You received this email because you asked to be notified when this variant came back in stock.',
    footer: `${BRAND_NAME} — this notice was sent once; your notification request is now resolved.`,
  },
};

export interface RestockEmailInput {
  productName: string;
  variantLabel: string;
  /** Canonical purchase URL in the recipient's Locale. */
  productUrl: string;
}

/**
 * Implements ADR 00-015: Transactional Notifications — the Restock
 * Notification carries "the product and Variant identified, a link to
 * the recipient's Locale-prefixed Product Page, a why-you-got-this
 * line, and the operator identity/legal footer". The copy table's
 * `cta` supplies the link's button label; the consent record's Locale
 * drives the language.
 *
 * @param locale - The consent record's Locale (Primary-Locale fallback,
 *   same as the sibling builders).
 * @param input - The product name, Variant display label, and canonical
 *   purchase URL.
 * @returns The rendered `{subject, text, html}` template.
 */
export function restockEmail(
  locale: Locale,
  input: RestockEmailInput
): EmailTemplate {
  const copy = RESTOCK_COPY[locale] ?? RESTOCK_COPY.pt;
  return solicitedNoticeEmail(copy, {
    productName: input.productName,
    variantLabel: input.variantLabel,
    productUrl: input.productUrl,
    ctaLabel: copy.cta,
  });
}
