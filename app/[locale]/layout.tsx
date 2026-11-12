import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { getSiteConfig } from '@/lib/site-config-server';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import { CartProvider } from '@/context/cart-context';
import ChromeFrame from '@/components/layout/chrome-frame';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import WhatsAppBubble from '@/components/layout/whatsapp-bubble';
import { Analytics } from '@vercel/analytics/next';

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

/**
 * Locale-scoped layout.
 *
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - the classic header/footer
 * mounts move inside `ChromeFrame`, which suppresses them on the routes
 * the Feed Shell composes (the Locale landing roots and the purchase
 * route — the shell is the entire chrome there) while keeping them on
 * every other route under the same Site Config chrome toggles. The
 * former `MobileStickyCta` mount is removed — its role is absorbed by
 * the shell's mobile bottom navigation band under the same
 * `mobileStickyCta` chrome key.
 */
export default async function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [messages, siteConfig] = await Promise.all([
    getMessages(),
    getSiteConfig(),
  ]);
  // Fail-closed purchase-surface gate (ADR 00-004 / plan M0): evaluated
  // server-side per request; controls checkout-page reachability and all
  // nav CTAs that link to it.
  const purchaseSurfaceEnabled = isPurchaseSurfaceEnabled();

  return (
    <NextIntlClientProvider messages={messages}>
      <CartProvider>
        <ChromeFrame
          header={
            siteConfig.chrome.header ? (
              <Header purchaseSurfaceEnabled={purchaseSurfaceEnabled} />
            ) : null
          }
          footer={siteConfig.chrome.footer ? <Footer /> : null}
        >
          <main className="flex-1">{children}</main>
        </ChromeFrame>
        {/* Inbound Contact Surface (ADR 00-009): toggleable through Site
            Config like other global chrome; also fails closed internally
            when no Store Messaging Number is configured. */}
        {siteConfig.chrome.whatsappBubble && <WhatsAppBubble />}
      </CartProvider>
      <Analytics />
    </NextIntlClientProvider>
  );
}
