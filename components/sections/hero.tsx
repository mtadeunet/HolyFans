'use client';

import {useState, useEffect} from 'react';
import {useCart} from '@/context/cart-context';
import {PRODUCT} from '@/lib/constants';
import PremiumFeaturesModal from '@/components/ui/premium-features-modal';

export default function Hero() {
  const t = (key: string) => key;
  const [isScrolled, setIsScrolled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-surface">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231e3a5f' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="text-center lg:text-left space-y-8 animate-fade-in">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-primary leading-tight">
                {t('title')}
              </h1>
              <p className="text-xl md:text-2xl text-accent font-medium">
                {t('subtitle')}
              </p>
            </div>

            <p className="text-lg text-text-secondary leading-relaxed max-w-lg mx-auto lg:mx-0">
              {t('description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button className="btn-primary text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-200">
                {t('cta')}
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="btn-secondary text-lg px-8 py-4"
              >
                {t('learn_more')}
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-6 text-sm text-text-secondary">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span>Premium Materials</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span>Limited Edition</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span>30-Day Guarantee</span>
              </div>
            </div>
          </div>

          {/* Product Image */}
          <div className="relative">
            <div className="relative aspect-square max-w-lg mx-auto">
              {/* Placeholder for product image */}
              <div className="absolute inset-0 bg-gradient-to-br from-surface to-border rounded-2xl shadow-2xl flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-32 h-32 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-16 h-16 text-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <p className="text-text-secondary">Product Image</p>
                  <p className="text-sm text-text-secondary/60">
                    {PRODUCT.name}
                  </p>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center animate-pulse">
                <span className="text-accent font-bold text-sm">NEW</span>
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-bold text-xs">M</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center">
        <div className="flex flex-col items-center space-y-2 text-text-secondary animate-bounce">
          <span className="text-sm">{t('scroll_indicator')}</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>

      {/* Sticky CTA (appears on scroll) */}
      {isScrolled && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-auto">
          <div className="bg-primary/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-4">
            <div className="flex items-center justify-between">
              <div className="hidden md:block">
                <p className="text-white font-semibold">{PRODUCT.name}</p>
                <p className="text-white/80 text-sm">{PRODUCT.currency} {PRODUCT.price}</p>
              </div>
              <button className="btn-primary text-sm px-6 py-2">
                {t('cta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Features Modal */}
      <PremiumFeaturesModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </section>
  );
}