/**
 * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated to the
 * PSP's Hosted Checkout."
 *
 * Interim purchase-surface gate (plan M0 temporary test control): the real
 * Hosted Checkout handoff landed in M3, but production stays gated until
 * the M4 launch enables the surface. This flag hides the checkout page and
 * the post-checkout success/cancel pages until then.
 *
 * The gate is deliberately a code-level environment flag and NOT a Site
 * Config (Edge Config) toggle: `getSiteConfig()` fails open to defaults, so
 * an Edge Config outage would silently re-expose the simulated surface. This
 * gate must fail CLOSED — only the literal value `'true'` enables the
 * surface; unset, empty, or any other value keeps it hidden.
 *
 * The flag name is `PURCHASE_SURFACE_ENABLED` (documented in `.env.example`,
 * carried with no real values). It is read server-side only, never exposed
 * to the client bundle.
 *
 * @returns `true` only when `PURCHASE_SURFACE_ENABLED === 'true'`; `false`
 *   for unset or any other value (fail-closed).
 */
export function isPurchaseSurfaceEnabled(): boolean {
  return process.env.PURCHASE_SURFACE_ENABLED === 'true';
}
