'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/**
 * Sticky bottom Add-to-Cart bar for mobile.
 *
 * - Visible only below the `md` breakpoint.
 * - Auto-hides while the `#products` section is in the viewport (the user is
 *   already on the canonical buy block, so a duplicate CTA would be noise).
 * - Renders nothing if `#products` does not exist on the current page (e.g.
 *   `/checkout`), so it is safe to mount globally.
 *
 * The button scrolls to `#products` rather than dispatching its own Add-to-Cart
 * action — keeping a single canonical conversion surface in `ProductGallery`.
 */
export default function MobileStickyCta() {
  const t = useTranslations('product');
  const [productsExists, setProductsExists] = useState(false);
  const [productsInView, setProductsInView] = useState(false);
  const [scrolledPastTop, setScrolledPastTop] = useState(false);

  useEffect(() => {
    const target = document.querySelector('#products');
    if (!target) {
      setProductsExists(false);
      return;
    }
    setProductsExists(true);

    const observer = new IntersectionObserver(
      ([entry]) => setProductsInView(entry.intersectionRatio > 0.05),
      { threshold: [0, 0.05, 0.5, 1] }
    );
    observer.observe(target);

    const onScroll = () => setScrolledPastTop(window.scrollY > 200);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  if (!productsExists) return null;

  const hidden = productsInView || !scrolledPastTop;

  const handleClick = () => {
    document
      .querySelector('#products')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur transition-transform duration-300 ease-out ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
      aria-hidden={hidden}
    >
      <div className="container py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          onClick={handleClick}
          className="w-full bg-accent text-white font-semibold rounded-lg px-6 py-3 min-h-12 shadow-lg active:scale-[0.99] transition-transform"
        >
          {t('add_to_cart')}
        </button>
      </div>
    </div>
  );
}
