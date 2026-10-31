import { notFound } from 'next/navigation';
import Purchase from '@/components/sections/purchase';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "Site Config is read
 * from Edge Config at request time."
 *
 * The page renders at request time so the purchase-surface gate is evaluated
 * per request: setting `PURCHASE_SURFACE_ENABLED` in a non-production
 * environment and restarting the server restores the surface without a
 * rebuild (the verification path required by plan M0).
 */
export const dynamic = 'force-dynamic';

/**
 * Locale-prefixed checkout page.
 *
 * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated to
 * the PSP's Hosted Checkout."
 *
 * While the checkout submit is still simulated (until M3), the surface is
 * gated: when `PURCHASE_SURFACE_ENABLED` is not `'true'` the page renders
 * the not-found response instead of the simulated purchase form, so no
 * fabricated `HF######` order confirmation can reach a real customer.
 *
 * @returns The `Purchase` section when the gate is open; otherwise a 404
 *   not-found response via `notFound()`.
 */
export default function CheckoutPage() {
  if (!isPurchaseSurfaceEnabled()) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <Purchase />
    </main>
  );
}
