'use client';

import {useState} from 'react';
import {useCart} from '@/context/cart-context';
import {PRODUCT} from '@/lib/constants';
import PremiumFeaturesModal from '@/components/ui/premium-features-modal';

export default function FinalCTA() {
  const t = (key: string) => key;
  const {addItem} = useCart();
  const [selectedVariation, setSelectedVariation] = useState<'male' | 'female'>('male');
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddToCart = async () => {
    setIsAdding(true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const cartItem = {
      product: PRODUCT,
      variant: selectedVariation === 'male' 
        ? PRODUCT.variants.male
        : PRODUCT.variants.female,
      quantity
    };
    
    addItem(cartItem.product, cartItem.variant);
    setIsAdding(false);
  };

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-br from-primary to-accent text-white">
      <div className="container">
        <div className="text-center space-y-8">
          {/* Urgency Badge */}
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span className="text-sm font-semibold">{t('urgency.badge')}</span>
          </div>

          {/* Main Title */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif mb-6">
            {t('title')}
          </h2>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 mb-12">
            <div className="text-center">
              <div className="text-3xl font-bold">{t('stats.limited_edition')}</div>
              <p className="text-white/80 text-sm">{t('stats.pieces_available')}</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{t('stats.handcrafted')}</div>
              <p className="text-white/80 text-sm">{t('stats.premium_quality')}</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{t('stats.exclusive')}</div>
              <p className="text-white/80 text-sm">{t('stats.unique_design')}</p>
            </div>
          </div>

          {/* Product Preview */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-4xl mx-auto border-2 border-white/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="text-left space-y-4">
                <h3 className="text-2xl font-serif text-white">HolyFans</h3>
                <p className="text-white/90">{t('product.name')}</p>
                <p className="text-white/80 text-sm">{t('product.description')}</p>
                
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">M</span>
                  </div>
                  <div className="text-white/90">
                    <span className="font-medium">{t('product.size')}</span>
                    <span className="text-sm">{t('product.fit')}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">€</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {t('product.price')}
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <div className="aspect-square bg-gradient-to-br from-white/20 to-white/10 rounded-xl flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <p className="text-white">{t('product.preview')}</p>
                    <p className="text-white/80 text-sm">{selectedVariation === 'male' ? 'Masculino' : 'Feminino'}</p>
                  </div>
                </div>
                
                {/* Floating badges */}
                <div className="absolute -top-2 -right-2 w-16 h-16 bg-accent rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-white font-bold text-sm">{t('urgency.limited')}</span>
                </div>
                <div className="absolute -bottom-2 -left-2 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xs">NEW</span>
                </div>
              </div>
            </div>
          </div>

          {/* Variation Selector */}
          <div className="flex justify-center space-x-4 mb-8">
            <button
              onClick={() => setSelectedVariation('male')}
              className={`px-6 py-3 rounded-xl border-2 transition-all duration-500 ${
                selectedVariation === 'male'
                  ? 'border-white bg-white/20 shadow-lg'
                  : 'border-white/40 hover:border-white/60 bg-white/10'
              }`}
            >
              <span className="font-medium">{t('fit.male')}</span>
            </button>
            <button
              onClick={() => setSelectedVariation('female')}
              className={`px-6 py-3 rounded-xl border-2 transition-all duration-500 ${
                selectedVariation === 'female'
                  ? 'border-white bg-white/20 shadow-lg'
                  : 'border-white/40 hover:border-white/60 bg-white/10'
              }`}
            >
              <span className="font-medium">{t('fit.female')}</span>
            </button>
          </div>

          {/* Quantity Selector */}
          <div className="flex justify-center items-center space-x-4 mb-8">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-lg border-2 border-white/40 bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="number"
              min="1"
              max="10"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="w-16 text-center border-2 border-white/40 bg-white/10 rounded-lg px-3 py-2 text-white placeholder-white/60"
            />
            <button
              onClick={() => setQuantity(Math.min(10, quantity + 1))}
              className="w-10 h-10 rounded-lg border-2 border-white/40 bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Main CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="btn-secondary bg-white text-primary hover:bg-white/90 text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-transparent hover:border-white"
            >
              {isAdding ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{t('cta.adding')}</span>
                </span>
              ) : (
                <span>{t('cta.button')} - €{89 * quantity}</span>
              )}
            </button>
            
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-primary transition-all duration-500"
            >
              {t('cta.learn_more')}
            </button>
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="flex flex-wrap justify-center gap-8 text-sm text-white/80">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <span>{t('trust.free_shipping')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <span>{t('trust.money_back')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <span>{t('trust.quality')}</span>
        </div>
      </div>

      {/* Premium Features Modal */}
      <PremiumFeaturesModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </section>
  );
}
