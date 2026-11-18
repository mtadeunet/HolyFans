/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-014: Contact Channel — the contact Route Handler is
 * "hardened to the norm of the checkout, like, and stock-notification
 * endpoints: input caps on body size and field lengths, strict
 * validation ..., per-IP rate limiting in the shared window, and
 * fail-closed behavior — when the delivery channel is unconfigured it
 * answers the graceful unavailable state and never reports a success it
 * did not send. On success it performs exactly one send ... with
 * `Reply-To` set to the visitor's email". A filled honeypot answers
 * `{ok: true}` — the silent success the trap requires.
 *
 * Covers `app/api/contact/route.ts`: the status contract — 400 invalid,
 * 429 rate-limited, 503 unconfigured channel, 502 provider failure, 200
 * success — plus the honeypot's silent 200 and the single-send
 * destination/`Reply-To` wiring. `lib/email` is mocked at the module
 * boundary (the only external dependency); parsing, rate limiting, and
 * the body cap run for real.
 *
 * The handler's rate log is module state: each case sends from a unique
 * `x-forwarded-for` IP so cases stay isolated; the 429 case owns its IP.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getEmailConfig, sendEmail } from '@/lib/email';
import { POST } from '@/app/api/contact/route';

vi.mock('@/lib/email', () => ({
  getEmailConfig: vi.fn(),
  sendEmail: vi.fn(),
}));

const mockedConfig = vi.mocked(getEmailConfig);
const mockedSend = vi.mocked(sendEmail);

const CONFIG = {
  sendUrl: 'https://api.zeptomail.example.test/v1.1/email',
  token: 'zoho-mail-agent-token',
  from: 'store@example.test',
  supportInbox: 'support@example.test',
  adminInbox: 'admin@example.test',
};

let ipCounter = 0;

/**
 * Build a POST `NextRequest` to `/api/contact` from a fresh client IP
 * (the rate window is per-IP, so unique IPs isolate cases).
 *
 * @param body - The JSON body object, or a raw string for malformed input.
 * @param headers - Extra headers (e.g. an explicit `content-length`).
 * @returns The request the handler consumes.
 */
function makeRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  ipCounter += 1;
  return new NextRequest('https://example.test/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
      ...headers,
    },
    body: raw,
  });
}

const VALID_BODY = {
  name: 'Example Visitor',
  email: 'user@example.test',
  subject: 'Order question',
  message: 'A synthetic question about an order.',
  locale: 'pt',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedConfig.mockReturnValue(CONFIG);
  mockedSend.mockResolvedValue(true);
});

describe('POST /api/contact — validation and abuse posture', () => {
  it('answers 400 invalid_request for a malformed body', async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, email: 'bad' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 400 for a non-JSON body', async () => {
    const response = await POST(makeRequest('this is not json'));
    expect(response.status).toBe(400);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 400 when the body exceeds the 4 KB cap — input cap (ADR 00-014)', async () => {
    const response = await POST(
      makeRequest({ ...VALID_BODY, message: 'm'.repeat(5 * 1024) })
    );
    expect(response.status).toBe(400);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 400 on a declared content-length over the cap without reading', async () => {
    const response = await POST(
      makeRequest(VALID_BODY, { 'content-length': String(8 * 1024) })
    );
    expect(response.status).toBe(400);
  });

  it('answers a silent {ok:true} for a filled honeypot and never sends', async () => {
    const response = await POST(
      makeRequest({ ...VALID_BODY, website: 'https://spam.test' })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 429 after five posts from one IP inside the window', async () => {
    const ip = '203.0.113.7';
    const results: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await POST(
        makeRequest(VALID_BODY, { 'x-forwarded-for': ip })
      );
      results.push(response.status);
    }
    expect(results.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(results[5]).toBe(429);
    expect(
      await POST(makeRequest(VALID_BODY, { 'x-forwarded-for': ip })).then((r) =>
        r.json()
      )
    ).toEqual({ error: 'contact_unavailable' });
    expect(mockedSend).toHaveBeenCalledTimes(5);
  });
});

describe('POST /api/contact — delivery-channel contract (ADR 00-013/00-014)', () => {
  it('answers 503 contact_unavailable when the channel is unconfigured — fail-closed', async () => {
    mockedConfig.mockReturnValue(null);
    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'contact_unavailable' });
    // Fail-closed means no send is attempted at all.
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 502 when the provider rejects the send', async () => {
    mockedSend.mockResolvedValue(false);
    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'contact_unavailable' });
  });

  it('performs exactly one send to the Support Inbox with Reply-To set to the visitor', async () => {
    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(mockedSend).toHaveBeenCalledTimes(1);
    const input = mockedSend.mock.calls[0][0];
    expect(input.to).toBe('support@example.test');
    expect(input.replyTo).toBe('user@example.test');
    // The relay template rendered for real — the visitor's words and
    // Locale are in the body, never the visitor's address logged.
    expect(input.subject).toBe('[Contacto] Order question');
    expect(input.text).toContain('A synthetic question about an order.');
    expect(input.text).toContain('Idioma do visitante: pt');
  });
});
