/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-013: Email Delivery Channel — "Every send's content
 * is an in-repo, localized template (both Locales, ADR 00-005): plain
 * text with light branded HTML" and "Recipient-visible strings render in
 * the recipient's Locale ... Operator-facing mail renders in the Primary
 * Locale."
 *
 * Implements ADR 00-015: Transactional Notifications — the Operator
 * Order Alert carries "the order's line items, quantities, the shipping
 * address and option the customer chose, and the payment state"; the
 * Capture Acknowledgment carries "the product and Variant identified,
 * the promise that the Restock Notification follows — in the
 * submission's own Locale"; the Restock Notification carries "the
 * product and Variant identified, a link to the recipient's
 * Locale-prefixed Product Page, a why-you-got-this line, and the
 * operator identity/legal footer".
 *
 * Covers `lib/email-templates.ts`: `contactRelay`, `thankYouEmail`,
 * `orderAlertEmail`, `captureAckEmail`, and `restockEmail` — subjects,
 * localized bodies, HTML escaping of visitor-supplied content, and the
 * paid/awaiting wording of the Order Alert.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  captureAckEmail,
  contactRelay,
  EMAIL_SEND_KINDS,
  EMAIL_SEND_TAGS,
  EMAIL_SHARED_TAGS,
  EMPTY_EMAIL_OVERRIDES,
  normalizeEmailOverrides,
  orderAlertEmail,
  restockEmail,
  thankYouEmail,
  type EmailOverrides,
  type EmailTemplateOverride,
  type OrderAlertInput,
} from '@/lib/email-templates';
import { SITE_CONFIG } from '@/lib/constants';
import type { Locale } from '@/lib/i18n';

const RELAY_INPUT = {
  name: 'Example Visitor',
  email: 'user@example.test',
  subject: 'Order question',
  message: 'A synthetic question about an order.',
  locale: 'en',
};

const ORDER_INPUT: OrderAlertInput = {
  sessionId: 'cs_test_a1b2c3d4e5f6',
  lines: [
    { name: 'Nossa Senhora da Rosa — M', quantity: 1, unitAmountCents: 9000 },
    { name: 'Nossa Senhora da Rosa — L', quantity: 2, unitAmountCents: 9000 },
  ],
  totalCents: 27000,
  customerEmail: 'buyer@example.test',
  customerName: 'Example Buyer',
  shippingAddress: 'Example Buyer, Rua X 1, 1000-001 Lisboa, PT',
  shippingOption: 'Standard',
  paymentState: 'paid',
};

const RESTOCK_INPUT = {
  productName: 'Nossa Senhora da Rosa',
  variantLabel: 'Female Fit — M',
  productUrl: 'https://example.test/pt/checkout',
};

const ACK_INPUT = {
  productName: 'Nossa Senhora da Rosa',
  variantLabel: 'Female Fit — M',
};

/**
 * A well-formed `emails` group from a partial — builders take the whole
 * group (send-kind overrides plus `shared`), so tests assemble it like
 * the stored document does.
 */
const emailsWith = (partial: Partial<EmailOverrides>): EmailOverrides => ({
  ...EMPTY_EMAIL_OVERRIDES,
  ...partial,
});

