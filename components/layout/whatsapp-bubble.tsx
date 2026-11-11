'use client';

import WhatsAppGlyph from '@/components/ui/whatsapp-glyph';
import { whatsappChatUrl } from '@/lib/whatsapp';
import { useTranslations } from 'next-intl';

/**
 * Implements ADR 00-009: WhatsApp Deep-Link Channels — Client-Resolved
 * Vendor Deep Links for Customer Messaging - "a persistent floating
 * control on every Storefront page opens a chat addressed to the Store
 * Messaging Number ... When no Store Messaging Number is configured, the
 * surface renders nothing — it fails closed".
 *
 * Inbound Contact Surface: fixed bottom-right anchor whose href is a
 * client-resolved click-to-chat deep link. The Store Messaging Number
 * comes from `NEXT_PUBLIC_WHATSAPP_NUMBER` — public client-side
 * configuration inlined at build time — never committed to tracked
 * files (ADR 00-007). The bottom offset clears the MobileStickyCta bar
 * (~64px) on mobile so the control never occludes the purchase CTA.
 */
export default function WhatsAppBubble() {
  const t = useTranslations('whatsapp');
  const storeMessagingNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  // Fail-closed: render nothing when no Store Messaging Number is
  // configured, and also when the configured value carries no digits.
  if (!storeMessagingNumber) return null;
  const chatUrl = whatsappChatUrl(storeMessagingNumber, t('prefilled_message'));
  if (!chatUrl) return null;

  return (
    <a
      href={chatUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('aria_label')}
      title={t('tooltip')}
      className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg transition-all duration-300 hover:bg-[#1DA851] hover:shadow-xl"
    >
      {/* White-on-brand-green glyph inside the pill (text-white on the
          anchor tints the `currentColor` fill). */}
      <WhatsAppGlyph className="h-6 w-6" />
      <span className="hidden sm:inline text-sm font-semibold">
        {t('tooltip')}
      </span>
    </a>
  );
}
