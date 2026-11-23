import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import type { FeedMedia } from '@/lib/feed-posts';

interface MediaSlotProps {
  /** The post's media descriptor — an in-repo image master. */
  media: FeedMedia;
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0)
   *
   * `true` only when the server evaluated the fail-closed
   * `PURCHASE_SURFACE_ENABLED` flag: while gated the Media Slot renders
   * unlinked so the landing exposes zero `/checkout` anchors.
   */
  purchaseSurfaceEnabled: boolean;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "Every Media Slot is a link
 * to the Product Page of the product it features within the same Locale
 * (ADR 00-011) — seeing a product image and tapping it is the primary
 * path to purchase."
 *
 * The Post Card's media region. Only posts carrying an in-repo image
 * master mount a Media Slot at all — a Post Card without imagery renders
 * no media region (ADR 03-002's Imagery rule) — so the slot always
 * renders a real master through the framework's image optimization (ADR
 * 00-006) at the Feed Surface's column width. The wrapping Link comes
 * from `lib/navigation.ts` so the Locale prefix is preserved
 * automatically (ADR 00-005); while the purchase surface is gated the
 * media renders unlinked, preserving the zero-`/checkout`-links
 * contract.
 */
export default function MediaSlot({
  media,
  purchaseSurfaceEnabled,
}: MediaSlotProps) {
  const t = useTranslations('feed');

  const slot = (
    <div className="relative aspect-square w-full overflow-hidden bg-surface">
      <Image
        src={media.src}
        alt={media.alt ?? t(media.altKey)}
        fill
        sizes="(max-width: 768px) 100vw, 576px"
        className="object-cover"
      />
    </div>
  );

  if (!purchaseSurfaceEnabled) {
    return slot;
  }

  return (
    <Link
      href="/checkout"
      className="block transition-opacity hover:opacity-95"
    >
      {slot}
    </Link>
  );
}
