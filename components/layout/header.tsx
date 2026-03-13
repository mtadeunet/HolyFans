'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import LanguageToggle from './language-toggle';

export default function Header() {
  const t = (key: string) => key;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

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
        <nav className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <button
            onClick={() => handleNavClick('/')}
            className="flex items-center space-x-2"
          >
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
              <span className="text-white font-serif text-sm font-bold">HF</span>
            </div>
            <span className="font-serif text-primary text-lg md:text-xl">HolyFans</span>
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
              onClick={() => handleNavClick('#social')}
              className="text-text-secondary hover:text-primary transition-colors"
            >
              {t('contact')}
            </button>
            <button 
              onClick={() => handleNavClick('#purchase')}
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
            <div className="container py-4 space-y-4">
              <button 
                onClick={() => handleNavClick('#products')}
                className="block w-full text-left text-text-secondary hover:text-primary transition-colors"
              >
                {t('about')}
              </button>
              <button 
                onClick={() => handleNavClick('#faq')}
                className="block w-full text-left text-text-secondary hover:text-primary transition-colors"
              >
                {t('faq')}
              </button>
              <button 
                onClick={() => handleNavClick('#social')}
                className="block w-full text-left text-text-secondary hover:text-primary transition-colors"
              >
                {t('contact')}
              </button>
              <button 
                onClick={() => handleNavClick('#cart')}
                className="block w-full text-left text-text-secondary hover:text-primary transition-colors"
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
