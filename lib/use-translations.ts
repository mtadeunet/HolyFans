'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Cache for loaded translations
const translationCache = new Map<string, Record<string, any>>();

export function useTranslations(namespace: string = '') {
  const pathname = usePathname();
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Get locale from pathname
  const getLocale = () => {
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0];
    return ['pt', 'en'].includes(firstSegment) ? firstSegment : 'pt';
  };

  const locale = getLocale();

  // Load translations
  useEffect(() => {
    const loadTranslations = async () => {
      const cacheKey = `${locale}`;

      if (translationCache.has(cacheKey)) {
        setTranslations(translationCache.get(cacheKey)!);
        setIsLoading(false);
        return;
      }

      try {
        // Import the translation file dynamically
        const messages = await import(`../messages/${locale}.json`);
        translationCache.set(cacheKey, messages.default);
        setTranslations(messages.default);
      } catch (error) {
        console.warn(`Could not load translations for locale: ${locale}`);
        // Fallback to Portuguese
        try {
          const fallbackMessages = await import(`../messages/pt.json`);
          translationCache.set('pt', fallbackMessages.default);
          setTranslations(fallbackMessages.default);
        } catch (fallbackError) {
          console.error('Could not load fallback translations');
          setTranslations({});
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [locale]);

  const t = (key: string, values?: Record<string, string>): string => {
    if (isLoading) return key;

    const fullKey = namespace ? `${namespace}.${key}` : key;

    // Get nested value from translations object
    const getNestedValue = (obj: any, path: string): string => {
      return path.split('.').reduce((current, keyPart) => {
        return current && current[keyPart] !== undefined ? current[keyPart] : '';
      }, obj);
    };

    let value = getNestedValue(translations, fullKey);

    // If no value found, try without namespace
    if (!value && namespace) {
      value = getNestedValue(translations, key);
    }

    // Replace values in the string
    if (value && values) {
      Object.entries(values).forEach(([placeholder, replacement]) => {
        value = value.replace(new RegExp(`{{${placeholder}}}`, 'g'), replacement);
      });
    }

    return value || key; // Return key as fallback
  };

  return t;
}
