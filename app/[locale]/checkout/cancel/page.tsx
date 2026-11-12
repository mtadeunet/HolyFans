import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import TestModeBanner from '@/components/ui/test-mode-banner';

/**
 * Locale-prefixed post-checkout cancel page.
 *
 * Implements ADR 00-004: Commerce and Checkout - the shopper abandoned the
 * PSP-hosted page; the Cart was never charged and is preserved in the
 * browser (client-side Cart, ADR 00-004).
 *
 * Behind the same fail-closed `PURCHASE_SURFACE_ENABLED` gate as the
 * checkout page: `notFound()` when the flag is unset.
 *
 * @param params - Route params; `locale` builds the link back into the
 *   matching Locale tree's checkout page (ADR 00-005).
 * @returns The localized "checkout canceled" state.
 */
export default async function CheckoutCancelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations('purchase.cancel_page');

  if (!isPurchaseSurfaceEnabled()) {
    notFound();
  }

  const { locale } = await params;

  return (
    <main className="min-h-screen">
      <TestModeBanner />
      <section className="py-16 md:py-24 lg:py-32 bg-background">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="w-20 h-20 bg-border rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-10 h-10 text-text-secondary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif text-text-primary">
              {t('title')}
            </h1>
            <div className="bg-surface rounded-xl p-6 border-2 border-accent/20">
              <p className="text-text-secondary">{t('description')}</p>
            </div>
            <Link
              href={`/${locale}/checkout`}
              className="btn-primary inline-block"
            >
              {t('back_to_checkout')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
