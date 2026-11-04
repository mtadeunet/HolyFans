import type { Metadata, Viewport } from 'next';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SITE_CONFIG } from '@/lib/constants';
import './[locale]/globals.css';

/**
 * Root layout — the single `<html>`/`<body>` document for every top-level
 * route tree: the `[locale]` storefront, `/admin`, and the not-found
 * boundaries (a root layout is mandatory for not-found entries).
 *
 * `lang` resolves the request Locale via next-intl — the matched
 * `[locale]` segment for storefront routes, the Primary Locale fallback
 * from `lib/i18n.ts` for everything else (admin, root not-found) — the
 * same resolution `getMessages()` uses (ADR 00-005).
 *
 * Site-wide document metadata lives here; nested trees (e.g. `/admin`)
 * override it with their own `metadata` exports.
 */
export const metadata: Metadata = {
  title: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