describe('contactRelay — operator-facing, Primary Locale (ADR 00-014)', () => {
  it('prefixes the subject with [Contacto] and uses the visitor subject', () => {
    const { subject } = contactRelay(RELAY_INPUT);
    expect(subject).toBe('[Contacto] Order question');
  });

  it('falls back to a natural pt-PT heading when no subject is given', () => {
    const { subject } = contactRelay({ ...RELAY_INPUT, subject: undefined });
    expect(subject).toBe('[Contacto] Nova mensagem');
  });

  it('carries the visitor name, email, message, and Locale in the body', () => {
    const { text, html } = contactRelay(RELAY_INPUT);
    for (const field of [
      'Example Visitor',
      'user@example.test',
      'A synthetic question about an order.',
      'en',
    ]) {
      expect(text).toContain(field);
      expect(html).toContain(field);
    }
    expect(text).toContain('Idioma do visitante: en');
    // The operator answers by replying — the template says so.
    expect(text).toContain('Responda diretamente a este email');
  });

  it('labels an anonymous sender instead of leaving the field blank', () => {
    const { text } = contactRelay({ ...RELAY_INPUT, name: '' });
    expect(text).toContain('Nome: (sem nome)');
  });

  it('escapes visitor-supplied HTML in the branded body', () => {
    const { html, text } = contactRelay({
      ...RELAY_INPUT,
      message: '<script>alert(1)</script>',
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
    // The plain-text part stays verbatim — the visitor's own words.
    expect(text).toContain('<script>alert(1)</script>');
  });
});

describe('thankYouEmail — customer-facing, session Locale (ADR 00-015)', () => {
  it('renders natural pt-PT copy', () => {
    const { subject, text, html } = thankYouEmail('pt');
    expect(subject).toBe('Obrigado pela sua encomenda');
    // The {name} tag falls back to the Locale's word with no name.
    expect(text).toContain('Obrigado pela sua encomenda, cliente!');
    // The old body and blessing merge into the single body field.
    expect(text).toContain('uma bênção para si');
    expect(html).toContain('Obrigado pela sua encomenda, cliente!');
  });

  it('renders the en copy', () => {
    const { subject, text } = thankYouEmail('en');
    expect(subject).toBe('Thank you for your order');
    expect(text).toContain('Thank you for your order, friend!');
    expect(text).toContain('a blessing to you');
  });

  it.each(['pt', 'en'] as Locale[])(
    'greets the customer by name when one is provided (%s)',
    (locale) => {
      const { text } = thankYouEmail(locale, { customerName: 'Maria' });
      expect(text).toContain(', Maria!');
    }
  );

  it('falls back to the Primary Locale for an unsupported Locale', () => {
    const { subject } = thankYouEmail('fr' as Locale);
    expect(subject).toBe('Obrigado pela sua encomenda');
  });
});

describe('orderAlertEmail — operator-facing, Primary Locale (ADR 00-015)', () => {
  it('marks a paid order as paid in subject and body', () => {
    const { subject, text } = orderAlertEmail(ORDER_INPUT);
    expect(subject).toBe('[Encomenda] Nova encomenda paga — c3d4e5f6');
    expect(text).toContain('Nova encomenda paga.');
    expect(text).toContain('Estado do pagamento: pago');
  });

  it('marks a pending async payment as awaiting (ADR 00-015 Multibanco case)', () => {
    const { subject, text } = orderAlertEmail({
      ...ORDER_INPUT,
      paymentState: 'awaiting',
    });
    expect(subject).toBe('[Encomenda] Pagamento pendente — c3d4e5f6');
    expect(text).toContain('a aguardar pagamento');
    expect(text).toContain('Estado do pagamento: a aguardar');
  });

  it('carries the fulfillment detail: lines, quantities, totals, shipping', () => {
    const { text, html } = orderAlertEmail(ORDER_INPUT);
    expect(text).toContain('1× Nossa Senhora da Rosa — M — €90.00 un.');
    expect(text).toContain('2× Nossa Senhora da Rosa — L — €90.00 un.');
    expect(text).toContain('Total: €270.00');
    expect(text).toContain('Cliente: Example Buyer <buyer@example.test>');
    expect(text).toContain(
      'Envio: Example Buyer, Rua X 1, 1000-001 Lisboa, PT'
    );
    expect(text).toContain('Método de envio: Standard');
    expect(text).toContain('Sessão: cs_test_a1b2c3d4e5f6');
    expect(html).toContain('Nossa Senhora da Rosa');
  });

  it('degrades missing optional detail to em-dashes, not undefined', () => {
    const { text } = orderAlertEmail({
      ...ORDER_INPUT,
      customerEmail: undefined,
      customerName: undefined,
      shippingAddress: undefined,
      shippingOption: undefined,
    });
    expect(text).toContain('Cliente: — <—>');
    expect(text).toContain('Envio: —');
    expect(text).not.toContain('undefined');
  });
});

describe('captureAckEmail — solicited single-purpose send (ADR 00-015)', () => {
  it('renders natural pt-PT copy with the product and Variant identified', () => {
    const { subject, text } = captureAckEmail('pt', ACK_INPUT);
    expect(subject).toBe('Recebemos o seu pedido — Nossa Senhora da Rosa');
    expect(text).toContain('Está na lista');
    expect(text).toContain('Nossa Senhora da Rosa — Female Fit — M');
    // The Restock promise and the why-you-got-this line.
    expect(text).toContain('Avisamo-lo assim que estiver novamente disponível');
    expect(text).toContain('pediu para ser avisado');
    // The purpose-bound footer — the email stays inside the single
    // consent purpose (ADR 00-010).
    expect(text).toContain('apenas para este aviso');
  });

  it('renders the en copy', () => {
    const { subject, text } = captureAckEmail('en', ACK_INPUT);
    expect(subject).toBe(
      "We've received your request — Nossa Senhora da Rosa"
    );
    expect(text).toContain("You're on the list");
    expect(text).toContain('Nossa Senhora da Rosa — Female Fit — M');
    expect(text).toContain('as soon as');
    expect(text).toContain('asked to be notified');
  });

  it('carries the branded shell and escaped content in HTML', () => {
    const { html } = captureAckEmail('pt', {
      productName: 'Nossa Senhora da Rosa',
      variantLabel: 'Female <em>Fit</em> — M',
    });
    expect(html).toContain('Está na lista');
    expect(html).toContain('Female &lt;em&gt;Fit&lt;/em&gt;');
    expect(html).not.toContain('Female <em>Fit</em>');
  });

  it('falls back to the Primary Locale for an unsupported Locale', () => {
    const { subject } = captureAckEmail('fr' as Locale, ACK_INPUT);
    expect(subject).toBe('Recebemos o seu pedido — Nossa Senhora da Rosa');
  });
});

describe('operator copy overrides — Site Config `emails` group (ADR 00-013)', () => {
  it('renders the in-repo defaults when no overrides are given', () => {
    const { subject } = captureAckEmail('pt', ACK_INPUT);
    expect(subject).toBe('Recebemos o seu pedido — Nossa Senhora da Rosa');
    const ty = thankYouEmail('en');
    expect(ty.subject).toBe('Thank you for your order');
  });

  it('lets an override win per field while siblings keep defaults', () => {
    const { subject, text } = captureAckEmail(
      'pt',
      ACK_INPUT,
      emailsWith({
        captureAck: { pt: { subject: 'Pedido recebido — {product}' } },
      })
    );
    expect(subject).toBe('Pedido recebido — Nossa Senhora da Rosa');
    // Untouched fields render the in-repo copy (per-field merge).
    expect(text).toContain('Está na lista');
    // The consent-purpose line stays code-fixed.
    expect(text).toContain('apenas para este aviso');
  });

  it('falls back to the default for a blank override', () => {
    const { subject } = captureAckEmail(
      'pt',
      ACK_INPUT,
      emailsWith({ captureAck: { pt: { subject: '   ' } } })
    );
    expect(subject).toBe('Recebemos o seu pedido — Nossa Senhora da Rosa');
  });

  it('applies overrides per-Locale only', () => {
    const { subject } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({ captureAck: { pt: { subject: 'Pedido recebido' } } })
    );
    expect(subject).toBe(
      "We've received your request — Nossa Senhora da Rosa"
    );
  });

  it('interpolates {product} and {variant} tags in override copy', () => {
    const { text } = captureAckEmail(
      'pt',
      ACK_INPUT,
      emailsWith({
        captureAck: {
          pt: { body: 'Registámos o seu aviso para {product} — {variant}.' },
        },
      })
    );
    expect(text).toContain(
      'Registámos o seu aviso para Nossa Senhora da Rosa — Female Fit — M.'
    );
  });

  it('interpolates {brand} in every customer-facing send', () => {
    const brand = emailsWith({
      thankYou: { en: { body: 'From {brand}.' } },
      captureAck: { en: { body: 'From {brand}.' } },
      restock: { en: { body: 'From {brand}.' } },
    });
    expect(thankYouEmail('en', {}, brand).text).toContain(
      `From ${SITE_CONFIG.name}.`
    );
    expect(captureAckEmail('en', ACK_INPUT, brand).text).toContain(
      `From ${SITE_CONFIG.name}.`
    );
    expect(restockEmail('en', RESTOCK_INPUT, brand).text).toContain(
      `From ${SITE_CONFIG.name}.`
    );
  });

  it('renders unsupported tags literally', () => {
    const { text } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({ captureAck: { en: { body: 'Code {order} — {name}.' } } })
    );
    // {order} is not a vocabulary tag and {name} is not in this send's
    // vocabulary — both render literally.
    expect(text).toContain('Code {order} — {name}.');
  });

  it('interpolates {name} on the Thank-You Email with a Locale fallback', () => {
    const named = thankYouEmail(
      'en',
      { customerName: 'Maria' },
      emailsWith({ thankYou: { en: { heading: 'Hello, {name}!' } } })
    );
    expect(named.text).toContain('Hello, Maria!');
    const anonymous = thankYouEmail('pt');
    expect(anonymous.text).toContain('cliente');
    const anonymousEn = thankYouEmail('en');
    expect(anonymousEn.text).toContain('friend');
  });

  it('formats {date} via Intl.DateTimeFormat in the send Locale', () => {
    const sendDate = new Date('2025-01-15T12:00:00Z');
    const { text } = restockEmail(
      'pt',
      { ...RESTOCK_INPUT, sendDate },
      emailsWith({ restock: { pt: { body: 'Aviso de {date}.' } } })
    );
    expect(text).toContain(
      `Aviso de ${new Intl.DateTimeFormat('pt', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Lisbon',
      }).format(sendDate)}.`
    );
    const orderDate = new Date('2025-03-02T12:00:00Z');
    const thankYou = thankYouEmail(
      'en',
      { orderDate },
      emailsWith({ thankYou: { en: { body: 'Ordered on {date}.' } } })
    );
    expect(thankYou.text).toContain(
      `Ordered on ${new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Lisbon',
      }).format(orderDate)}.`
    );
  });

  it('renders {date} on the store calendar — Europe/Lisbon, not the host zone', () => {
    // 23:30 UTC on Jan 15 is already Jan 16 in Lisbon (UTC+1 in
    // winter): the tag renders the store's market day regardless of
    // the runtime host's zone.
    const sendDate = new Date('2025-01-15T23:30:00Z');
    const { text } = restockEmail(
      'pt',
      { ...RESTOCK_INPUT, sendDate },
      emailsWith({ restock: { pt: { body: 'Aviso de {date}.' } } })
    );
    expect(text).toContain(
      `Aviso de ${new Intl.DateTimeFormat('pt', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Lisbon',
      }).format(sendDate)}.`
    );
  });

  it('falls back to the send moment when the {date} input is an invalid Date', () => {
    // A malformed upstream `orderDate` must never throw a RangeError
    // out of Intl formatting — the tag renders "now" instead.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2025-06-10T12:00:00Z'));
      const { text } = thankYouEmail(
        'en',
        { orderDate: new Date('not-a-date') },
        emailsWith({ thankYou: { en: { body: 'Ordered on {date}.' } } })
      );
      expect(text).toContain(
        `Ordered on ${new Intl.DateTimeFormat('en', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'Europe/Lisbon',
        }).format(new Date())}.`
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a single-line field single-line when a tag value carries a line break', () => {
    // `trim()` strips edges only — an interior newline in a
    // code-supplied tag value (the customer name) collapses to a space
    // on single-line targets so the subject/heading can never split.
    const { subject, text } = thankYouEmail(
      'en',
      { customerName: 'Maria\nRosa' },
      emailsWith({
        thankYou: { en: { subject: 'Thank you, {name}', heading: '{name}' } },
      })
    );
    expect(subject).toBe('Thank you, Maria Rosa');
    expect(subject).not.toMatch(/[\r\n]/);
    expect(text).toContain('Maria Rosa');
  });

  it('escapes operator-supplied HTML in override copy', () => {
    const { html } = captureAckEmail(
      'pt',
      ACK_INPUT,
      emailsWith({ captureAck: { pt: { heading: '<b>Aviso</b>' } } })
    );
    expect(html).toContain('&lt;b&gt;Aviso&lt;/b&gt;');
    expect(html).not.toContain('<b>Aviso</b>');
  });

  it('escapes visitor-supplied HTML arriving through a tag value', () => {
    const { html } = thankYouEmail('en', {
      customerName: '<script>alert(1)</script>',
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it.each([
    {
      tag: 'name',
      render: () =>
        thankYouEmail(
          'en',
          // The sized form smuggles the same way — braces still strip.
          { customerName: '{image:/evil.png,size:80px}' },
          emailsWith({ thankYou: { en: { subject: 'Thanks, {name}' } } })
        ),
    },
    {
      tag: 'product',
      render: () =>
        restockEmail('en', {
          ...RESTOCK_INPUT,
          productName: '{image:/evil.png}',
        }),
    },
    {
      tag: 'variant',
      render: () =>
        restockEmail('en', {
          ...RESTOCK_INPUT,
          variantLabel: '{image:/evil.png}',
        }),
    },
  ])(
    'neutralizes a second-order {image:…} smuggled in the {$tag} value',
    ({ render }) => {
      // A code-supplied value can still be visitor input — the
      // customer name is Stripe `customer_details.name`. Braces strip
      // at interpolation, so the value renders as literal text and
      // can never re-enter the {image:…} grammar downstream.
      const { subject, text, html } = render();
      expect(`${subject}\n${text}`).toContain('image:/evil.png');
      expect(html).toContain('image:/evil.png');
      expect(subject).not.toContain('{image');
      expect(text).not.toContain('{image');
      // No visitor-authored <img> ever resolves in the HTML part.
      expect(html).not.toContain(`${SITE_CONFIG.url}/evil.png`);
      expect(html.match(/<img src="[^"]*evil\.png/)).toBeNull();
    }
  );

  it('renders multi-line override body fields as <br> in the HTML part', () => {
    const { html, text } = restockEmail(
      'pt',
      RESTOCK_INPUT,
      emailsWith({ restock: { pt: { body: 'Linha um\nLinha dois' } } })
    );
    expect(html).toContain('Linha um<br>Linha dois');
    // The text part keeps the operator's line break verbatim.
    expect(text).toContain('Linha um\nLinha dois');
  });

  it('keeps the restock CTA code-fixed — a smuggled `cta` key is not a field', () => {
    // Simulates a hand-built (unnormalized) stored document carrying a
    // key outside the kind's field list — the resolver only merges the
    // declared fields, so the code-fixed label wins.
    const emails = emailsWith({
      restock: JSON.parse(
        '{"en":{"cta":"Get it now","subject":"Stock! {product}"}}'
      ) as EmailTemplateOverride,
    });
    const { subject, html } = restockEmail('en', RESTOCK_INPUT, emails);
    expect(subject).toBe('Stock! Nossa Senhora da Rosa');
    expect(html).toContain('View the product');
    expect(html).not.toContain('Get it now');
  });

  it('overrides Thank-You copy without touching structure', () => {
    const { subject, text } = thankYouEmail(
      'en',
      { customerName: 'Maria' },
      emailsWith({
        thankYou: {
          en: { subject: 'Your order is in', heading: 'Hello, {name}!' },
        },
      })
    );
    expect(subject).toBe('Your order is in');
    // The name interpolates through the {name} tag in operator copy.
    expect(text).toContain('Hello, Maria!');
  });

  it('rejects a line break in a single-line override field at resolve time', () => {
    // The normalizer drops single-line fields carrying line breaks;
    // the resolver applies the same rule to a hand-built (unnormalized)
    // override — the newline never reaches the subject.
    const { subject } = captureAckEmail(
      'pt',
      ACK_INPUT,
      emailsWith({ captureAck: { pt: { subject: 'Linha um\nLinha dois' } } })
    );
    expect(subject).toBe('Recebemos o seu pedido — Nossa Senhora da Rosa');
  });
});

describe('shared header & footer — `emails.shared` (ADR 00-013)', () => {
  it('renders the default logo header image and brand footer', () => {
    const { html, text } = captureAckEmail('pt', ACK_INPUT);
    // The default header is the `{image:…}` tag resolving to the
    // Storefront's own origin plus the public/ asset path.
    expect(html).toContain(
      `src="${SITE_CONFIG.url}/logo/logo-full.png"`
    );
    // No `,size:` — the default styling applies (no width attribute).
    expect(html).toContain(
      `<img src="${SITE_CONFIG.url}/logo/logo-full.png" alt="" style="display:inline-block;max-width:160px;height:auto;border:0;vertical-align:middle;">`
    );
    expect(text).toContain(SITE_CONFIG.name);
    // The tag is decorative — it strips from the text part entirely.
    expect(text).not.toContain('{image');
    expect(text).not.toContain('logo-full.png');
  });

  it('resolves shared overrides per-Locale only', () => {
    const emails = emailsWith({
      shared: { pt: { footerText: 'Assinatura portuguesa' } },
    });
    expect(captureAckEmail('pt', ACK_INPUT, emails).text).toContain(
      'Assinatura portuguesa'
    );
    // The en send keeps its own default footer.
    const en = captureAckEmail('en', ACK_INPUT, emails);
    expect(en.text).not.toContain('Assinatura portuguesa');
    expect(en.text).toContain('reply to this email');
  });

  it('renders {image:path} tags in header, footer, and body as own-origin <img>', () => {
    const { html, text } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({
        shared: {
          en: {
            headerText: 'News {image:/logo/logo-full.png}',
            footerText: '{image:/logo/logo-mark.png}',
          },
        },
        captureAck: { en: { body: 'See {image:/images/detail.png} inside.' } },
      })
    );
    // Every valid tag resolves to the Storefront's origin + the path —
    // never an external URL the operator typed.
    expect(html).toContain(`src="${SITE_CONFIG.url}/logo/logo-full.png"`);
    expect(html).toContain(`src="${SITE_CONFIG.url}/logo/logo-mark.png"`);
    expect(html).toContain(`src="${SITE_CONFIG.url}/images/detail.png"`);
    expect(html).not.toContain('{image');
    // The text part strips the tags; the surrounding copy survives.
    expect(text).toContain('News');
    expect(text).toContain('See inside.');
    expect(text).not.toContain('{image');
    expect(text).not.toContain('.png');
  });

  it('collapses the blank lines a stripped {image:…} tag leaves behind', () => {
    const { text } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({
        captureAck: {
          en: { body: 'Intro.\n\n{image:/images/a.png}\n\nOutro.' },
        },
      })
    );
    // The tag-only line drops out — one paragraph break survives, not
    // a stacked run of blanks.
    expect(text).toContain('Intro.\n\nOutro.');
    expect(text).not.toContain('\n\n\n');
  });

  it('drops a tag-only line with its line break — no floating blank line', () => {
    const { text } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({
        captureAck: {
          en: { body: 'Intro.\n{image:/images/a.png}\nOutro.' },
        },
      })
    );
    // The tag's whole line goes — the surrounding copy ends up
    // adjacent, not a paragraph apart.
    expect(text).toContain('Intro.\nOutro.');
    expect(text).not.toContain('Intro.\n\nOutro.');
  });

  it('strips {image:…} in single-line fields — the subject stays text', () => {
    const { subject } = thankYouEmail(
      'en',
      {},
      emailsWith({
        thankYou: { en: { subject: 'Thank you {image:/logo/logo-full.png}' } },
      })
    );
    expect(subject).toBe('Thank you');
    expect(subject).not.toContain('{image');
  });

  it('renders ,size:Npx with a width attribute plus the px style', () => {
    const { html } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({
        shared: { en: { headerText: '{image:/logo/logo-mark.png,size:80px}' } },
      })
    );
    // The width attribute is the carrier — Outlook honors it where it
    // can ignore CSS; `max-width:100%` keeps the image inside the
    // letter on narrow clients.
    expect(html).toContain(
      `<img src="${SITE_CONFIG.url}/logo/logo-mark.png" width="80" style="width:80px;max-width:100%;height:auto;display:inline-block;" alt="">`
    );
  });

  it('renders ,size:N% as a CSS width without a width attribute', () => {
    const { html } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({
        shared: { en: { headerText: '{image:/logo/logo-mark.png,size:50%}' } },
      })
    );
    // Percentage width attributes are unreliable — CSS only (desktop
    // Outlook may degrade to the image's natural size).
    expect(html).toContain(
      `<img src="${SITE_CONFIG.url}/logo/logo-mark.png" style="width:50%;height:auto;display:inline-block;" alt="">`
    );
    expect(html).not.toContain('width="50"');
  });

  it.each(['16px', '600px', '1%', '100%'])(
    'renders the boundary size ,size:%s',
    (size) => {
      const { html } = captureAckEmail(
        'en',
        ACK_INPUT,
        emailsWith({
          shared: {
            en: { headerText: `{image:/logo/logo-mark.png,size:${size}}` },
          },
        })
      );
      expect(html).toContain(`src="${SITE_CONFIG.url}/logo/logo-mark.png"`);
      expect(html).not.toContain('{image');
    }
  );

  it.each([
    '{image:/logo/logo-mark.png,size:}',
    '{image:/logo/logo-mark.png,size:80}',
    '{image:/logo/logo-mark.png,size:80rem}',
    '{image:/logo/logo-mark.png,size:abc}',
    '{image:/logo/logo-mark.png,size:0px}',
    '{image:/logo/logo-mark.png,size:15px}',
    '{image:/logo/logo-mark.png,size:601px}',
    '{image:/logo/logo-mark.png,size:0%}',
    '{image:/logo/logo-mark.png,size:101%}',
    '{image:/logo/logo-mark.png,size:80px,extra}',
    // No comma — `size:` glued to the path is just an invalid path.
    '{image:/logo/logo-mark.pngsize:80px}',
    // A size with a bad path stays literal end-to-end.
    '{image:../x.png,size:80px}',
  ])('renders a malformed ,size: {image:…} tag literally — %s', (tag) => {
    const { html, text } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({ captureAck: { en: { body: `Look: ${tag}` } } })
    );
    // Same visible-mistake posture as an invalid path: the tag renders
    // as typed in both parts and never reaches an <img>.
    expect(text).toContain(`Look: ${tag}`);
    expect(html).toContain(`Look: ${tag}`);
    expect(html.match(/<img src="[^"]*logo-mark\.png/)).toBeNull();
    expect(html.match(/<img src="[^"]*x\.png/)).toBeNull();
  });

  it('strips sized {image:…} tags from the text part, collapsing tag-only lines', () => {
    const { text } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({
        captureAck: {
          en: {
            body: 'Intro.\n{image:/images/a.png,size:80px}\nSee {image:/images/b.png,size:50%} inside.',
          },
        },
      })
    );
    // The tag-only line drops with its line break; the mid-line sized
    // tag strips and its leftover whitespace collapses.
    expect(text).toContain('Intro.\nSee inside.');
    expect(text).not.toContain('{image');
    expect(text).not.toContain('.png');
  });

  it('advertises the sized image form in the admin tag lists', () => {
    expect(EMAIL_SHARED_TAGS).toContain('image:/path/to.png,size:80px');
    for (const kind of EMAIL_SEND_KINDS) {
      expect(EMAIL_SEND_TAGS[kind]).toContain(
        'image:/path/to.png,size:80px'
      );
    }
  });

  it.each([
    '{image:../etc/passwd}',
    '{image:/../etc/passwd}',
    '{image:/logo/../../etc/passwd}',
    '{image:javascript:alert(1)}',
    '{image:https://evil.test/x.png}',
    '{image:/logo/logo file.png}',
    '{image:}',
  ])('renders an invalid {image:…} path literally — %s', (tag) => {
    const { html, text } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({ captureAck: { en: { body: `Look: ${tag}` } } })
    );
    // Same posture as unknown tags: the operator's literal text renders
    // in both parts — no src is ever built from a non-public/ path.
    expect(text).toContain(`Look: ${tag}`);
    expect(html).toContain(
      `Look: ${tag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}`
    );
    expect(html).not.toContain('evil.test/x.png"');
    expect(html.match(/<img src="[^"]*(evil\.test|javascript:|passwd)/)).toBeNull();
  });

  it('renders shared header/footer line breaks as <br> in the HTML part', () => {
    // Both shared fields are multi-line textareas — an operator's
    // line break must survive into HTML like a body field's does.
    const { html, text } = captureAckEmail(
      'en',
      ACK_INPUT,
      emailsWith({
        shared: {
          en: {
            headerText: 'Tagline one\nTagline two',
            footerText: 'Footer one\nFooter two',
          },
        },
      })
    );
    expect(html).toContain('Tagline one<br>Tagline two');
    expect(html).toContain('Footer one<br>Footer two');
    // The text part keeps the operator's break verbatim.
    expect(text).toContain('Tagline one\nTagline two');
    expect(text).toContain('Footer one\nFooter two');
  });

  it('interpolates {brand} in shared text fields', () => {
    const { text } = captureAckEmail(
      'pt',
      ACK_INPUT,
      emailsWith({ shared: { pt: { footerText: 'Com carinho, {brand}' } } })
    );
    expect(text).toContain(`Com carinho, ${SITE_CONFIG.name}`);
  });

  it('keeps shared header/footer fields multi-line through normalization', () => {
    const normalized = normalizeEmailOverrides({
      shared: {
        pt: {
          headerText: '{image:/logo/logo-full.png}\nTagline aqui',
          footerText: 'Linha um\nLinha dois',
        },
      },
    });
    // Text and imagery compose inside the same field — line breaks are
    // legitimate content now, never a rejection.
    expect(normalized.shared.pt?.headerText).toBe(
      '{image:/logo/logo-full.png}\nTagline aqui'
    );
    expect(normalized.shared.pt?.footerText).toBe('Linha um\nLinha dois');
  });

  it('drops the legacy image-URL fields via the field whitelist — no migration', () => {
    const normalized = normalizeEmailOverrides({
      shared: {
        pt: {
          headerText: 'Cabeçalho',
          headerImageUrls: ['https://cdn.example.test/a.png'],
          footerImageUrls: ['https://cdn.example.test/b.png'],
        },
      },
    });
    // The iteration-2 URL lists simply drop out like every unknown key;
    // the text field survives untouched.
    expect(normalized.shared.pt).toEqual({ headerText: 'Cabeçalho' });
  });

  it('drops the legacy per-send override keys — no migration needed', () => {
    const normalized = normalizeEmailOverrides({
      thankYou: {
        pt: {
          greeting: 'Olá!',
          intro: 'Texto',
          why: 'Porquê',
          cta: 'Ver',
          blessing: 'Bênção',
          footer: 'Rodapé',
          subject: 'Assunto válido',
        },
      },
    });
    // Only the new-shape field survives; every legacy key is gone.
    expect(normalized.thankYou.pt).toEqual({ subject: 'Assunto válido' });
  });
});

