import { notFound } from 'next/navigation';
import FeedShell from '@/components/feed/feed-shell';
import BuyNow from '@/components/sections/buy-now';
import TestModeBanner from '@/components/ui/test-mode-banner';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import { getSiteConfig } from '@/lib/site-config-server';

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
 * Locale-prefixed checkout page — the Simplified Purchase Surface inside
 * the Feed Shell.
 *
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "On the purchase route the
 * Feed Surface carries a single occupant — the Simplified Purchase
 * Surface, presented as a plain centered panel inside the column, not
 * as a Post Card." Nav Rail section entries get `returnToFeed` so they
 * resolve back to the landing's feed units within the same Locale.
 *
 * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated to
 * the PSP's Hosted Checkout." The surface stays gated until the M4
 * launch: when `PURCHASE_SURFACE_ENABLED` is not `'true'` the page
 * renders the not-found response.
 *
 * @returns The shell-wrapped `BuyNow` purchase surface when the gate is
 *   open; otherwise a 404 not-found response via `notFound()`.
 */
export default async function CheckoutPage() {
  if (!isPurchaseSurfaceEnabled()) {
    notFound();
  }

  const { chrome } = await getSiteConfig();

  return (
    <FeedShell chrome={chrome} purchaseSurfaceEnabled returnToFeed>
      <TestModeBanner />
      <BuyNow />
    </FeedShell>
  );
}
