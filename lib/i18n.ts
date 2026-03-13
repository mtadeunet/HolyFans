// Client-side i18n configuration for static export
export const locales = ['pt', 'en'] as const;
export const defaultLocale = 'pt' as const;

export async function getMessages(locale: string = defaultLocale) {
  try {
    const messages = await import(`../messages/${locale}.json`);
    return messages.default;
  } catch (error) {
    console.warn(`Could not load messages for locale: ${locale}`);
    const defaultMessages = await import(`../messages/${defaultLocale}.json`);
    return defaultMessages.default;
  }
}
