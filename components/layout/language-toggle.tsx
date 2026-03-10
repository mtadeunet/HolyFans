'use client';

import {useLocale} from 'next-intl';
import {useRouter, usePathname} from 'next/navigation';

export default function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const newLocale = locale === 'pt' ? 'en' : 'pt';
    
    // Simple approach - just navigate to the new locale root
    router.push(`/${newLocale}`);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-border hover:bg-surface transition-colors"
      aria-label="Toggle language"
    >
      <span className={`text-sm font-medium ${locale === 'pt' ? 'text-primary' : 'text-text-secondary'}`}>
        PT
      </span>
      <div className="w-4 h-4 flex items-center justify-center">
        <div className={`w-2 h-2 rounded-full transition-colors ${locale === 'pt' ? 'bg-accent' : 'bg-border'}`}></div>
      </div>
      <span className={`text-sm font-medium ${locale === 'en' ? 'text-primary' : 'text-text-secondary'}`}>
        EN
      </span>
    </button>
  );
}
