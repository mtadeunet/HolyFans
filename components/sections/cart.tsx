'use client';

import { useCart } from '@/context/cart-context';
import { useTranslations } from '@/lib/use-translations';
import { formatPrice } from '@/lib/utils';
import { useState } from 'react';

export default function Cart() {
  const t = useTranslations('cart');
  const { items, getTotal, removeItem, updateQuantity, clearCart } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckout = () => {
    setIsCheckingOut(true);
    // Navigate to checkout page
    window.location.href = '/checkout';
  };

  if (items.length === 0) {
    return (
      <section className="py-16 md:py-24 lg:py-32 bg-surface">
        <div className="container">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-accent" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 1a1 1 0 000 2h1a1 1 0 000-2H3zM16 1a1 1 0 000 2h1a1 1 0 000-2h-1zM6 1a1 1 0 000 2h1a1 1 0 000-2H6zM11 1a1 1 0 000 2h1a1 1 0 000-2h-1z" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif text-primary">
              {t('empty.title')}
            </h2>
            <p className="text-text-secondary max-w-md mx-auto">
              {t('empty.description')}
            </p>
            <button
              onClick={() => window.location.href = '#products'}
              className="btn-primary"
            >
              {t('empty.continue_shopping')}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-surface">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-primary mb-4">
            {t('title')}
          </h2>
          <p className="text-text-secondary">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item, index) => (
              <div key={index} className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
                <div className="flex items-start space-x-4">
                  {/* Product Image */}
                  <div className="w-24 h-24 bg-gradient-to-br from-surface to-border rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-xs text-text-secondary">Product</p>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-primary">{item.product.name}</h3>
                        <p className="text-sm text-text-secondary">
                          {item.variant.name} - {item.variant.size}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="text-text-secondary hover:text-red-500 transition-colors"
                        aria-label="Remove item"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg border-2 border-border bg-background hover:bg-surface transition-colors flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg border-2 border-border bg-background hover:bg-surface transition-colors flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          {item.product.currency} {formatPrice(item.product.price * item.quantity)}
                        </p>
                        <p className="text-sm text-text-secondary">
                          {item.product.currency} {formatPrice(item.product.price)} each
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h3 className="text-xl font-semibold text-primary mb-6">
                {t('summary.title')}
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('summary.subtotal')}</span>
                  <span className="font-medium">{items[0]?.product.currency || 'EUR'} {formatPrice(getTotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('summary.shipping')}</span>
                  <span className="font-medium">{t('summary.free')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('summary.tax')}</span>
                  <span className="font-medium">{items[0]?.product.currency || 'EUR'} {formatPrice(0)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-semibold text-primary">{t('summary.total')}</span>
                  <span className="text-xl font-bold text-primary">
                    {items[0]?.product.currency || 'EUR'} {formatPrice(getTotal())}
                  </span>
                </div>
              </div>
            </div>

            {/* Promo Code */}
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h3 className="font-semibold text-primary mb-4">
                {t('promo.title')}
              </h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder={t('promo.placeholder')}
                  className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-accent"
                />
                <button className="btn-secondary">
                  {t('promo.apply')}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full btn-primary text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingOut ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('checkout.processing')}</span>
                  </span>
                ) : (
                  <span>{t('checkout.button')}</span>
                )}
              </button>

              <button
                onClick={() => window.location.href = '#products'}
                className="w-full btn-secondary"
              >
                {t('continue_shopping')}
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="bg-gradient-to-r from-primary to-accent rounded-xl p-6 text-white text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">{t('trust.title')}</span>
              </div>
              <p className="text-sm text-white/90">
                {t('trust.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
