import { useTranslations } from 'next-intl';
import Link from 'next/link';

/**
 * Shared 404 body for the storefront's not-found boundaries.
 *
 * Implements ADR 00-005: Internationalization - "Translations are
 * maintained as versioned message catalogs alongside the code, one per
 * Locale, covering all UI strings and page copy, held to key-for-key
 * parity."
 *
 * Kept provider-free: as a Server Component, `useTranslations` resolves
 * the request Locale from the i18n request config, so the same markup can
 * render both inside `app/[locale]/not-found.tsx` (Locale known from the
 * URL segment) and the root `app/not-found.tsx` (Locale resolved by
 * middleware detection, falling back to the `pt` Primary Locale when the
 * request carries none). The "Go Home" link targets `/`, where the
 * middleware's browser-language detection forwards the visitor to their
 * Locale tree.
 */
export default function NotFoundContent() {
  const t = useTranslations('not_found');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-text-primary">404</h1>
        <h2 className="text-2xl font-semibold text-text-primary mt-4">
          {t('title')}
        </h2>
        <p className="text-text-secondary mt-2 mb-8">{t('description')}</p>
        <Link href="/" className="btn-primary inline-block">
          {t('go_home')}
        </Link>
      </div>
    </div>
  );
}
