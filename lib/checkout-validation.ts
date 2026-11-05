import { findVariant } from '@/lib/constants';
import { ProductVariant } from '@/types/product';

/**
 * Implements ADR 00-004: Commerce and Checkout - the checkout Route Handler
 * "re-validates every Cart line server-side against Product Data — prices,
 * Variants, Availability Flags, and Purchase Caps are NEVER taken from the
 * client" and "refuses checkout on any Cart/Product Data divergence,
 * surfacing a review-and-correct state to the shopper".
 *
 * Pure, side-effect-free Cart validation against in-repo Product Data so
 * both the Route Handler and unit tests exercise the same rules.
 */

/** Maximum number of Cart lines accepted per checkout attempt. */
export const MAX_CART_LINES = 20;

/**
 * A Cart line as `{variantId, quantity}` — the shape the client submits
 * to the checkout Route Handler (untrusted input) and the shape
 * persisted on-device; prices and flags are never carried in either.
 */
export interface CheckoutLineInput {
  variantId: string;
  quantity: number;
}

/** Why a submitted line diverged from Product Data. */
export type CartDriftReason = 'unknown' | 'sold_out' | 'over_cap';

/**
 * A per-line correction the shopper's Cart must apply before retrying:
 * `unknown`/`sold_out` remove the line; `over_cap` clamps the quantity to
 * `maxQuantity` (a `maxQuantity` of `0` removes the line — used when the
 * line itself is valid but sits beyond the Cart line-count cap).
 */
export interface CartCorrection {
  variantId: string;
  reason: CartDriftReason;
  maxQuantity?: number;
}

/** A Cart line normalized against Product Data, ready for Session creation. */
export interface ValidatedLine {
  variant: ProductVariant;
  quantity: number;
}

export type CartValidationResult =
  | { ok: true; lines: ValidatedLine[] }
  | { ok: false; corrections: CartCorrection[] };

/**
 * Validate submitted Cart lines against Product Data.
 *
 * Duplicate `variantId` entries are merged (quantities summed) before the
 * checks, since the Cart is keyed per Variant. Validation order per merged
 * line: unknown Variant → Availability Flag → quantity bounds → Purchase
 * Cap. Lines beyond `MAX_CART_LINES` are rejected as `over_cap` with
 * `maxQuantity: 0`.
 *
 * @param lines - Untrusted `{variantId, quantity}` pairs from the request.
 * @returns `{ok: true, lines}` with normalized lines when the whole Cart
 *   validates, or `{ok: false, corrections}` describing every divergence.
 */
export function validateCart(lines: CheckoutLineInput[]): CartValidationResult {
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(
      line.variantId,
      (merged.get(line.variantId) ?? 0) + line.quantity
    );
  }

  const normalized: ValidatedLine[] = [];
  const corrections: CartCorrection[] = [];

  let lineIndex = 0;
  for (const [variantId, quantity] of merged) {
    lineIndex += 1;
    if (lineIndex > MAX_CART_LINES) {
      corrections.push({ variantId, reason: 'over_cap', maxQuantity: 0 });
      continue;
    }

    const variant = findVariant(variantId);
    if (!variant) {
      corrections.push({ variantId, reason: 'unknown' });
      continue;
    }

    if (!variant.available) {
      corrections.push({ variantId, reason: 'sold_out' });
      continue;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      // A non-positive or non-integer quantity is unrecoverable client
      // input — treat like an unrecognized line: the shopper re-adds it.
      corrections.push({ variantId, reason: 'unknown' });
      continue;
    }

    if (quantity > variant.maxQuantity) {
      corrections.push({
        variantId,
        reason: 'over_cap',
        maxQuantity: variant.maxQuantity,
      });
      normalized.push({ variant, quantity: variant.maxQuantity });
      continue;
    }

    normalized.push({ variant, quantity });
  }

  if (corrections.length > 0) {
    return { ok: false, corrections };
  }
  return { ok: true, lines: normalized };
}
