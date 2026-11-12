import Image from 'next/image';
import { useTranslations } from 'next-intl';
import LanguageToggle from '@/components/layout/language-toggle';

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - on small viewports "a
 * minimal top band retains brand and language switching."
 *
 * The Feed Shell's small-viewport top band: brand mark (scrolling back
 * to the feed's top) plus the shared LanguageToggle Island. Renders
 * only below the `md` breakpoint where the Nav Rail is absent.
 */
export default function MobileTopBar() {
  const t = useTranslations('feed.nav');

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
      <a href="#feed" aria-label={t('logo_aria')} className="flex items-center">
        {/* `h-12` (48px) is the largest logo height inside the fixed
            `h-14` (56px) bar while keeping clearance — `h-16` would
            overflow it. */}
        <Image
          src="/logo/logo-full.png"
          alt=""
          width={806}
          height={280}
          priority
          quality={95}
          className="h-12 w-auto object-contain"
        />
      </a>
      <LanguageToggle />
    </header>
  );
}
