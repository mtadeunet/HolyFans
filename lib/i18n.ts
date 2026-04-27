import { getRequestConfig } from 'next-intl/server';

export const locales = ['pt', 'en'] as const;
export const defaultLocale = 'pt' as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
