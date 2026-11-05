import Stripe from 'stripe';

/**
 * Implements ADR 00-004: Commerce and Checkout - "PSP: Stripe."
 *
 * Implements ADR 00-002: Rendering and Hosting Model - the checkout Route
 * Handler "must be hardened (input caps, rate limiting, graceful failure)".
 *
 * Returns a request-scoped `Stripe` client bound to `STRIPE_SECRET_KEY`
 * (the StripeClient pattern — the key is passed per instance, never set as
 * a global `api_key`). The secret lives only in Hosting Platform env vars
 * and untracked local env files; it is never exposed to the client bundle.
 *
 * Graceful failure posture: when the key is unset (local dev, previews
 * without Stripe configured) this returns `null` instead of throwing, so
 * callers can degrade to the "checkout unavailable" state rather than
 * crash.
 *
 * @returns A configured `Stripe` client, or `null` when
 *   `STRIPE_SECRET_KEY` is unset/empty.
 */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim().length === 0) {
    return null;
  }
  return new Stripe(key);
}
