/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-015: Transactional Notifications — the Order Ledger:
 * "one `order:<sessionId>` document carrying the fulfillment-and-audit
 * detail ... plus a companion `orders` sorted set maintained newest-first
 * as the index of recorded orders"; "a record once settled (`paid`) never
 * regresses on a later-arriving event"; and the ledger as "the
 * fulfillment/audit copy" — the surface the operator's fulfillment
 * bookkeeping (`status`, `trackingId`) lands on through `updateOrder`
 * while the webhook's `persistOrder` preserves those fields across event
 * rewrites.
 *
 * Covers `lib/orders-server.ts`: `persistOrder`'s operator-field
 * preservation and paid-regression guard, `readOrders`' newest-first
 * enumeration and drop-malformed posture, `updateOrder`'s validated
 * merge and fail-closed reads, and `orderStatusOf`'s pending default.
 * The Redis client is faked at the `store` parameter — the routing and
 * document semantics run for real.
 *
 * Identifier hygiene (ADR 00-007): every session id, email, and name
 * below is synthetic — no real-world identifiers in tracked files.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Redis } from '@upstash/redis';
import type Stripe from 'stripe';
import {
  ORDER_STATUSES,
  orderStatusOf,
  persistOrder,
  readOrders,
  updateOrder,
  type OrderRecord,
} from '@/lib/orders-server';

const SESSION_ID = 'cs_test_synthetic_order';

/**
 * A fake managed store honoring the Order Ledger's command surface:
 * `GET` document reads (the document comes back auto-deserialized
 * like the real SDK returns it), `SET` document writes, `ZADD`
 * sorted-set index entries, `ZRANGE ... REV` enumeration, and
 * pipelined `GET` batches. `docs` tracks the stored JSON documents;
 * `zsets` the sorted-set indexes (member → score).
 */
function makeStore() {
  const docs = new Map<string, string>();
  const zsets = new Map<string, Map<string, number>>();
  // `GET` mirrors the SDK's auto-deserialization: a parseable JSON
  // document arrives as an object; an unparseable value arrives as
  // the raw string, which the readers' drop-malformed parsing skips.
  const readDoc = (key: string): unknown => {
    const value = docs.get(key);
    if (value === undefined) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
  return {
    docs,
    zsets,
    set: vi.fn(async (key: string, value: string): Promise<unknown> => {
      docs.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => readDoc(key)),
    zadd: vi.fn(
      async (key: string, scoreMember: { score: number; member: string }) => {
        const zset = zsets.get(key) ?? new Map<string, number>();
        const added = zset.has(scoreMember.member) ? 0 : 1;
        zset.set(scoreMember.member, scoreMember.score);
        zsets.set(key, zset);
        return added;
      }
    ),
    zrange: vi.fn(
      async (
        key: string,
        min: number,
        max: number,
        options?: { rev?: boolean }
      ) => {
        const zset = zsets.get(key) ?? new Map<string, number>();
        const members = [...zset.entries()]
          .sort((a, b) => a[1] - b[1])
          .map(([member]) => member);
        if (options?.rev) members.reverse();
        return members.slice(min, max === -1 ? undefined : max + 1);
      }
    ),
    pipeline: vi.fn(() => {
      const keys: string[] = [];
      return {
        get: (key: string) => {
          keys.push(key);
        },
        exec: async () => keys.map(readDoc),
      };
    }),
  };
}

/** A synthetic retrieved Checkout Session (paid, one line, pt Locale). */
function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    created: 1735689600,
    payment_status: 'paid',
    currency: 'eur',
    amount_total: 9000,
    metadata: { locale: 'pt' },
    customer_details: {
      email: 'buyer@example.test',
      name: 'Example Buyer',
      phone: '+351900000000',
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
  } as unknown as Stripe.Checkout.Session;
}

/** A synthetic stored `order:<sessionId>` document body. */
function orderDoc(
  id: string,
  created: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    created,
    paymentStatus: 'paid',
    currency: 'eur',
    amountTotalCents: 9000,
    locale: 'pt',
    customer: {
      name: 'Example Buyer',
      email: 'buyer@example.test',
      phone: '+351900000000',
    },
    shipping: {
      name: 'Example Buyer',
      address: 'Example Buyer, Rua Exemplo 1, 1000-001 Lisboa, PT',
      option: 'Standard',
    },
    items: [
      {
        name: 'Nossa Senhora da Rosa — M',
        quantity: 1,
        unitAmountCents: 9000,
      },
    ],
    ...overrides,
  };
}

