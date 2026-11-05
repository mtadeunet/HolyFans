/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior — Cart operations and Purchase Cap clamping, Product
 * Data integrity".
 *
 * Implements ADR 00-004: Commerce and Checkout - the checkout Route
 * Handler "re-validates every Cart line server-side against Product Data"
 * and "refuses checkout on any Cart/Product Data divergence". These tests
 * pin the divergence contract the handler returns to the shopper.
 */
import { describe, expect, it } from 'vitest';
import { PRODUCT } from '@/lib/constants';
import { MAX_CART_LINES, validateCart } from '@/lib/checkout-validation';

const AVAILABLE_ID = PRODUCT.variants.female.id;
const SOLD_OUT_ID = PRODUCT.variants.male.id;
const CAP = PRODUCT.variants.female.maxQuantity;

describe('validateCart', () => {
  it('accepts a valid cart and returns normalized lines', () => {
    const result = validateCart([{ variantId: AVAILABLE_ID, quantity: 2 }]);
    expect(result).toEqual({
      ok: true,
      lines: [{ variant: PRODUCT.variants.female, quantity: 2 }],
    });
  });

  it('rejects an unknown variantId', () => {
    const result = validateCart([{ variantId: 'nope-123', quantity: 1 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.corrections).toEqual([
        { variantId: 'nope-123', reason: 'unknown' },
      ]);
    }
  });

  it('rejects a sold-out variant (Availability Flag off)', () => {
    const result = validateCart([{ variantId: SOLD_OUT_ID, quantity: 1 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.corrections).toEqual([
        { variantId: SOLD_OUT_ID, reason: 'sold_out' },
      ]);
    }
  });

  it('clamps an over-cap quantity to the Purchase Cap', () => {
    const result = validateCart([
      { variantId: AVAILABLE_ID, quantity: CAP + 3 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.corrections).toEqual([
        {
          variantId: AVAILABLE_ID,
          reason: 'over_cap',
          maxQuantity: CAP,
        },
      ]);
    }
  });

  it('rejects quantities below 1', () => {
    const result = validateCart([{ variantId: AVAILABLE_ID, quantity: 0 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.corrections).toEqual([
        { variantId: AVAILABLE_ID, reason: 'unknown' },
      ]);
    }
  });

  it('rejects non-integer quantities', () => {
    const result = validateCart([{ variantId: AVAILABLE_ID, quantity: 1.5 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.corrections[0].reason).toBe('unknown');
    }
  });

  it('rejects more than the cart line cap', () => {
    const lines = Array.from({ length: MAX_CART_LINES + 1 }, (_, i) => ({
      variantId: `fake-${i}`,
      quantity: 1,
    }));
    const result = validateCart(lines);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const excess = result.corrections.find(
        (c) => c.reason === 'over_cap' && c.maxQuantity === 0
      );
      expect(excess).toBeDefined();
    }
  });

  it('merges duplicate lines for the same variant before validating', () => {
    const result = validateCart([
      { variantId: AVAILABLE_ID, quantity: 2 },
      { variantId: AVAILABLE_ID, quantity: 2 },
    ]);
    expect(result).toEqual({
      ok: true,
      lines: [{ variant: PRODUCT.variants.female, quantity: 4 }],
    });
  });

  it('reports every divergence when several lines are bad', () => {
    const result = validateCart([
      { variantId: 'ghost', quantity: 1 },
      { variantId: SOLD_OUT_ID, quantity: 1 },
      { variantId: AVAILABLE_ID, quantity: CAP + 1 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.corrections).toHaveLength(3);
      expect(result.corrections.map((c) => c.reason)).toEqual([
        'unknown',
        'sold_out',
        'over_cap',
      ]);
    }
  });
});
