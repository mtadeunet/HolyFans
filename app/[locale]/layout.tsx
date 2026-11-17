import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { getSiteConfig } from '@/lib/site-config-server';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import { CartProvider } from '@/context/cart-context';
import ChromeFrame from '@/components/layout/chrome-frame';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import PromotionBar from '@/components/layout/promotion-bar';
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
          promotion={
            siteConfig.chrome.promotionBar ? (
              <PromotionBar
                campaigns={siteConfig.promotion.campaigns}
                freeShippingThresholdCents={
                  siteConfig.shipping.freeShippingThresholdCents
                }
                purchaseSurfaceEnabled={purchaseSurfaceEnabled}
              />
            ) : null
          }
          header={
            siteConfig.chrome.header ? (
              <Header purchaseSurfaceEnabled={purchaseSurfaceEnabled} />
            ) : null
          }
          footer={siteConfig.chrome.footer ? <Footer /> : null}
        >
          <main className="flex-1">{children}</main>
        </ChromeFrame>
        {/* The Inbound Contact Surface is withdrawn (ADR 00-014
            amendment of ADR 00-009): the Store Messaging Number is left
            unconfigured so `WhatsAppBubble` renders nothing —
            fail-closed. The dormant component and its `whatsappBubble`
            Site Config toggle stay mounted so the surface can return
            purely by configuration (ADR 00-009). */}
        {siteConfig.chrome.whatsappBubble && <WhatsAppBubble />}
      </CartProvider>
      <Analytics />
    </NextIntlClientProvider>
  );
}
