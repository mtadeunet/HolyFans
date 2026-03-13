'use client';

import {useRouter, usePathname} from 'next/navigation';

export default function LanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();

  // Get current locale from pathname
  const getCurrentLocale = () => {
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0];
    return ['pt', 'en'].includes(firstSegment) ? firstSegment : 'pt';
  };

  const locale = getCurrentLocale();

  const toggleLanguage = () => {
    const newLocale = locale === 'pt' ? 'en' : 'pt';
    
    // Get the current path without locale and navigate to new locale
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/';
    router.push(`/${newLocale}${pathWithoutLocale}`);
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
