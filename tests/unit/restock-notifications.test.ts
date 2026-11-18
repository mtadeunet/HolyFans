/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-015: Transactional Notifications — the Restock
 * Notification send "reads that Variant's Stock Notification List,
 * sends each entry the localized Restock Notification ... in the Locale
 * stored in its consent record, and deletes each successfully sent
 * address. Send-and-clear is the deletion mechanism completing ADR
 * 00-010's retention rule ... Failed sends keep their entries so the
 * action is retryable; the action reports per-Variant sent/failed
 * counts."
 *
 * Covers `sendRestockNotifications` in `app/admin/actions.ts`: the
 * fail-closed guards (unknown Variant, unconfigured store, unconfigured
 * channel), the per-entry `HGETALL` → send → `HDEL` send-and-clear loop,
 * the consent-record Locale driving each template (corrupt records
 * falling back to the Primary Locale), and the sent/failed reporting.
 * `lib/managed-store`, `lib/email`, `next/cache`, and the config stores
 * are mocked at their module boundaries — the Redis client and the
 * transport are the true external boundaries; the send-and-clear logic
 * runs for real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from '@upstash/redis';
import { getEmailConfig, sendEmail } from '@/lib/email';
import { getManagedStore } from '@/lib/managed-store';
import { sendRestockNotifications } from '@/app/admin/actions';
import { PRODUCT } from '@/lib/constants';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/email', () => ({
  getEmailConfig: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock('@/lib/managed-store', () => ({ getManagedStore: vi.fn() }));
vi.mock('@/lib/edge-config-write', () => ({ writeSiteConfig: vi.fn() }));
vi.mock('@/lib/site-config-server', () => ({ getSiteConfig: vi.fn() }));

const mockedStore = vi.mocked(getManagedStore);
const mockedConfig = vi.mocked(getEmailConfig);
const mockedSend = vi.mocked(sendEmail);

const VARIANT_ID = 'nsr-female-m';
const STORE_KEY = `stock-notifications:${VARIANT_ID}`;

const EMAIL_CONFIG = {
  sendUrl: 'https://api.zeptomail.example.test/v1.1/email',
  token: 'zoho-mail-agent-token',
  from: 'store@example.test',
  supportInbox: 'support@example.test',
  adminInbox: 'admin@example.test',
};

/** A fake store exposing the HASH ops the action drives. */
function makeStore(entries: Record<string, unknown> = {}) {
  return {
    hgetall: vi.fn(async () => entries),
    hdel: vi.fn(async () => 1),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedStore.mockReturnValue(makeStore() as unknown as Redis);
  mockedConfig.mockReturnValue(EMAIL_CONFIG);
  mockedSend.mockResolvedValue(true);
});

describe('sendRestockNotifications — fail-closed guards (ADR 00-015)', () => {
  it('rejects an unknown Variant before touching either dependency', async () => {
    const result = await sendRestockNotifications('not-a-variant');
    expect(result).toEqual({ ok: false, error: 'Unknown variant' });
    expect(mockedStore).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('reports an error when the managed store is unconfigured', async () => {
    mockedStore.mockReturnValue(null);
    const result = await sendRestockNotifications(VARIANT_ID);
    expect(result).toEqual({ ok: false, error: 'Store not configured' });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('reports an error when the delivery channel is unconfigured — never a fake success', async () => {
    mockedConfig.mockReturnValue(null);
    const result = await sendRestockNotifications(VARIANT_ID);
    expect(result).toEqual({
      ok: false,
      error: 'Email delivery not configured',
    });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('reports an error when the list read fails', async () => {
    const store = makeStore();
    store.hgetall.mockRejectedValue(new Error('redis down'));
    mockedStore.mockReturnValue(store as unknown as Redis);
    const result = await sendRestockNotifications(VARIANT_ID);
    expect(result.ok).toBe(false);
    expect(mockedSend).not.toHaveBeenCalled();
  });
});

describe('sendRestockNotifications — send-and-clear (ADR 00-010/00-015)', () => {
  it('returns zero counts on an empty list', async () => {
    const result = await sendRestockNotifications(VARIANT_ID);
    expect(result).toEqual({ ok: true, sent: 0, failed: 0 });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('sends each entry the localized Restock Notification and HDELs it on success', async () => {
    const store = makeStore({
      'one@example.test': JSON.stringify({
        consentedAt: '2026-01-01T00:00:00.000Z',
        locale: 'en',
      }),
      'two@example.test': {
        consentedAt: '2026-01-01T00:00:00.000Z',
        locale: 'pt',
      },
    });
    mockedStore.mockReturnValue(store as unknown as Redis);

    const result = await sendRestockNotifications(VARIANT_ID);
    expect(result).toEqual({ ok: true, sent: 2, failed: 0 });
    expect(store.hgetall).toHaveBeenCalledWith(STORE_KEY);

    // One send per entry, in the consent record's Locale, Reply-To the
    // Support Inbox (ADR 00-013/00-015).
    const [enSend, ptSend] = mockedSend.mock.calls.map((call) => call[0]);
    expect(enSend.to).toBe('one@example.test');
    expect(enSend.replyTo).toBe('support@example.test');
    expect(enSend.subject).toBe(`Back in stock: ${PRODUCT.name}`);
    expect(enSend.text).toContain('/en/checkout');
    expect(ptSend.to).toBe('two@example.test');
    expect(ptSend.subject).toBe(`De volta ao stock: ${PRODUCT.name}`);
    expect(ptSend.text).toContain('/pt/checkout');

    // Send-and-clear: each delivered address is HDEL'd — the list
    // entry's purpose ends when its notification is sent.
    expect(store.hdel).toHaveBeenCalledTimes(2);
    expect(store.hdel).toHaveBeenCalledWith(STORE_KEY, 'one@example.test');
    expect(store.hdel).toHaveBeenCalledWith(STORE_KEY, 'two@example.test');
  });

  it('keeps failed entries for retry and reports sent/failed counts', async () => {
    const store = makeStore({
      'ok@example.test': { consentedAt: 'x', locale: 'pt' },
      'fails@example.test': { consentedAt: 'x', locale: 'pt' },
    });
    mockedStore.mockReturnValue(store as unknown as Redis);
    mockedSend.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await sendRestockNotifications(VARIANT_ID);
    expect(result).toEqual({ ok: true, sent: 1, failed: 1 });
    // Only the delivered entry is cleared — the failure stays retryable.
    expect(store.hdel).toHaveBeenCalledTimes(1);
    expect(store.hdel).toHaveBeenCalledWith(STORE_KEY, 'ok@example.test');
  });

  it('still counts a send as sent when the HDEL cleanup fails', async () => {
    const store = makeStore({
      'one@example.test': { consentedAt: 'x', locale: 'pt' },
    });
    store.hdel.mockRejectedValue(new Error('redis down'));
    mockedStore.mockReturnValue(store as unknown as Redis);

    const result = await sendRestockNotifications(VARIANT_ID);
    // The send already happened — a duplicate on the next run is the
    // bounded, honest outcome, not a hidden failure.
    expect(result).toEqual({ ok: true, sent: 1, failed: 0 });
  });

  it('falls back to the Primary Locale for a corrupt consent record', async () => {
    const store = makeStore({ 'corrupt@example.test': 'not-json{{' });
    mockedStore.mockReturnValue(store as unknown as Redis);

    const result = await sendRestockNotifications(VARIANT_ID);
    expect(result).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(mockedSend.mock.calls[0][0].subject).toBe(
      `De volta ao stock: ${PRODUCT.name}`
    );
  });
});
