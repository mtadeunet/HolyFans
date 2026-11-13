/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-010: Pre-order and Stock Notification — "in a
 * dedicated keyspace scoped per Variant ... Repeat submissions of the
 * same email for the same Variant dedupe naturally" and the
 * stock-notification Route Handler's strict validation — "email shape
 * and length bound, a Variant identifier that must name a real Product
 * Data Variant, a Locale that must be a supported Locale".
 *
 * Covers `lib/stock-notification.ts`: the per-Variant keyspace
 * convention, the email shape/length bound, and the narrow body
 * validation that rejects malformed capture input before any store
 * write — no Redis or framework mocking required (the same
 * route-vs-logic split as `lib/likes.ts` and
 * `lib/checkout-validation.ts`).
 */
import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  parseStockNotificationBody,
  STOCK_NOTIFICATION_EMAIL_MAX_LENGTH,
  stockNotificationKey,
} from '@/lib/stock-notification';

describe('stockNotificationKey', () => {
  it('builds the per-Variant Stock Notification List key', () => {
    expect(stockNotificationKey('nsr-female-m')).toBe(
      'stock-notifications:nsr-female-m'
    );
  });

  it('scopes a dedicated keyspace per Variant', () => {
    expect(stockNotificationKey('nsr-female-m')).not.toBe(
      stockNotificationKey('nsr-female-l')
    );
  });
});

describe('isValidEmail', () => {
  it.each([
    'shopper@example.com',
    'name+tag@example.co.uk',
    'a@b.cd',
  ])('accepts the well-formed address %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    '',
    'not-an-email',
    'missing@tld',
    '@example.com',
    'no-at-sign.com',
    'two@@example.com',
    'white space@example.com',
    'trailing@space .com',
  ])('rejects the malformed address %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('parseStockNotificationBody', () => {
  const valid = {
    email: 'shopper@example.com',
    locale: 'pt',
    variantId: 'nsr-female-m',
  };

  it('accepts a well-formed capture body', () => {
    expect(parseStockNotificationBody(valid)).toEqual(valid);
  });

  it('normalizes the email for natural dedup (trim + lowercase)', () => {
    expect(
      parseStockNotificationBody({
        ...valid,
        email: '  Shopper@Example.COM ',
      })
    ).toEqual({ ...valid, email: 'shopper@example.com' });
  });

  it('rejects non-object input', () => {
    expect(parseStockNotificationBody(null)).toBeNull();
    expect(parseStockNotificationBody('x')).toBeNull();
    expect(parseStockNotificationBody(42)).toBeNull();
    expect(parseStockNotificationBody(undefined)).toBeNull();
  });

  it.each([
    '',
    'not-an-email',
    'missing@tld',
    'x'.repeat(STOCK_NOTIFICATION_EMAIL_MAX_LENGTH + 1),
  ])('rejects email %s — shape and length bound (ADR 00-010)', (email) => {
    expect(
      parseStockNotificationBody({ ...valid, email })
    ).toBeNull();
  });

  it('accepts an email exactly at the length bound', () => {
    // local@domain.tld shaped to exactly MAX length.
    const email = `${'a'.repeat(STOCK_NOTIFICATION_EMAIL_MAX_LENGTH - 'a@b.cd'.length)}@b.cd`;
    expect(
      parseStockNotificationBody({ ...valid, email })
    ).not.toBeNull();
  });

  it.each([[null], [123], [undefined], [{}]])(
    'rejects a non-string email %j',
    (email) => {
      expect(parseStockNotificationBody({ ...valid, email })).toBeNull();
    }
  );

  it.each([[null], [123], [undefined], [''], ['x'.repeat(17)]])(
    'rejects a malformed locale %j',
    (locale) => {
      expect(parseStockNotificationBody({ ...valid, locale })).toBeNull();
    }
  );

  it.each([['not-a-variant'], [''], ['NSR-FEMALE-M'], [null], [42]])(
    'rejects variantId %j — only real Product Data Variants may name store keys',
    (variantId) => {
      expect(
        parseStockNotificationBody({ ...valid, variantId })
      ).toBeNull();
    }
  );

  it('accepts every real Product Data Variant id', () => {
    for (const variantId of ['nsr-female-m', 'nsr-female-l']) {
      expect(
        parseStockNotificationBody({ ...valid, variantId })
      ).not.toBeNull();
    }
  });
});
