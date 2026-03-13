'use client';

import { useTranslations } from '@/lib/use-translations';

export default function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="bg-primary text-white">
      <div className="container section-spacing">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <span className="text-primary font-serif text-sm font-bold">HF</span>
              </div>
              <span className="font-serif text-white text-lg">HolyFans</span>
            </div>
            <h3 className="font-script text-accent text-lg">{t('brand_story')}</h3>
            <p className="text-white/80 text-sm leading-relaxed">
              {t('brand_description')}
            </p>
            {/* Social Links */}
            <div className="flex space-x-4">
              <a
                href="#"
                className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1112.324 0 6.162 6.162 0 01-12.324 0zM12 16a4 4 0 110-8 4 4 0 010 8zm4.965-10.405a1.44 1.44 0 112.881.001 1.44 1.44 0 01-2.881-.001z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Facebook"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Pinterest"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.665 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.56-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Shop Column */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white">Shop</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm">
                  Products
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm">
                  Sizing Guide
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm">
                  Care Instructions
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm">
                  Shipping Information
                </a>
              </li>
            </ul>
          </div>

          {/* Customer Care Column */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white">Customer Care</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm">
                  Returns & Exchanges
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm">
                  Order Tracking
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white">{t('newsletter_title')}</h4>
            <p className="text-white/80 text-sm">
              {t('newsletter_description')}
            </p>
            <form className="space-y-2">
              <input
                type="email"
                placeholder={t('newsletter_placeholder')}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-accent transition-colors"
              />
              <button
                type="submit"
                className="w-full btn-secondary bg-accent hover:bg-accent/90"
              >
                {t('newsletter_button')}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/20">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-white/60 text-sm">
              {t('copyright')}
            </p>
            <div className="flex items-center space-x-6">
              <a href="#" className="text-white/60 hover:text-white transition-colors text-sm">
                {t('privacy')}
              </a>
              <a href="#" className="text-white/60 hover:text-white transition-colors text-sm">
                {t('terms')}
              </a>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-4 bg-white rounded"></div>
                <div className="w-6 h-4 bg-white rounded"></div>
                <div className="w-6 h-4 bg-white rounded"></div>
                <div className="w-6 h-4 bg-white rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
