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
import { describe, expect, it } from 'vitest';
import {
  captureAckEmail,
  contactRelay,
  orderAlertEmail,
  restockEmail,
  thankYouEmail,
  type OrderAlertInput,
} from '@/lib/email-templates';
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
    expect(text).toContain('Obrigado pela sua encomenda!');
    expect(text).toContain('uma bênção para si');
    expect(html).toContain('Obrigado pela sua encomenda!');
  });

  it('renders the en copy', () => {
    const { subject, text } = thankYouEmail('en');
    expect(subject).toBe('Thank you for your order');
    expect(text).toContain('Thank you for your order!');
    expect(text).toContain('a blessing to you');
  });

  it.each(['pt', 'en'] as Locale[])(
    'greets the customer by name when one is provided (%s)',
    (locale) => {
      const { text } = thankYouEmail(locale, 'Maria');
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
