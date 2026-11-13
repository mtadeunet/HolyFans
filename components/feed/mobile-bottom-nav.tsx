import { useTranslations } from 'next-intl';
import { buildFeedNavEntries, FeedNavLink } from './nav-entries';

interface MobileBottomNavProps {
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0) — the cart entry renders only while
   * `PURCHASE_SURFACE_ENABLED` is `'true'`.
   */
  purchaseSurfaceEnabled: boolean;
  /**
   * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
   * Shell with Simplified Purchase Surface - "on the Product Page
   * routes, entries that target landing feed units return the shopper
   * to that unit on the landing within the same Locale." The band's cart entry
   * resolves to `/checkout` — a self-link marking the current location.
   */
  returnToFeed?: boolean;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - on small viewports the
 * shell is "the Feed Surface with a compact bottom navigation band —
 * carrying navigation and the purchase affordance"; "Small-viewport
 * bottom chrome is a single consolidated band" that the Inbound
 * Contact Surface floats above without occluding it.
 *
 * The consolidated mobile bottom navigation band, governed by the
 * retained `mobileStickyCta` Site Config chrome key (its role absorbs
 * the former MobileStickyCta). The purchase entry is the visually
 * prominent item; safe-area padding keeps it clear of home indicators.
 * Entry construction, gating, and rendering are shared with the Nav
 * Rail through `nav-entries.tsx`.
 */
export default function MobileBottomNav({
  purchaseSurfaceEnabled,
  returnToFeed = false,
}: MobileBottomNavProps) {
  const t = useTranslations('feed.nav');
  const tWhatsApp = useTranslations('whatsapp');
  const entries = buildFeedNavEntries(
    tWhatsApp('prefilled_message'),
    purchaseSurfaceEnabled,
    returnToFeed
  );

  return (
    <nav
      aria-label={t('nav_aria')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
    >
      <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {entries.map((entry) => (
          <FeedNavLink
            key={entry.key}
            entry={entry}
            label={t(entry.key)}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
              entry.prominent
                ? 'text-primary'
                : 'text-text-secondary hover:text-primary'
            }`}
          >
            {entry.icon}
            <span>{t(entry.key)}</span>
          </FeedNavLink>
        ))}
      </div>
    </nav>
  );
}
