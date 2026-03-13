'use client';

import {useState} from 'react';
import {useCart} from '@/context/cart-context';
import {formatPrice, validateEmail, validatePhone} from '@/lib/utils';

export default function Purchase() {
  const t = (key: string) => key;
  const {items, getTotal, removeItem, updateQuantity, clearCart} = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Portugal',
    paymentMethod: 'credit_card'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = t('validation.email_required');
    } else if (!validateEmail(formData.email)) {
      newErrors.email = t('validation.email_invalid');
    }
    
    if (!formData.firstName) {
      newErrors.firstName = t('validation.first_name_required');
    }
    
    if (!formData.lastName) {
      newErrors.lastName = t('validation.last_name_required');
    }
    
    if (!formData.phone) {
      newErrors.phone = t('validation.phone_required');
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = t('validation.phone_invalid');
    }
    
    if (!formData.address) {
      newErrors.address = t('validation.address_required');
    }
    
    if (!formData.city) {
      newErrors.city = t('validation.city_required');
    }
    
    if (!formData.postalCode) {
      newErrors.postalCode = t('validation.postal_code_required');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({...prev, [field]: value}));
    if (errors[field]) {
      setErrors(prev => ({...prev, [field]: ''}));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);

    // Simulate order processing
    setTimeout(() => {
      const orderNum = `HF${Date.now().toString().slice(-6)}`;
      setOrderNumber(orderNum);
      setOrderComplete(true);
      clearCart();
      setIsProcessing(false);
    }, 3000);
  };

  if (orderComplete) {
    return (
      <section className="py-16 md:py-24 lg:py-32 bg-surface">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif text-primary">
              {t('success.title')}
            </h1>
            <div className="bg-background rounded-xl p-6 border-2 border-accent/20">
              <p className="text-lg font-semibold text-primary mb-2">
                {t('success.order_number')} {orderNumber}
              </p>
              <p className="text-text-secondary">
                {t('success.description')}
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="btn-primary"
            >
              {t('success.continue_shopping')}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="py-16 md:py-24 lg:py-32 bg-surface">
        <div className="container">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-accent" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 1a1 1 0 000 2h1a1 1 0 000-2H3zM16 1a1 1 0 000 2h1a1 1 0 000-2h-1zM6 1a1 1 0 000 2h1a1 1 0 000-2H6zM11 1a1 1 0 000 2h1a1 1 0 000-2h-1z"/>
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
          <h1 className="text-3xl md:text-4xl font-serif text-primary mb-4">
            {t('title')}
          </h1>
          <p className="text-text-secondary">
            {t('subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h2 className="text-xl font-semibold text-primary mb-6">
                {t('items.title')}
              </h2>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="flex items-start space-x-4 pb-4 border-b border-border last:border-0">
                    {/* Product Image */}
                    <div className="w-20 h-20 bg-gradient-to-br from-surface to-border rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                          <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
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
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-6 h-6 rounded border border-border bg-background hover:bg-surface transition-colors flex items-center justify-center"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="w-6 h-6 rounded border border-border bg-background hover:bg-surface transition-colors flex items-center justify-center"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-primary">
                            {item.product.currency} {formatPrice(item.product.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h2 className="text-xl font-semibold text-primary mb-6">
                {t('customer.title')}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    {t('customer.email')}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                      errors.email ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder={t('customer.email_placeholder')}
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    {t('customer.phone')}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                      errors.phone ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder={t('customer.phone_placeholder')}
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    {t('customer.first_name')}
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                      errors.firstName ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder={t('customer.first_name_placeholder')}
                  />
                  {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    {t('customer.last_name')}
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                      errors.lastName ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder={t('customer.last_name_placeholder')}
                  />
                  {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-primary mb-2">
                    {t('customer.address')}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                      errors.address ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder={t('customer.address_placeholder')}
                  />
                  {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    {t('customer.city')}
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                      errors.city ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder={t('customer.city_placeholder')}
                  />
                  {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    {t('customer.postal_code')}
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                      errors.postalCode ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder={t('customer.postal_code_placeholder')}
                  />
                  {errors.postalCode && <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-primary mb-2">
                    {t('customer.country')}
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-accent"
                  >
                    <option value="Portugal">Portugal</option>
                    <option value="Spain">Spain</option>
                    <option value="France">France</option>
                    <option value="Germany">Germany</option>
                    <option value="Italy">Italy</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary & Payment */}
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h2 className="text-xl font-semibold text-primary mb-6">
                {t('summary.title')}
              </h2>
              
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

            {/* Payment Method */}
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h2 className="text-xl font-semibold text-primary mb-6">
                {t('payment.title')}
              </h2>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-surface cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="credit_card"
                    checked={formData.paymentMethod === 'credit_card'}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    className="text-accent"
                  />
                  <div>
                    <span className="font-medium text-primary">{t('payment.credit_card')}</span>
                    <p className="text-sm text-text-secondary">{t('payment.credit_card_desc')}</p>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-surface cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="paypal"
                    checked={formData.paymentMethod === 'paypal'}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    className="text-accent"
                  />
                  <div>
                    <span className="font-medium text-primary">{t('payment.paypal')}</span>
                    <p className="text-sm text-text-secondary">{t('payment.paypal_desc')}</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full btn-primary text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{t('processing')}</span>
                </span>
              ) : (
                <span>{t('submit_button')}</span>
              )}
            </button>

            {/* Trust Indicators */}
            <div className="bg-gradient-to-r from-primary to-accent rounded-xl p-6 text-white text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span className="font-semibold">{t('trust.title')}</span>
              </div>
              <p className="text-sm text-white/90">
                {t('trust.description')}
              </p>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
