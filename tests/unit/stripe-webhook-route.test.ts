/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-015: Transactional Notifications — the PSP Event
 * Receiver "verifies each request's signature against
 * `STRIPE_WEBHOOK_SECRET` (environment configuration; unconfigured → the
 * endpoint fails closed), accepts exactly two event types, and ignores
 * everything else"; "Sends are deduplicated against the managed store
 * ... so the PSP's retries can never double-send"; and "When the managed
 * store is unconfigured the endpoint still verifies signatures and
 * acknowledges events without sending — degrading rather than failing
 * the PSP's delivery."
 *
 * Covers `app/api/webhooks/stripe/route.ts`: the fail-closed 503, the
 * signature 400s, the bare-ack for unhandled events, the event routing
 * (paid `completed` → both emails; unpaid `completed` → Order Alert
 * only, marked awaiting; `async_payment_succeeded` → both), the
 * `SET ... NX` dedupe (sent/skipped/failed), and the degrade-to-200
 * posture. `lib/stripe`, `lib/managed-store`, and `lib/email` are mocked
 * at the module boundary — the PSP SDK, the Redis client, and the fetch
 * transport are the true external boundaries; the routing, dedupe
 * markers, and status contract run for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from '@upstash/redis';
import type Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { getEmailConfig, sendEmail } from '@/lib/email';
import { getManagedStore } from '@/lib/managed-store';
import { getSiteConfig } from '@/lib/site-config-server';
import { DEFAULT_SITE_CONFIG } from '@/lib/site-config';
import { getStripeClient } from '@/lib/stripe';
import { POST } from '@/app/api/webhooks/stripe/route';

vi.mock('@/lib/email', () => ({
  getEmailConfig: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock('@/lib/managed-store', () => ({ getManagedStore: vi.fn() }));
vi.mock('@/lib/site-config-server', () => ({ getSiteConfig: vi.fn() }));
vi.mock('@/lib/stripe', () => ({ getStripeClient: vi.fn() }));

const mockedStripe = vi.mocked(getStripeClient);
const mockedStore = vi.mocked(getManagedStore);
const mockedConfig = vi.mocked(getEmailConfig);
const mockedSend = vi.mocked(sendEmail);
const mockedSiteConfig = vi.mocked(getSiteConfig);

const SESSION_ID = 'cs_test_synthetic_order';

const EMAIL_CONFIG = {
  sendUrl: 'https://api.zeptomail.example.test/v1.1/email',
  token: 'zoho-mail-agent-token',
  from: 'store@example.test',
  supportInbox: 'support@example.test',
  adminInbox: 'admin@example.test',
};

/** A fake managed store honoring the `SET ... NX` claim semantics. */
function makeStore(preHeldKeys: string[] = []) {
  const held = new Set(preHeldKeys);
  return {
    held,
    set: vi.fn(async (key: string) => {
      if (held.has(key)) {
        return null;
      }
      held.add(key);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => (held.delete(key) ? 1 : 0)),
  };
}

/** A synthetic retrieved Checkout Session (paid, one line, pt Locale). */
function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    created: 1735689600, // A fixed unix timestamp — the Thank-You {date} tag reads the session date.
    payment_status: 'paid',
    amount_total: 9000,
    metadata: { locale: 'pt' },
    customer_details: {
      email: 'buyer@example.test',
      name: 'Example Buyer',
    },
    customer_email: 'buyer@example.test',
    line_items: {
      data: [
        {
          description: 'Nossa Senhora da Rosa — M',
          quantity: 1,
          amount_total: 9000,
          price: { unit_amount: 9000 },
        },
      ],
    },
    collected_information: {
      shipping_details: {
        name: 'Example Buyer',
        address: {
          line1: 'Rua Exemplo 1',
          postal_code: '1000-001',
          city: 'Lisboa',
          country: 'PT',
        },
      },
    },
    shipping_cost: { shipping_rate: { display_name: 'Standard' } },
    ...overrides,
  };
}

/** The fake Stripe client whose webhook + session APIs the route uses. */
const stripeClient = {
  webhooks: { constructEventAsync: vi.fn() },
  checkout: { sessions: { retrieve: vi.fn() } },
};

/**
 * Build a signed POST `NextRequest` to the webhook endpoint.
 *
 * @param headers - Header overrides; pass `stripe-signature: null`-style
 *   omissions via `includeSignature: false`.
 * @returns The request the handler consumes.
 */
function makeRequest(
  body = '{"id":"evt_synthetic"}',
  headers: Record<string, string> = {},
  includeSignature = true
): NextRequest {
  return new NextRequest('https://example.test/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(includeSignature ? { 'stripe-signature': 't=1,v1=synthetic' } : {}),
      ...headers,
    },
    body,
  });
}