/** Seed a stored order document plus its `orders` index member. */
async function seedOrder(
  store: ReturnType<typeof makeStore>,
  id: string,
  created: number,
  overrides: Record<string, unknown> = {}
): Promise<void> {
  store.docs.set(
    `order:${id}`,
    JSON.stringify(orderDoc(id, created, overrides))
  );
  await store.zadd('orders', { score: created, member: id });
}

describe('persistOrder — operator-field preservation (ADR 00-015)', () => {
  it('writes a fresh order without a status — it reads as pending', async () => {
    const store = makeStore();
    await persistOrder(
      store as unknown as Redis,
      makeSession(),
      'checkout.session.completed'
    );

    const doc = JSON.parse(
      store.docs.get(`order:${SESSION_ID}`) as string
    ) as OrderRecord;
    // The webhook never authors operator fields — the record carries
    // none and the defaulting helper answers 'pending'.
    expect(doc.status).toBeUndefined();
    expect(doc.trackingId).toBeUndefined();
    expect(orderStatusOf(doc)).toBe('pending');
  });

  it('preserves a stored status and trackingId across a settlement rewrite', async () => {
    const store = makeStore();
    // The awaiting-payment record carries the operator's bookkeeping.
    await seedOrder(store, SESSION_ID, 1735689600, {
      paymentStatus: 'unpaid',
      status: 'shipped',
      trackingId: 'TRK-SYNTHETIC-001',
    });

    // The settlement event refreshes the purchase detail — paid —
    // without clobbering the operator's fields.
    await persistOrder(
      store as unknown as Redis,
      makeSession(),
      'checkout.session.async_payment_succeeded'
    );

    const doc = JSON.parse(
      store.docs.get(`order:${SESSION_ID}`) as string
    ) as OrderRecord;
    expect(doc.paymentStatus).toBe('paid');
    expect(doc.status).toBe('shipped');
    expect(doc.trackingId).toBe('TRK-SYNTHETIC-001');
  });

  it('preserves operator fields even on a plain redelivery', async () => {
    const store = makeStore();
    await seedOrder(store, SESSION_ID, 1735689600, {
      status: 'processing',
      trackingId: 'TRK-SYNTHETIC-002',
    });

    await persistOrder(
      store as unknown as Redis,
      makeSession(),
      'checkout.session.completed'
    );

    const doc = JSON.parse(
      store.docs.get(`order:${SESSION_ID}`) as string
    ) as OrderRecord;
    expect(doc.status).toBe('processing');
    expect(doc.trackingId).toBe('TRK-SYNTHETIC-002');
  });

  it('drops a corrupt stored status rather than carrying it', async () => {
    const store = makeStore();
    await seedOrder(store, SESSION_ID, 1735689600, {
      status: 'teleported', // not an ORDER_STATUSES member
      trackingId: 42, // not a string
    });

    await persistOrder(
      store as unknown as Redis,
      makeSession(),
      'checkout.session.completed'
    );

    const doc = JSON.parse(
      store.docs.get(`order:${SESSION_ID}`) as string
    ) as OrderRecord;
    expect(doc.status).toBeUndefined();
    expect(doc.trackingId).toBeUndefined();
    expect(orderStatusOf(doc)).toBe('pending');
  });

  it('lands the merged record in a single SET — read, merge, write', async () => {
    const store = makeStore();
    await seedOrder(store, SESSION_ID, 1735689600, {
      paymentStatus: 'unpaid',
      status: 'shipped',
      trackingId: 'TRK-SYNTHETIC-001',
    });

    await persistOrder(
      store as unknown as Redis,
      makeSession(),
      'checkout.session.async_payment_succeeded'
    );

    // GET → merge in memory → one SET: no corrective second write
    // exists whose crash window could strand a half-merged document.
    expect(store.get).toHaveBeenCalledWith(`order:${SESSION_ID}`);
    expect(store.set).toHaveBeenCalledTimes(1);
  });

  it('a rejected SET leaves the previous document intact — the retry heals', async () => {
    const store = makeStore();
    await seedOrder(store, SESSION_ID, 1735689600, {
      paymentStatus: 'unpaid',
      status: 'processing',
    });
    store.set.mockRejectedValueOnce(new Error('store unreachable'));

    // The write failure propagates — the caller answers 502 so the
    // PSP retries — and nothing half-landed: the previous document is
    // intact, operator fields and all.
    await expect(
      persistOrder(
        store as unknown as Redis,
        makeSession(),
        'checkout.session.async_payment_succeeded'
      )
    ).rejects.toThrow('store unreachable');
    const intact = JSON.parse(
      store.docs.get(`order:${SESSION_ID}`) as string
    ) as OrderRecord;
    expect(intact.paymentStatus).toBe('unpaid');
    expect(intact.status).toBe('processing');

    // The retry re-reads the intact document, re-merges, and heals
    // completely — paid plus the preserved operator bookkeeping.
    await persistOrder(
      store as unknown as Redis,
      makeSession(),
      'checkout.session.async_payment_succeeded'
    );
    const healed = JSON.parse(
      store.docs.get(`order:${SESSION_ID}`) as string
    ) as OrderRecord;
    expect(healed.paymentStatus).toBe('paid');
    expect(healed.status).toBe('processing');
  });
});

