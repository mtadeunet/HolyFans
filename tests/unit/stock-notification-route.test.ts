/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-010: Pre-order and Stock Notification — "when the
 * managed store is unconfigured or unreachable it answers a graceful
 * 'unavailable' state and never reports a success it did not persist"
 * and "while the Purchase-Surface Gate (ADR 00-004) is closed, the
 * endpoint answers unavailable."
 *
 * Implements ADR 00-015: Transactional Notifications — the Capture
 * Acknowledgment "is best-effort by design: the stored list entry is
 * the record, the send happens after the store write, and a failed
 * acknowledgment never loses or reports against a capture."
 *
 * Covers `app/api/stock-notification/route.ts`: the gated 404, invalid
 * 400, store-unconfigured 503, write-failure 502, the `{ok: true}`
 * success, and the acknowledgment contract — one localized send to the
 * visitor with `Reply-To` the Support Inbox after the store write,
 * never attempted when no capture was stored, and never changing the
 * response on a send failure or an unconfigured channel.
 * `lib/managed-store` and `lib/email` are mocked at the module boundary
 * (the Redis client and the fetch transport are the true external
 * dependencies); parsing, rate limiting, the gate, and the templates
 * run for real.
 *
 * The handler's rate log is module state: each request sends from a
 * unique `x-forwarded-for` IP so cases stay isolated.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';
import { getEmailConfig, sendEmail } from '@/lib/email';
import { getManagedStore } from '@/lib/managed-store';
import { POST } from '@/app/api/stock-notification/route';

vi.mock('@/lib/email', () => ({
  getEmailConfig: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock('@/lib/managed-store', () => ({ getManagedStore: vi.fn() }));

const mockedStore = vi.mocked(getManagedStore);
const mockedConfig = vi.mocked(getEmailConfig);
const mockedSend = vi.mocked(sendEmail);

const EMAIL_CONFIG = {
  sendUrl: 'https://api.zeptomail.example.test/v1.1/email',
  token: 'zoho-mail-agent-token',
  from: 'store@example.test',
  supportInbox: 'support@example.test',
  adminInbox: 'admin@example.test',
};

/** A fake managed store whose `HSET` behavior each case controls. */
function makeStore() {
  return { hset: vi.fn(async () => 1) };
}

const VALID_BODY = {
  email: 'visitor@example.test',
  locale: 'pt',
  variantId: 'nsr-female-m',
};

let ipCounter = 0;

/**
 * Build a POST `NextRequest` to `/api/stock-notification` from a fresh
 * client IP (the rate window is per-IP, so unique IPs isolate cases).
 *
 * @param body - The JSON body object, or a raw string for malformed input.
 * @returns The request the handler consumes.
 */
function makeRequest(body: unknown): NextRequest {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  ipCounter += 1;
  return new NextRequest('https://example.test/api/stock-notification', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.1.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
    },
    body: raw,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // The Purchase-Surface Gate must be open for the handler to answer
  // anything but the gated 404 (ADR 00-004 / ADR 00-010).
  vi.stubEnv('PURCHASE_SURFACE_ENABLED', 'true');
  mockedStore.mockReturnValue(makeStore() as unknown as Redis);
  mockedConfig.mockReturnValue(EMAIL_CONFIG);
  mockedSend.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/stock-notification — gate and failure contract (ADR 00-010)', () => {
  it('answers 404 while the Purchase-Surface Gate is closed', async () => {
    vi.stubEnv('PURCHASE_SURFACE_ENABLED', undefined);
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'stock_notification_unavailable',
    });
    expect(store.hset).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 400 invalid_request for a malformed body — no write, no ack', async () => {
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(
      makeRequest({ ...VALID_BODY, email: 'not-an-email' })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(store.hset).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 503 when the managed store is unconfigured — fail-closed', async () => {
    mockedStore.mockReturnValue(null);

    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'stock_notification_unavailable',
    });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('answers 502 when the store write fails — the ack is never attempted', async () => {
    const store = makeStore();
    store.hset.mockRejectedValue(new Error('store unreachable'));
    mockedStore.mockReturnValue(store as unknown as Redis);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await POST(makeRequest(VALID_BODY));
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        error: 'stock_notification_unavailable',
      });
      // "the send happens after the store write" (ADR 00-015): no
      // stored capture means no acknowledgment.
      expect(mockedSend).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('POST /api/stock-notification — Capture Acknowledgment (ADR 00-015)', () => {
  it('sends one localized ack to the visitor with Reply-To the Support Inbox', async () => {
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    // The stored list entry is the record — the write ran first
    // ("the send happens after the store write", ADR 00-015).
    expect(store.hset).toHaveBeenCalledWith(
      'stock-notifications:nsr-female-m',
      expect.objectContaining({ 'visitor@example.test': expect.any(String) })
    );
    expect(store.hset.mock.invocationCallOrder[0]).toBeLessThan(
      mockedSend.mock.invocationCallOrder[0]
    );

    expect(mockedSend).toHaveBeenCalledTimes(1);
    const ack = mockedSend.mock.calls[0][0];
    expect(ack.to).toBe('visitor@example.test');
    expect(ack.replyTo).toBe('support@example.test');
    // The submission's Locale drives the template; the product and
    // Variant are identified (ADR 00-015).
    expect(ack.subject).toBe('Recebemos o seu pedido — Nossa Senhora da Rosa');
    expect(ack.text).toContain('Female Fit — M');
  });

  it("renders the ack in the submission's own Locale", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, locale: 'en' }));
    expect(response.status).toBe(200);
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedSend.mock.calls[0][0].subject).toBe(
      "We've received your request — Nossa Senhora da Rosa"
    );
  });

  it('still answers {ok:true} when the ack send fails — best-effort (ADR 00-015)', async () => {
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);
    mockedSend.mockResolvedValue(false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await POST(makeRequest(VALID_BODY));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      // The capture stands — the write succeeded.
      expect(store.hset).toHaveBeenCalledTimes(1);
      // The failure fact is logged — no address, no content (ADR 00-008).
      expect(errorSpy).toHaveBeenCalledWith(
        '[stock-notification] acknowledgment send failed'
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('still answers {ok:true} when the delivery channel is unconfigured', async () => {
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);
    mockedConfig.mockReturnValue(null);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const response = await POST(makeRequest(VALID_BODY));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      // The capture stands; the courtesy send is skipped, not failed.
      expect(store.hset).toHaveBeenCalledTimes(1);
      expect(mockedSend).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        '[stock-notification] email channel unconfigured — capture stored without acknowledgment'
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
