'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LanguageToggle from './language-toggle';

export default function Header() {
  const t = useTranslations('navigation');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (href: string) => {
    if (href.startsWith('#')) {
      // Smooth scroll to section
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      router.push(href);
    }
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container">
        <nav className="relative flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <button
            onClick={() => handleNavClick('/')}
            className={`flex items-center md:relative md:overflow-visible md:transition-transform md:duration-300 md:ease-out ${
              scrolled ? 'md:self-center md:translate-y-0' : 'md:self-end md:translate-y-1/2'
            }`}
            aria-label="HolyFans home"
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
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => handleNavClick('#products')}
              className="text-text-secondary hover:text-primary transition-colors"
            >
              {t('about')}
            </button>
            <button
              onClick={() => handleNavClick('#faq')}
              className="text-text-secondary hover:text-primary transition-colors"
            >
              {t('faq')}
            </button>
            <button
              onClick={() => handleNavClick('#social-proof')}
              className="text-text-secondary hover:text-primary transition-colors"
            >
              {t('contact')}
            </button>
            <button
              onClick={() => handleNavClick('/checkout')}
              className="text-text-secondary hover:text-primary transition-colors"
            >
              {t('cart')}
            </button>
            <LanguageToggle />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-4">
            <LanguageToggle />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-text-secondary hover:text-primary"
              aria-label="Toggle menu"
            >
              <div className="space-y-1">
                <div className={`w-6 h-0.5 bg-current transition-all ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></div>
                <div className={`w-6 h-0.5 bg-current transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></div>
                <div className={`w-6 h-0.5 bg-current transition-all ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
              </div>
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border">
            <div className="container py-2">
              <button
                onClick={() => handleNavClick('#products')}
                className="block w-full text-left text-text-secondary hover:text-primary transition-colors py-3 min-h-12 text-base border-b border-border/40"
              >
                {t('about')}
              </button>
              <button
                onClick={() => handleNavClick('#faq')}
                className="block w-full text-left text-text-secondary hover:text-primary transition-colors py-3 min-h-12 text-base border-b border-border/40"
              >
                {t('faq')}
              </button>
              <button
                onClick={() => handleNavClick('#social-proof')}
                className="block w-full text-left text-text-secondary hover:text-primary transition-colors py-3 min-h-12 text-base border-b border-border/40"
              >
                {t('contact')}
              </button>
              <button
                onClick={() => handleNavClick('/checkout')}
                className="block w-full text-left text-text-secondary hover:text-primary transition-colors py-3 min-h-12 text-base"
              >
                {t('cart')}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
