'use client';

import { useTranslations } from 'next-intl';

export default function FinalCTA() {
  const t = useTranslations('final_cta');

  const handleScrollToProducts = () => {
    const el = document.querySelector('#products');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="py-12 md:py-20 bg-gradient-to-br from-primary to-accent text-white">
      <div className="container">
        <div className="flex flex-col items-center text-center gap-6 max-w-2xl mx-auto">
          {/* Urgency Badge */}
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold">{t('urgency.badge')}</span>
          </div>

          {/* Main Title */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif">
            {t('title')}
          </h2>
          <p className="text-lg md:text-xl text-white/90 leading-relaxed">
            {t('subtitle')}
          </p>

          {/* Single CTA */}
          <button
            onClick={handleScrollToProducts}
            className="w-full sm:w-auto bg-white text-primary hover:bg-white/90 text-base md:text-lg font-semibold px-8 py-4 min-h-12 rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            {t('cta.button')}
          </button>
        </div>
      </div>
    </section>
  );
}
