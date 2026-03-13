'use client';

import {useEffect, useState} from 'react';

interface PremiumFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PremiumFeaturesModal({isOpen, onClose}: PremiumFeaturesModalProps) {
  const t = (key: string) => key;
  const [selectedFeature, setSelectedFeature] = useState<number>(0);

  // Close modal on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Check if scrolling within modal content
      const modalContent = document.getElementById('modal-content');
      if (modalContent && !modalContent.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('wheel', handleWheel, { passive: false });
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('wheel', handleWheel);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        id="modal-content"
        className="bg-white rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-serif text-primary">
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close modal"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-88px)]">
          <div className="p-6">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div>
                {/* Premium Materials */}
                <button
                  onClick={() => setSelectedFeature(0)}
                  className={`p-6 rounded-xl border-2 transition-all duration-500 text-left w-full ${
                    selectedFeature === 0
                      ? 'border-accent bg-accent/5 shadow-lg'
                      : 'border-transparent hover:border-accent/30 bg-background'
                  }`}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-accent">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-primary mb-2">
                    {t('premium_materials.title')}
                  </h4>
                  <p className="text-sm text-text-secondary">
                    {t('premium_materials.description')}
                  </p>
                </button>

                {/* Handcrafted Production */}
                <button
                  onClick={() => setSelectedFeature(1)}
                  className={`p-6 rounded-xl border-2 transition-all duration-500 text-left w-full mt-4 ${
                    selectedFeature === 1
                      ? 'border-accent bg-accent/5 shadow-lg'
                      : 'border-transparent hover:border-accent/30 bg-background'
                  }`}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-accent">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-primary mb-2">
                    {t('artistic_design.title')}
                  </h4>
                  <p className="text-sm text-text-secondary">
                    {t('artistic_design.description')}
                  </p>
                </button>
              </div>

              {/* Right Column */}
              <div>
                {/* Limited Edition */}
                <button
                  onClick={() => setSelectedFeature(2)}
                  className={`p-6 rounded-xl border-2 transition-all duration-500 text-left w-full ${
                    selectedFeature === 2
                      ? 'border-accent bg-accent/5 shadow-lg'
                      : 'border-transparent hover:border-accent/30 bg-background'
                  }`}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-accent">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z"/>
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-primary mb-2">
                    {t('embroidery.title')}
                  </h4>
                  <p className="text-sm text-text-secondary">
                    {t('embroidery.description')}
                  </p>
                </button>

                {/* Ethical Production */}
                <button
                  onClick={() => setSelectedFeature(3)}
                  className={`p-6 rounded-xl border-2 transition-all duration-500 text-left w-full mt-4 ${
                    selectedFeature === 3
                      ? 'border-accent bg-accent/5 shadow-lg'
                      : 'border-transparent hover:border-accent/30 bg-background'
                  }`}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-accent">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1V-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-primary mb-2">
                    {t('metal_details.title')}
                  </h4>
                  <p className="text-sm text-text-secondary">
                    {t('metal_details.description')}
                  </p>
                </button>
              </div>
            </div>

            {/* Description spanning both columns */}
            <div className="bg-background rounded-xl p-8 border-2 border-accent/20 md:col-span-2 mt-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 text-accent">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-primary mb-3">
                    {selectedFeature === 0 && t('premium_materials.title')}
                    {selectedFeature === 1 && t('artistic_design.title')}
                    {selectedFeature === 2 && t('embroidery.title')}
                    {selectedFeature === 3 && t('metal_details.title')}
                  </h4>
                  <p className="text-text-secondary leading-relaxed">
                    {selectedFeature === 0 && t('premium_materials.description')}
                    {selectedFeature === 1 && t('artistic_design.description')}
                    {selectedFeature === 2 && t('embroidery.description')}
                    {selectedFeature === 3 && t('metal_details.description')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