/** Resolve signature verification to an event carrying the session id. */
function stubEvent(type: string, sessionId = SESSION_ID) {
  stripeClient.webhooks.constructEventAsync.mockResolvedValue({
    type,
    data: { object: { id: sessionId } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_synthetic');
  mockedStripe.mockReturnValue(stripeClient as unknown as Stripe);
  mockedStore.mockReturnValue(makeStore() as unknown as Redis);
  mockedConfig.mockReturnValue(EMAIL_CONFIG);
  mockedSend.mockResolvedValue(true);
  // The Thank-You send reads Site Config once per event for
  // `emails.thankYou` overrides (ADR 00-013) — default to the
  // no-override posture.
  mockedSiteConfig.mockResolvedValue(DEFAULT_SITE_CONFIG);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/webhooks/stripe — fail-closed and signature gate', () => {
  it('answers 503 when the Stripe client is unconfigured', async () => {
    mockedStripe.mockReturnValue(null);
    const response = await POST(makeRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'webhook_unavailable' });
    expect(stripeClient.webhooks.constructEventAsync).not.toHaveBeenCalled();
  });

  it('answers 503 when STRIPE_WEBHOOK_SECRET is unset — fail-closed (ADR 00-015)', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', undefined);
    const response = await POST(makeRequest());
    expect(response.status).toBe(503);
    expect(stripeClient.webhooks.constructEventAsync).not.toHaveBeenCalled();
  });

  it('answers 400 when the stripe-signature header is missing', async () => {
    const response = await POST(
      makeRequest('{}', {}, /* includeSignature */ false)
    );
    expect(response.status).toBe(400);
  });

  it('answers 400 when signature verification fails — the signature IS the auth', async () => {
    stripeClient.webhooks.constructEventAsync.mockRejectedValue(
      new Error('signature mismatch')
    );
    const response = await POST(makeRequest('{"forged":true}'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_signature' });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 400 when the declared content-length exceeds the input cap', async () => {
    const response = await POST(
      makeRequest('{}', { 'content-length': String(512 * 1024) })
    );
    expect(response.status).toBe(400);
    expect(stripeClient.webhooks.constructEventAsync).not.toHaveBeenCalled();
  });
});

describe('POST /api/webhooks/stripe — event routing (ADR 00-015)', () => {
  it('acknowledges unhandled event types without any work', async () => {
    stubEvent('payment_intent.succeeded');
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(stripeClient.checkout.sessions.retrieve).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('sends Thank-You + Order Alert on a paid checkout.session.completed', async () => {
    stubEvent('checkout.session.completed');
    stripeClient.checkout.sessions.retrieve.mockResolvedValue(makeSession());
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(mockedSend).toHaveBeenCalledTimes(2);

    const [thankYou, orderAlert] = mockedSend.mock.calls.map((call) => call[0]);
    // The Thank-You goes to the customer in the session Locale, with
    // Reply-To the Support Inbox (ADR 00-013 reply routing).
    expect(thankYou.to).toBe('buyer@example.test');
    expect(thankYou.toName).toBe('Example Buyer');
    expect(thankYou.replyTo).toBe('support@example.test');
    expect(thankYou.subject).toBe('Obrigado pela sua encomenda');
    // The Order Alert goes to the Admin Inbox with the fulfillment
    // detail (ADR 00-015).
    expect(orderAlert.to).toBe('admin@example.test');
    expect(orderAlert.subject).toContain('Nova encomenda paga');
    expect(orderAlert.text).toContain('Método de envio: Standard');
    // Both send kinds claimed their dedupe markers.
    expect(store.set).toHaveBeenCalledWith(
      `email-sent:${SESSION_ID}:thank-you`,
      '1',
      expect.objectContaining({ nx: true })
    );
    expect(store.set).toHaveBeenCalledWith(
      `email-sent:${SESSION_ID}:order-alert`,
      '1',
      expect.objectContaining({ nx: true })
    );
  });

  it('sends only the awaiting-payment Order Alert on an unpaid completed event', async () => {
    stubEvent('checkout.session.completed');
    stripeClient.checkout.sessions.retrieve.mockResolvedValue(
      makeSession({ payment_status: 'unpaid' })
    );

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    // No customer email before settlement (ADR 00-015).
    expect(mockedSend).toHaveBeenCalledTimes(1);
    const alert = mockedSend.mock.calls[0][0];
    expect(alert.to).toBe('admin@example.test');
    expect(alert.subject).toContain('Pagamento pendente');
    expect(alert.text).toContain('a aguardar pagamento');
  });

  it('sends Thank-You + Order Alert on checkout.session.async_payment_succeeded', async () => {
    stubEvent('checkout.session.async_payment_succeeded');
    stripeClient.checkout.sessions.retrieve.mockResolvedValue(makeSession());

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(mockedSend).toHaveBeenCalledTimes(2);
    expect(mockedSend.mock.calls[0][0].subject).toBe(
      'Obrigado pela sua encomenda'
    );
  });

  it('applies Site Config emails.thankYou overrides to the customer email (ADR 00-013)', async () => {
    mockedSiteConfig.mockResolvedValue({
      ...DEFAULT_SITE_CONFIG,
      emails: {
        ...DEFAULT_SITE_CONFIG.emails,
        thankYou: { pt: { subject: 'A sua encomenda foi recebida' } },
      },
    });
    stubEvent('checkout.session.completed');
    stripeClient.checkout.sessions.retrieve.mockResolvedValue(makeSession());

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    // The operator's subject override reached the send payload; the
    // Order Alert is operator-facing and stays code-fixed.
    const [thankYou, orderAlert] = mockedSend.mock.calls.map((call) => call[0]);
    expect(thankYou.subject).toBe('A sua encomenda foi recebida');
    expect(orderAlert.subject).toContain('Nova encomenda paga');
  });

  it('acknowledges a paid event with no reachable customer email — Order Alert only', async () => {
    stubEvent('checkout.session.completed');
    stripeClient.checkout.sessions.retrieve.mockResolvedValue(
      makeSession({ customer_details: null, customer_email: null })
    );

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    // The alert still reaches the operator; the thank-you cannot exist.
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedSend.mock.calls[0][0].to).toBe('admin@example.test');
  });
});

describe('POST /api/webhooks/stripe — dedupe and failure posture', () => {
  it('acknowledges a redelivered event without re-sending a claimed kind', async () => {
    stubEvent('checkout.session.completed');
    stripeClient.checkout.sessions.retrieve.mockResolvedValue(makeSession());
    // The PSP's retry: the thank-you marker is already held.
    const store = makeStore([`email-sent:${SESSION_ID}:thank-you`]);
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    // Only the unclaimed Order Alert sends — retries never double-send.
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedSend.mock.calls[0][0].subject).toContain(
      'Nova encomenda paga'
    );
  });

  it('answers 502 and releases the marker when a send fails, so the PSP retry can send', async () => {
    stubEvent('checkout.session.completed');
    stripeClient.checkout.sessions.retrieve.mockResolvedValue(makeSession());
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);
    // The Thank-You send fails; the Order Alert succeeds.
    mockedSend.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const response = await POST(makeRequest());
    expect(response.status).toBe(502);
    // The failed send's marker was released — the retry can claim it.
    expect(store.del).toHaveBeenCalledWith(
      `email-sent:${SESSION_ID}:thank-you`
    );
    expect(store.held.has(`email-sent:${SESSION_ID}:thank-you`)).toBe(false);
    expect(store.held.has(`email-sent:${SESSION_ID}:order-alert`)).toBe(true);
  });

  it('still answers 502 when the marker release itself fails — a retry beats silence', async () => {
    stubEvent('checkout.session.completed');
    stripeClient.checkout.sessions.retrieve.mockResolvedValue(makeSession());
    const store = makeStore();
    // The Thank-You send fails AND releasing its marker fails — the
    // marker stays held but the endpoint must not swallow the failure.
    store.del.mockRejectedValueOnce(new Error('store unreachable'));
    mockedStore.mockReturnValue(store as unknown as Redis);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedSend.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    try {
      const response = await POST(makeRequest());
      expect(response.status).toBe(502);
      // The release failure is logged with the key (session id + send
      // kind — no PII) so the operator can reconcile the held marker.
      expect(errorSpy).toHaveBeenCalledWith(
        '[webhooks/stripe] dedupe marker release failed:',
        `email-sent:${SESSION_ID}:thank-you`,
        expect.any(Error)
      );
      expect(store.held.has(`email-sent:${SESSION_ID}:thank-you`)).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("acknowledges without sending when the managed store is unconfigured — degrade, don't fail (ADR 00-015)", async () => {
    stubEvent('checkout.session.completed');
    mockedStore.mockReturnValue(null);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(stripeClient.checkout.sessions.retrieve).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('acknowledges without sending when the delivery channel is unconfigured', async () => {
    stubEvent('checkout.session.completed');
    mockedConfig.mockReturnValue(null);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 502 when the session retrieve fails — the PSP retries', async () => {
    stubEvent('checkout.session.completed');
    stripeClient.checkout.sessions.retrieve.mockRejectedValue(
      new Error('stripe api down')
    );

    const response = await POST(makeRequest());
    expect(response.status).toBe(502);
    expect(mockedSend).not.toHaveBeenCalled();
  });
});