describe('readOrders (ADR 00-015)', () => {
  it('returns the ledger newest-first through the orders index', async () => {
    const store = makeStore();
    await seedOrder(store, 'cs_oldest', 1700000000);
    await seedOrder(store, 'cs_newest', 1735689600);
    await seedOrder(store, 'cs_middle', 1720000000);

    const orders = await readOrders(store as unknown as Redis);
    expect(orders.map((order) => order.id)).toEqual([
      'cs_newest',
      'cs_middle',
      'cs_oldest',
    ]);
    expect(store.zrange).toHaveBeenCalledWith('orders', 0, -1, {
      rev: true,
    });
  });

  it('drops missing and corrupt documents without taking the list down', async () => {
    const store = makeStore();
    await seedOrder(store, 'cs_good', 1735689600);
    // Index member whose document was never written (mid-write crash).
    await store.zadd('orders', { score: 1720000000, member: 'cs_missing' });
    // Index member whose document is unparseable.
    store.docs.set('order:cs_corrupt', '{not json');
    await store.zadd('orders', { score: 1710000000, member: 'cs_corrupt' });
    // Index member whose document parses but is not an order record.
    store.docs.set('order:cs_shapeless', JSON.stringify({ hello: 1 }));
    await store.zadd('orders', { score: 1705000000, member: 'cs_shapeless' });

    const orders = await readOrders(store as unknown as Redis);
    expect(orders.map((order) => order.id)).toEqual(['cs_good']);
  });

  it('returns an empty list for an empty index — no document fetch at all', async () => {
    const store = makeStore();
    const orders = await readOrders(store as unknown as Redis);
    expect(orders).toEqual([]);
    expect(store.pipeline).not.toHaveBeenCalled();
  });

  it('surfaces operator fields the console edits', async () => {
    const store = makeStore();
    await seedOrder(store, 'cs_tracked', 1735689600, {
      status: 'complete',
      trackingId: 'TRK-SYNTHETIC-003',
    });

    const [order] = await readOrders(store as unknown as Redis);
    expect(orderStatusOf(order)).toBe('complete');
    expect(order.trackingId).toBe('TRK-SYNTHETIC-003');
  });
});

