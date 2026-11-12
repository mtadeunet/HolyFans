import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import type { FeedMedia } from '@/lib/feed-posts';

interface MediaSlotProps {
  /** The post's media descriptor — a real master image or a branded
   *  placeholder composition. */
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
 * Shell with Simplified Purchase Surface - "Every Media Slot is a link to
 * the Simplified Purchase Surface within the same Locale — seeing a
 * product image and tapping it is the primary path to purchase."
 *
 * The Post Card's media region. Image media render through the
 * framework's image optimization (ADR 00-006) at the Feed Surface's
 * column width; placeholders are branded token-styled compositions built
 * from the canonical Brand Palette (ADR 03-001) — never external assets.
 * The wrapping Link comes from `lib/navigation.ts` so the Locale prefix
 * is preserved automatically (ADR 00-005); while the purchase surface is
 * gated the media renders unlinked, preserving the
 * zero-`/checkout`-links contract.
 */
export default function MediaSlot({
  media,
  purchaseSurfaceEnabled,
}: MediaSlotProps) {
  const t = useTranslations('feed');

  const content =
    media.kind === 'image' ? (
      <Image
        src={media.src}
        alt={t(media.altKey)}
        fill
        sizes="(max-width: 768px) 100vw, 576px"
        className="object-cover"
      />
    ) : (
      /* Branded placeholder composition: Brand Palette surfaces with the
         logo mark centered — in-repo motif, no external asset. */
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent/50">
        <div className="w-24 h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
          <Image
            src="/logo/logo-mark.png"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 object-contain opacity-90"
          />
        </div>
      </div>
    );

  const slot = (
    <div className="relative aspect-square w-full overflow-hidden bg-surface">
      {content}
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
