import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import LanguageToggle from '@/components/layout/language-toggle';
import { buildFeedNavEntries, FeedNavLink } from './nav-entries';

interface NavRailProps {
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0)
   *
   * `true` only when the server evaluated the fail-closed
   * `PURCHASE_SURFACE_ENABLED` flag: the cart entry and the rail's
   * purchase call-to-action render only while it is `'true'`.
   */
  purchaseSurfaceEnabled: boolean;
  /**
   * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
   * Shell with Simplified Purchase Surface - "on the Product Page
   * routes, entries that target landing feed units return the shopper
   * to that unit on the landing within the same Locale."
   */
  returnToFeed?: boolean;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "A fixed column holding the
 * brand mark, a store-adapted list of icon-and-label navigation entries,
 * language switching, and a prominent purchase call-to-action at its
 * foot."
 *
 * The Feed Shell's left column: a full icon-and-label rail at `lg`,
 * collapsing to an icon strip at `md` and dropping below `md` (the
 * mobile top band and bottom navigation take over). Entry construction,
 * gating, and rendering are shared with the mobile bottom band through
 * `nav-entries.tsx` so the two cannot drift apart.
 */
export default function NavRail({
  purchaseSurfaceEnabled,
  returnToFeed = false,
}: NavRailProps) {
  const t = useTranslations('feed.nav');
  const tWhatsApp = useTranslations('whatsapp');
  const entries = buildFeedNavEntries(
    tWhatsApp('prefilled_message'),
    purchaseSurfaceEnabled,
    returnToFeed
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-16 flex-shrink-0 flex-col border-r border-border bg-background px-2 py-6 md:flex lg:w-64 lg:px-4">
      <a
        href="#feed"
        aria-label={t('logo_aria')}
        className="mb-8 flex items-center justify-center lg:justify-start"
      >
        {/* Responsive logo pattern (same as the classic header): the
            mark on the `md` icon strip — the full logo is illegible at
            strip width — the full logo on the `lg` rail. Sizing caps:
            the strip's 56px content width makes `h-12` the largest
            mark that fits; `h-18` (~207px wide) is the largest full
            logo inside the rail's 224px content width. */}
        <Image
          src="/logo/logo-mark.png"
          alt=""
          width={40}
          height={40}
          priority
          quality={95}
          className="h-12 w-12 object-contain lg:hidden"
        />
        <Image
          src="/logo/logo-full.png"
          alt=""
          width={806}
          height={280}
          priority
          quality={95}
          className="hidden h-18 w-auto object-contain lg:block"
        />
      </a>

      <nav className="flex flex-1 flex-col gap-1">
        {entries.map((entry) => (
          <FeedNavLink
            key={entry.key}
            entry={entry}
            label={t(entry.key)}
            className="flex items-center justify-center gap-4 rounded-lg px-3 py-3 text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary lg:justify-start"
          >
            {entry.icon}
            <span className="hidden lg:inline">{t(entry.key)}</span>
          </FeedNavLink>
        ))}
      </nav>

      <div className="mb-4 flex justify-center lg:justify-start">
        <LanguageToggle />
      </div>

      {/* Purchase CTA at the rail's foot — the shell's canonical path to
          the Simplified Purchase Surface; suppressed entirely while the
          purchase-surface gate is closed (ADR 00-004 / plan M0). */}
      {purchaseSurfaceEnabled && (
        <Link
          href="/checkout"
          aria-label={t('cta')}
          className="btn-primary flex items-center justify-center gap-2 px-4 py-3 text-base"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          <span className="hidden lg:inline">{t('cta')}</span>
        </Link>
      )}
    </aside>
  );
}