describe('updateOrder (ADR 00-015)', () => {
  it('writes a valid status and a trimmed trackingId', async () => {
    const store = makeStore();
    await seedOrder(store, SESSION_ID, 1735689600);

    const updated = await updateOrder(store as unknown as Redis, SESSION_ID, {
      status: 'processing',
      trackingId: '  TRK-SYNTHETIC-004  ',
    });

    expect(updated.status).toBe('processing');
    expect(updated.trackingId).toBe('TRK-SYNTHETIC-004');
    const doc = JSON.parse(
      store.docs.get(`order:${SESSION_ID}`) as string
    ) as OrderRecord;
    expect(doc.status).toBe('processing');
    expect(doc.trackingId).toBe('TRK-SYNTHETIC-004');
    // The webhook-owned purchase detail is untouched.
    expect(doc.paymentStatus).toBe('paid');
    expect(doc.amountTotalCents).toBe(9000);
  });

  it('rejects an invalid status and leaves the document untouched', async () => {
    const store = makeStore();
    await seedOrder(store, SESSION_ID, 1735689600, { status: 'pending' });

    await expect(
      updateOrder(store as unknown as Redis, SESSION_ID, {
        status: 'teleported',
      })
    ).rejects.toThrow('Invalid order status');
    // Fail-closed: no write reached the document.
    const doc = JSON.parse(
      store.docs.get(`order:${SESSION_ID}`) as string
    ) as OrderRecord;
    expect(doc.status).toBe('pending');
  });

  it('fails closed on a missing document rather than minting an order', async () => {
    const store = makeStore();
    await expect(
      updateOrder(store as unknown as Redis, 'cs_nonexistent', {
        status: 'processing',
      })
    ).rejects.toThrow('Unknown or corrupt order');
    expect(store.set).not.toHaveBeenCalled();
    expect(store.docs.has('order:cs_nonexistent')).toBe(false);
  });

  it('fails closed on a corrupt document', async () => {
    const store = makeStore();
    store.docs.set(`order:${SESSION_ID}`, '{not json');
    await expect(
      updateOrder(store as unknown as Redis, SESSION_ID, {
        status: 'processing',
      })
    ).rejects.toThrow('Unknown or corrupt order');
    expect(store.set).not.toHaveBeenCalled();
  });

  it('rejects a non-string trackingId with a named error — no .trim TypeError', async () => {
    const store = makeStore();
    await seedOrder(store, SESSION_ID, 1735689600);

    // Transport-untrusted input: a numeric tracking id must surface a
    // validation error, not crash on `.trim`.
    await expect(
      updateOrder(store as unknown as Redis, SESSION_ID, {
        trackingId: 42 as unknown as string,
      })
    ).rejects.toThrow('Invalid tracking id');
    expect(store.set).not.toHaveBeenCalled();
  });

  it('clears the trackingId on an empty submission', async () => {
    const store = makeStore();
    await seedOrder(store, SESSION_ID, 1735689600, {
      status: 'shipped',
      trackingId: 'TRK-SYNTHETIC-005',
    });

    const updated = await updateOrder(store as unknown as Redis, SESSION_ID, {
      trackingId: '   ',
    });

    expect(updated.trackingId).toBeUndefined();
    const doc = JSON.parse(
      store.docs.get(`order:${SESSION_ID}`) as string
    ) as Record<string, unknown>;
    // Absent, not empty-stringed — the stored document carries only
    // set fields.
    expect('trackingId' in doc).toBe(false);
    // Untouched fields survive a partial update.
    expect(doc.status).toBe('shipped');
  });
});

describe('ORDER_STATUSES / orderStatusOf', () => {
  it('enumerates the lifecycle in order', () => {
    expect(ORDER_STATUSES).toEqual([
      'pending',
      'processing',
      'shipped',
      'complete',
    ]);
  });
});
