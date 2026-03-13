// Static routing configuration for GitHub Pages
export const locales = ['pt', 'en'] as const;
export const defaultLocale = 'pt' as const;

// Simple navigation functions for static export
export function getLocaleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  return locales.includes(firstSegment as any) ? firstSegment : defaultLocale;
}

export function getPathWithoutLocale(pathname: string): string {
  const locale = getLocaleFromPath(pathname);
  if (locale === defaultLocale && !pathname.startsWith(`/${locale}`)) {
    return pathname;
  }
  return pathname.replace(`/${locale}`, '') || '/';
}
