'use client';

import PremiumFeaturesModal from '@/components/ui/premium-features-modal';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "`premium-features-modal.tsx`
 * stays; its trigger moves into the hero Post Card (a caption-level
 * 'learn more' control), still governed by `premiumFeaturesModal`."
 *
 * Caption-level Learn More control inside the hero Post Card; the Site
 * Config `premiumFeaturesModal` chrome toggle governs whether the Feed
 * Shell mounts this Island at all.
 */
export default function PremiumModalTrigger() {
  const t = useTranslations('hero');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-4 pb-3 text-sm font-semibold text-primary transition-colors hover:text-accent"
      >
        {t('learn_more')}
      </button>
      <PremiumFeaturesModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
