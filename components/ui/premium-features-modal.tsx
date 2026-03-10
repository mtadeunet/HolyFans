'use client';

import {useTranslations} from 'next-intl';

interface PremiumFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PremiumFeaturesModal({isOpen, onClose}: PremiumFeaturesModalProps) {
  const t = useTranslations('features');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-serif text-primary">
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-primary transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Premium Materials */}
          <div className="bg-surface rounded-xl p-6">
            <h3 className="text-xl font-semibold text-primary mb-4">
              {t('premium_materials.title')}
            </h3>
            <p className="text-text-secondary leading-relaxed">
              {t('premium_materials.description')}
            </p>
          </div>

          {/* Handcrafted Production */}
          <div className="bg-surface rounded-xl p-6">
            <h3 className="text-xl font-semibold text-primary mb-4">
              {t('handcrafted.title')}
            </h3>
            <p className="text-text-secondary leading-relaxed">
              {t('handcrafted.description')}
            </p>
          </div>

          {/* Limited Edition */}
          <div className="bg-surface rounded-xl p-6">
            <h3 className="text-xl font-semibold text-primary mb-4">
              {t('limited_edition.title')}
            </h3>
            <p className="text-text-secondary leading-relaxed">
              {t('limited_edition.description')}
            </p>
          </div>

          {/* Ethical Production */}
          <div className="bg-surface rounded-xl p-6">
            <h3 className="text-xl font-semibold text-primary mb-4">
              {t('ethical_production.title')}
            </h3>
            <p className="text-text-secondary leading-relaxed">
              {t('ethical_production.description')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-6 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full btn-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
