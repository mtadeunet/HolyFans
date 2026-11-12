'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import { whatsappChatUrl } from '@/lib/whatsapp';
import { useEffect, useState } from 'react';
import LanguageToggle from './language-toggle';

interface HeaderProps {
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated to
   * the PSP's Hosted Checkout."
   *
   * Interim purchase-surface gate (plan M0): until the M4 launch enables
   * the surface, `false` suppresses every navigation CTA that links to the
   * checkout page. Passed from the server layout, which evaluates the
   * fail-closed `PURCHASE_SURFACE_ENABLED` flag per request.
   */
  purchaseSurfaceEnabled: boolean;
}

/**
 * Classic site header — non-landing chrome only.
 *
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "Non-landing routes (the
 * checkout pages, auxiliary and legal pages) keep the classic
 * header/footer chrome"; `ChromeFrame` suppresses this header on the
 * Locale landing roots.
 *
 * Since the header now only renders off the landing, its entries are
 * locale-aware Links pointing back at the landing's Feed Shell anchors
 * (`#products`, `#post-faq`) rather than scroll targets on the current
 * page. The Contact entry opens the Inbound Contact Surface's
 * click-to-chat deep link (ADR 00-009) and fails closed — it is omitted
 * when no Store Messaging Number is configured. All links go through
 * `lib/navigation.ts` so the Locale prefix is preserved (ADR 00-005).
 */
export default function Header({ purchaseSurfaceEnabled }: HeaderProps) {
  const t = useTranslations('navigation');
  const tWhatsApp = useTranslations('whatsapp');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Inbound Contact Surface deep link (ADR 00-009): `null` when the
  // Store Messaging Number is unconfigured — the entry fails closed.
  const contactUrl = whatsappChatUrl(
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '',
    tWhatsApp('prefilled_message')
  );

  const navLinkClass =
    'text-text-secondary hover:text-primary transition-colors';
  const mobileNavLinkClass =
    'block w-full text-left text-text-secondary hover:text-primary transition-colors py-3 min-h-12 text-base border-b border-border/40';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container">
        <nav className="relative flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link
            href="/"
            onClick={() => setIsMenuOpen(false)}
            className={`flex items-center md:relative md:overflow-visible md:transition-transform md:duration-300 md:ease-out ${
              scrolled
                ? 'md:self-center md:translate-y-0'
                : 'md:self-end md:translate-y-1/2'
            }`}
            aria-label={t('logo_aria')}
          >
            <Image
              src="/logo/logo-mark.png"
              alt="HolyFans"
              width={3072}
              height={3072}
              priority
              quality={95}
              className="md:hidden h-10 w-auto"
            />
            <Image
              src="/logo/logo-full.png"
              alt="HolyFans"
              width={806}
              height={280}
              priority
              quality={95}
              className={`hidden md:block w-auto transition-all duration-300 ease-out ${
                scrolled ? 'md:h-10' : 'md:h-40'
              }`}
            />
          </Link>

          {/* Desktop Navigation — Links back into the landing's feed
              anchors; targets are landing-only since this header never
              renders there. */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/#products" className={navLinkClass}>
              {t('about')}
            </Link>
            <Link href="/#post-faq" className={navLinkClass}>
              {t('faq')}
            </Link>
            {contactUrl && (
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={navLinkClass}
              >
                {t('contact')}
              </a>
            )}
            {/* Purchase-surface gate (ADR 00-004 / plan M0): the cart nav
                CTA to /checkout only exists while
                PURCHASE_SURFACE_ENABLED is 'true'. */}
            {purchaseSurfaceEnabled && (
              <Link
                href="/checkout"
                data-testid="nav-cart"
                className={navLinkClass}
              >
                {t('cart')}
              </Link>
            )}
            <LanguageToggle />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-4">
            <LanguageToggle />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-text-secondary hover:text-primary"
              aria-label={t('toggle_menu')}
            >
              <div className="space-y-1">
                <div
                  className={`w-6 h-0.5 bg-current transition-all ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}
                ></div>
                <div
                  className={`w-6 h-0.5 bg-current transition-all ${isMenuOpen ? 'opacity-0' : ''}`}
                ></div>
                <div
                  className={`w-6 h-0.5 bg-current transition-all ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}
                ></div>
              </div>
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border">
            <div className="container py-2">
              <Link
                href="/#products"
                onClick={() => setIsMenuOpen(false)}
                className={mobileNavLinkClass}
              >
                {t('about')}
              </Link>
              <Link
                href="/#post-faq"
                onClick={() => setIsMenuOpen(false)}
                className={mobileNavLinkClass}
              >
                {t('faq')}
              </Link>
              {contactUrl && (
                <a
                  href={contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className={mobileNavLinkClass}
                >
                  {t('contact')}
                </a>
              )}
              {/* Purchase-surface gate (ADR 00-004 / plan M0): same
                  suppression as the desktop nav above. */}
              {purchaseSurfaceEnabled && (
                <Link
                  href="/checkout"
                  data-testid="nav-cart"
                  onClick={() => setIsMenuOpen(false)}
                  className={`${mobileNavLinkClass} border-b-0`}
                >
                  {t('cart')}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
