'use client';

import {usePathname} from 'next/navigation';

// Simple client-side translation hook for static export
export function useTranslations(namespace: string = '') {
  const pathname = usePathname();
  
  // Get locale from pathname
  const getLocale = () => {
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0];
    return ['pt', 'en'].includes(firstSegment) ? firstSegment : 'pt';
  };
  
  const locale = getLocale();
  
  const t = (key: string, values?: Record<string, string>): string => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    
    // For static export, we'll return the key as fallback
    // In a real implementation, you could import the messages directly
    return fullKey;
  };
  
  return t;
}
