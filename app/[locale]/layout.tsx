import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { SITE_CONFIG } from '@/lib/constants';
import { getSiteConfig } from '@/lib/site-config';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import { CartProvider } from '@/context/cart-context';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import MobileStickyCta from '@/components/layout/mobile-sticky-cta';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "Site Config is read
 * from Edge Config at request time."
 *
 * The Locale tree already renders at request time because it reads Site
 * Config per request; declaring it explicit also lets the
 * `PURCHASE_SURFACE_ENABLED` gate be evaluated per request (ADR 00-004 /
 * plan M0), so flipping the flag in a non-production environment takes
 * effect on server restart without a rebuild.
 */
export const dynamic = 'force-dynamic';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [messages, siteConfig] = await Promise.all([
    getMessages(),
    getSiteConfig(),
  ]);
  // Fail-closed purchase-surface gate (ADR 00-004 / plan M0): evaluated
  // server-side per request; controls checkout-page reachability and all
  // nav CTAs that link to it.
  const purchaseSurfaceEnabled = isPurchaseSurfaceEnabled();

  return (
    <html lang={locale}>
      <head>
        <title key="title">{SITE_CONFIG.name}</title>
        <meta
          name="description"
          content={SITE_CONFIG.description}
          key="description"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
          key="viewport"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <CartProvider>
            <div className="min-h-screen flex flex-col">
              {siteConfig.chrome.header && (
                <Header purchaseSurfaceEnabled={purchaseSurfaceEnabled} />
              )}
              <main className="flex-1">{children}</main>
              {siteConfig.chrome.footer && <Footer />}
            </div>
            {siteConfig.chrome.mobileStickyCta && <MobileStickyCta />}
          </CartProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