describe('restockEmail — solicited single-purpose send (ADR 00-015)', () => {
  it('renders natural pt-PT copy with the product and Variant identified', () => {
    const { subject, text } = restockEmail('pt', RESTOCK_INPUT);
    expect(subject).toBe('De volta ao stock: Nossa Senhora da Rosa');
    expect(text).toContain('Está de volta!');
    expect(text).toContain('Nossa Senhora da Rosa — Female Fit — M');
    // The why-you-got-this line and the resolved-purpose footer.
    expect(text).toContain('pediu para ser notificado');
    expect(text).toContain('enviado uma única vez');
  });

  it('renders the en copy', () => {
    const { subject, text } = restockEmail('en', RESTOCK_INPUT);
    expect(subject).toBe('Back in stock: Nossa Senhora da Rosa');
    expect(text).toContain("It's back!");
    expect(text).toContain('asked to be notified');
  });

  it('embeds the product URL in text and as the HTML call-to-action link', () => {
    const { text, html } = restockEmail('pt', RESTOCK_INPUT);
    expect(text).toContain('https://example.test/pt/checkout');
    expect(html).toContain('href="https://example.test/pt/checkout"');
    expect(html).toContain('Ver o produto');
  });

  it('falls back to the Primary Locale for an unsupported Locale', () => {
    const { subject } = restockEmail('fr' as Locale, RESTOCK_INPUT);
    expect(subject).toBe('De volta ao stock: Nossa Senhora da Rosa');
  });
});
