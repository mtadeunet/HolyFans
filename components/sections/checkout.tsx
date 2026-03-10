'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useCart} from '@/context/cart-context';
import {formatPrice, generateOrderNumber, validateEmail, validatePhone} from '@/lib/utils';

export default function Checkout() {
  const t = useTranslations('checkout');
  const {items, getTotal, clearCart} = useCart();
  const [currentStep, setCurrentStep] = useState(1);
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
    paymentMethod: 'credit_card',
    saveInfo: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};
    
    if (step === 1) {
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
    }
    
    if (step === 2) {
      if (!formData.address) {
        newErrors.address = t('validation.address_required');
      }
      
      if (!formData.city) {
        newErrors.city = t('validation.city_required');
      }
      
      if (!formData.postalCode) {
        newErrors.postalCode = t('validation.postal_code_required');
      }
      
      if (!formData.country) {
        newErrors.country = t('validation.country_required');
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    
    // Simulate order processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const orderNum = generateOrderNumber();
    setOrderNumber(orderNum);
    setOrderComplete(true);
    clearCart();
    setIsProcessing(false);
  };

  if (items.length === 0) {
    return (
      <section className="py-16 md:py-24 lg:py-32 bg-surface">
        <div className="container">
          <div className="text-center space-y-6">
            <h2 className="text-2xl md:text-3xl font-serif text-primary">
              {t('empty.title')}
            </h2>
            <p className="text-text-secondary">
              {t('empty.description')}
            </p>
            <button 
              onClick={() => window.location.href = '/cart'}
              className="btn-primary"
            >
              {t('empty.return_to_cart')}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (orderComplete) {
    return (
      <section className="py-16 md:py-24 lg:py-32 bg-surface">
        <div className="container">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif text-primary">
              {t('success.title')}
            </h2>
            <p className="text-lg text-text-secondary mb-2">
              {t('success.order_number')} <span className="font-mono font-bold">{orderNumber}</span>
            </p>
            <p className="text-text-secondary max-w-md mx-auto">
              {t('success.description')}
            </p>
            <div className="bg-background rounded-xl p-6 max-w-md mx-auto border-2 border-accent/20">
              <h3 className="font-semibold text-primary mb-4">{t('success.next_steps')}</h3>
              <ul className="text-left space-y-2 text-sm text-text-secondary">
                <li>• {t('success.step1')}</li>
                <li>• {t('success.step2')}</li>
                <li>• {t('success.step3')}</li>
              </ul>
            </div>
            <button 
              onClick={() => window.location.href = '/'}
              className="btn-primary mt-6"
            >
              {t('success.continue_shopping')}
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

        {/* Progress Steps */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center space-x-4">
            {[
              { number: 1, title: t('steps.contact') },
              { number: 2, title: t('steps.shipping') },
              { number: 3, title: t('steps.payment') },
              { number: 4, title: t('steps.review') }
            ].map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep >= step.number 
                    ? 'bg-accent text-white' 
                    : 'bg-border text-text-secondary'
                }`}>
                  {step.number}
                </div>
                <span className={`ml-3 text-sm font-medium ${
                  currentStep >= step.number ? 'text-primary' : 'text-text-secondary'
                }`}>
                  {step.title}
                </span>
                {index < 3 && (
                  <div className={`ml-6 w-12 h-0.5 ${
                    currentStep > step.number ? 'bg-accent' : 'bg-border'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h3 className="text-xl font-semibold text-primary mb-6">
                {t('summary.title')}
              </h3>
              
              <div className="space-y-4 mb-6">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between pb-4 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-text-secondary">
                        {item.variant.name} - {item.variant.size} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium">
                      {item.product.currency} {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
              
              <div className="space-y-3 pt-4 border-t border-border">
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
                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <span className="text-xl font-semibold text-primary">{t('summary.total')}</span>
                  <span className="text-xl font-bold text-primary">
                    {items[0]?.product.currency || 'EUR'} {formatPrice(getTotal())}
                  </span>
                </div>
              </div>
            </div>

            {/* Form Steps */}
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500 mt-6">
              {/* Step 1: Contact Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-primary">{t('steps.contact')}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        {t('form.email')} *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                          errors.email ? 'border-red-500' : 'border-border'
                        }`}
                        placeholder={t('form.email_placeholder')}
                      />
                      {errors.email && (
                        <p className="text-red-500 text-sm">{errors.email}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        {t('form.phone')} *
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                          errors.phone ? 'border-red-500' : 'border-border'
                        }`}
                        placeholder={t('form.phone_placeholder')}
                      />
                      {errors.phone && (
                        <p className="text-red-500 text-sm">{errors.phone}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        {t('form.first_name')} *
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                          errors.firstName ? 'border-red-500' : 'border-border'
                        }`}
                        placeholder={t('form.first_name_placeholder')}
                      />
                      {errors.firstName && (
                        <p className="text-red-500 text-sm">{errors.firstName}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        {t('form.last_name')} *
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                          errors.lastName ? 'border-red-500' : 'border-border'
                        }`}
                        placeholder={t('form.last_name_placeholder')}
                      />
                      {errors.lastName && (
                        <p className="text-red-500 text-sm">{errors.lastName}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Shipping Information */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-primary">{t('steps.shipping')}</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        {t('form.address')} *
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                          errors.address ? 'border-red-500' : 'border-border'
                        }`}
                        placeholder={t('form.address_placeholder')}
                      />
                      {errors.address && (
                        <p className="text-red-500 text-sm">{errors.address}</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-primary mb-2">
                          {t('form.city')} *
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                            errors.city ? 'border-red-500' : 'border-border'
                          }`}
                          placeholder={t('form.city_placeholder')}
                        />
                        {errors.city && (
                          <p className="text-red-500 text-sm">{errors.city}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-primary mb-2">
                          {t('form.postal_code')} *
                        </label>
                        <input
                          type="text"
                          value={formData.postalCode}
                          onChange={(e) => handleInputChange('postalCode', e.target.value)}
                          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                            errors.postalCode ? 'border-red-500' : 'border-border'
                          }`}
                          placeholder={t('form.postal_code_placeholder')}
                        />
                        {errors.postalCode && (
                          <p className="text-red-500 text-sm">{errors.postalCode}</p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        {t('form.country')} *
                      </label>
                      <select
                        value={formData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-accent ${
                          errors.country ? 'border-red-500' : 'border-border'
                        }`}
                      >
                        <option value="Portugal">Portugal</option>
                        <option value="Spain">Espanha</option>
                        <option value="Brazil">Brasil</option>
                      </select>
                      {errors.country && (
                        <p className="text-red-500 text-sm">{errors.country}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Payment */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-primary">{t('steps.payment')}</h3>
                  
                  <div className="space-y-4">
                    <div className="border-2 border-accent/20 rounded-lg p-4">
                      <label className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="payment"
                          value="credit_card"
                          checked={formData.paymentMethod === 'credit_card'}
                          onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                          className="w-4 h-4 text-accent"
                        />
                        <span className="font-medium">{t('payment.credit_card')}</span>
                      </label>
                    </div>
                    
                    <div className="border-2 border-border rounded-lg p-4">
                      <label className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="payment"
                          value="paypal"
                          checked={formData.paymentMethod === 'paypal'}
                          onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                          className="w-4 h-4 text-accent"
                        />
                        <span className="font-medium">{t('payment.paypal')}</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="bg-accent/10 rounded-lg p-4">
                    <p className="text-sm text-text-secondary">
                      <svg className="w-4 h-4 inline-block mr-2 text-accent" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 001-1v-3a1 1 0 00-1zM9 2a1 1 0 000-2h1a1 1 0 100 2H9z" clipRule="evenodd"/>
                      </svg>
                      {t('payment.secure_message')}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-primary">{t('steps.review')}</h3>
                  
                  <div className="space-y-4">
                    <div className="border-2 border-border rounded-lg p-4">
                      <h4 className="font-medium mb-2">{t('review.contact_info')}</h4>
                      <p className="text-text-secondary">
                        {formData.firstName} {formData.lastName}<br />
                        {formData.email}<br />
                        {formData.phone}
                      </p>
                    </div>
                    
                    <div className="border-2 border-border rounded-lg p-4">
                      <h4 className="font-medium mb-2">{t('review.shipping_info')}</h4>
                      <p className="text-text-secondary">
                        {formData.address}<br />
                        {formData.city}, {formData.postalCode}<br />
                        {formData.country}
                      </p>
                    </div>
                    
                    <div className="border-2 border-border rounded-lg p-4">
                      <h4 className="font-medium mb-2">{t('review.payment_method')}</h4>
                      <p className="text-text-secondary">
                        {formData.paymentMethod === 'credit_card' ? t('payment.credit_card') : t('payment.paypal')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="saveInfo"
                      checked={formData.saveInfo}
                      onChange={(e) => handleInputChange('saveInfo', e.target.checked)}
                      className="w-4 h-4 text-accent"
                    />
                    <label htmlFor="saveInfo" className="text-sm text-text-secondary">
                      {t('form.save_info')}
                    </label>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <button
                  onClick={handlePreviousStep}
                  disabled={currentStep === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('navigation.previous')}
                </button>
                
                {currentStep < 4 ? (
                  <button
                    onClick={handleNextStep}
                    className="btn-primary"
                  >
                    {t('navigation.next')}
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isProcessing}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <span className="flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{t('navigation.processing')}</span>
                      </span>
                    ) : (
                      <span>{t('navigation.complete_order')}</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
