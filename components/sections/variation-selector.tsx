'use client';

import {useState} from 'react';
import {PRODUCT} from '@/lib/constants';
import {CartItem, CartContextType} from '@/types/product';

interface VariationSelectorProps {
  onAddToCart: (item: CartItem) => void;
}

export default function VariationSelector({onAddToCart}: VariationSelectorProps) {
  const t = (key: string) => key;
  const [selectedVariation, setSelectedVariation] = useState<'male' | 'female'>('male');
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async () => {
    setIsAdding(true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const cartItem: CartItem = {
      product: PRODUCT,
      variant: selectedVariation === 'male' ? PRODUCT.variants.male : PRODUCT.variants.female,
      quantity
    };
    
    onAddToCart(cartItem);
    setIsAdding(false);
  };

  const currentVariant = selectedVariation === 'male' ? PRODUCT.variants.male : PRODUCT.variants.female;

  return (
    <section className="py-16 bg-background">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif text-primary mb-4">
              Complete Your Order
            </h2>
            <p className="text-lg text-text-secondary">
              Select your preferred fit and quantity
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Product Preview */}
            <div className="space-y-6">
              <div className="relative aspect-square bg-surface rounded-2xl overflow-hidden shadow-xl">
                {/* Placeholder for product image */}
                <div className="absolute inset-0 bg-gradient-to-br from-background to-border flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-32 h-32 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-16 h-16 text-accent" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <p className="text-text-secondary">Product Preview</p>
                    <p className="text-sm text-text-secondary/60">
                      {currentVariant.name}
                    </p>
                  </div>
                </div>
                
                {/* Selected variation badge */}
                <div className="absolute top-4 left-4 bg-accent text-white px-3 py-1 rounded-full text-sm font-medium">
                  {currentVariant.name}
                </div>
              </div>

              {/* Size Information */}
              <div className="bg-surface rounded-lg p-6">
                <h3 className="font-semibold text-primary mb-3">Size Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Size:</span>
                    <span className="font-medium">{currentVariant.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Color:</span>
                    <span className="font-medium">{t('colors.white')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Fit:</span>
                    <span className="font-medium">{currentVariant.fit}</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-accent/10 rounded-lg">
                  <p className="text-sm text-text-secondary">
                    {t('fit.size_assurance')}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Options */}
            <div className="space-y-8">
              {/* Variation Selection */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-primary">Select Fit</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedVariation('male')}
                    className={`p-4 rounded-xl border-2 transition-all duration-500 ${
                      selectedVariation === 'male' 
                        ? 'border-accent bg-accent/5 shadow-lg' 
                        : 'border-transparent hover:border-accent/30 bg-background'
                    }`}
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <h4 className="font-semibold text-primary">{t('fit.male')}</h4>
                      <p className="text-xs text-text-secondary mt-1">Regular fit</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedVariation('female')}
                    className={`p-4 rounded-xl border-2 transition-all duration-500 ${
                      selectedVariation === 'female' 
                        ? 'border-accent bg-accent/5 shadow-lg' 
                        : 'border-transparent hover:border-accent/30 bg-background'
                    }`}
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <h4 className="font-semibold text-primary">{t('fit.female')}</h4>
                      <p className="text-xs text-text-secondary mt-1">Tapered fit</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-primary">Quantity</h3>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-lg border-2 border-transparent bg-background hover:bg-surface hover:border-accent/30 transition-all duration-500 flex items-center justify-center"
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
                    className="w-16 text-center border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => setQuantity(Math.min(10, quantity + 1))}
                    className="w-10 h-10 rounded-lg border-2 border-transparent bg-background hover:bg-surface hover:border-accent/30 transition-all duration-500 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-text-secondary">Maximum 10 pieces per order</p>
              </div>

              {/* Price Summary */}
              <div className="bg-surface rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold text-primary">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Product:</span>
                    <span className="font-medium">{PRODUCT.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Variant:</span>
                    <span className="font-medium">{currentVariant.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Unit Price:</span>
                    <span className="font-medium">{PRODUCT.currency} {PRODUCT.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Quantity:</span>
                    <span className="font-medium">{quantity}</span>
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="flex justify-between">
                      <span className="text-lg font-semibold text-primary">Total:</span>
                      <span className="text-lg font-semibold text-primary">
                        {PRODUCT.currency} {PRODUCT.price * quantity}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                className="w-full btn-primary text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-2 border-transparent hover:border-accent/30 transition-border duration-500"
              >
                {isAdding ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Adding to Cart...</span>
                  </span>
                ) : (
                  <span>Add to Cart - {PRODUCT.currency} {PRODUCT.price * quantity}</span>
                )}
              </button>

              {/* Trust Indicators */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <p className="text-xs text-text-secondary">Secure Payment</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <p className="text-xs text-text-secondary">30-Day Guarantee</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <p className="text-xs text-text-secondary">Fast Shipping</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
