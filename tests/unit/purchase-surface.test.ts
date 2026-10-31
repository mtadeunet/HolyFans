/**
 * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated to
 * the PSP's Hosted Checkout." (interim purchase-surface gate, plan M0)
 *
 * Verifies the fail-closed contract of `PURCHASE_SURFACE_ENABLED`: only the
 * literal value 'true' exposes the simulated purchase surface; unset, empty,
 * or any other value keeps it hidden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';

const FLAG = 'PURCHASE_SURFACE_ENABLED';

describe('isPurchaseSurfaceEnabled', () => {
  afterEach(() => {
    delete process.env[FLAG];
  });

  it('is closed when the flag is unset', () => {
    delete process.env[FLAG];
    expect(isPurchaseSurfaceEnabled()).toBe(false);
  });

  it('is open only for the literal value "true"', () => {
    process.env[FLAG] = 'true';
    expect(isPurchaseSurfaceEnabled()).toBe(true);
  });

  it.each(['false', '', '1', 'yes', 'TRUE', 'True', ' true ', 'on'])(
    'stays closed for non-"true" value %j (fail-closed)',
    (value) => {
      process.env[FLAG] = value;
      expect(isPurchaseSurfaceEnabled()).toBe(false);
    }
  );
});
