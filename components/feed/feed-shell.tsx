import type { ReactNode } from 'react';
import type { SiteConfig } from '@/lib/site-config';
import MobileBottomNav from './mobile-bottom-nav';
import MobileTopBar from './mobile-top-bar';
import NavRail from './nav-rail';
import SuggestionsRail from './suggestions-rail';

interface FeedShellProps {
  /**
   * Site Config chrome toggles: the retained `mobileStickyCta` key
   * governs the mobile bottom navigation band and its page-bottom
   * clearance. (`premiumFeaturesModal` is consumed inside `FeedPosts`,
   * not by the shell.)
   */
  chrome: SiteConfig['chrome'];
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0)
   *
   * Server-evaluated fail-closed gate threaded to every purchase link
   * in the shell: while unset, media slots render unlinked and the cart
   * entries/CTAs are absent, preserving the zero-`/checkout`-anchors
   * contract.
   */
  purchaseSurfaceEnabled: boolean;
  /**
   * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
   * Shell with Simplified Purchase Surface - "on the Product Page
   * routes, entries that target landing feed units return the shopper
   * to that unit on the landing within the same Locale."
   *
   * `true` on the Product Page routes: in-feed anchor entries (home/
   * shop/faq) render as `/{locale}#<anchor>` Links back to the landing
   * instead of same-page anchors. `false` on the landing itself.
   */
  returnToFeed?: boolean;
  /**
   * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
   * Shell with Simplified Purchase Surface - "On a Product Page route
   * the Feed Surface carries a single occupant — the Simplified
   * Purchase Surface, presented as a plain centered panel inside the
   * column, not as a Post Card."
   *
   * The center column's content: the Post Card scroll on the landing
   * roots, the purchase panel on the Product Page routes. The column's
   * measure and rhythm are shared across both routes.
   */
  children: ReactNode;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "The Locale landing roots
 * and the purchase route are composed as a Feed Shell — a three-column
 * layout consisting of a Nav Rail (left), a Feed Surface (center), and
 * a Suggestions Rail (right)."
 *
 * The shell's entire chrome on the routes it composes: Nav Rail (icon
 * strip at `md`, full rail at `lg`), the center Feed Surface column
 * (~600px, primary at every width) holding `children`, and the
 * Suggestions Rail (desktop-only). Small viewports get the minimal top
 * band and the consolidated bottom navigation band instead — identical
 * on every route the shell composes. No composer, no search.
 */
export default function FeedShell({
  chrome,
  purchaseSurfaceEnabled,
  returnToFeed = false,
  children,
}: FeedShellProps) {
  return (
    <div
      className={`min-h-screen bg-surface ${
        /* Clearance for the fixed bottom band — only needed when the
           `mobileStickyCta` chrome toggle mounts it. */
        chrome.mobileStickyCta ? 'pb-20 md:pb-0' : ''
      }`}
    >
      <MobileTopBar />

      <div className="mx-auto flex justify-center">
        <NavRail
          purchaseSurfaceEnabled={purchaseSurfaceEnabled}
          returnToFeed={returnToFeed}
        />

        {/* Feed Surface — the primary column at every width; holds the
            route's single occupant. */}
        <div
          id="feed"
          className="w-full max-w-xl border-border bg-background md:border-x"
        >
          {children}
        </div>

        <SuggestionsRail purchaseSurfaceEnabled={purchaseSurfaceEnabled} />
      </div>

      {/* Consolidated mobile bottom band — governed by the repurposed
          `mobileStickyCta` chrome key. */}
      {chrome.mobileStickyCta && (
        <MobileBottomNav
          purchaseSurfaceEnabled={purchaseSurfaceEnabled}
          returnToFeed={returnToFeed}
        />
      )}
    </div>
  );
}
