import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { FeedPost } from '@/lib/feed-posts';
import InteractionRow from './interaction-row';
import MediaSlot from './media-slot';

interface PostCardProps {
  /** The authored feed entry being rendered. */
  post: FeedPost;
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0) — threaded through to the Media Slot so media links only exist
   * while `PURCHASE_SURFACE_ENABLED` is `'true'`.
   */
  purchaseSurfaceEnabled: boolean;
  /** Optional caption-level extras (hero post's Learn More trigger, the
   *  FAQ post's condensed FAQ Island). */
  children?: ReactNode;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "Each Post Card is a
 * self-contained unit: a header carrying the brand avatar, name, and a
 * decorative handle string (own brand only, never a third-party account
 * reference and never a link); localized caption copy; a Media Slot; and
 * an Interaction Row."
 *
 * The Feed Surface's repeating unit. The article carries the stable
 * anchor `id={post.id}` (`post-hero`, `post-faq`, …) so Nav Rail entries
 * can scroll to it; posts with an `anchorAlias` additionally expose the
 * legacy section anchor (the first product post keeps `id="products"`
 * working).
 */
export default function PostCard({
  post,
  purchaseSurfaceEnabled,
  children,
}: PostCardProps) {
  const t = useTranslations('feed');
  const tCommon = useTranslations('common');
  const caption = t(`posts.${post.captionKey}.caption`);

  return (
    <article
      id={post.id}
      className="relative border-b border-border bg-surface"
    >
      {post.anchorAlias && (
        <span
          id={post.anchorAlias}
          aria-hidden="true"
          className="absolute top-0 block"
        />
      )}

      {/* Card header — brand avatar, name, and a decorative own-brand
          handle rendered as plain text: never a link, never a
          third-party account name (identifier hygiene, ADR 00-007). */}
      <header className="flex items-center gap-3 px-4 py-3">
        <Image
          src="/logo/logo-mark.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-full border border-border object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">
            {tCommon('brand')}
          </p>
          <p className="truncate text-sm text-text-secondary">
            {t('post.handle')}
          </p>
        </div>
      </header>

      <div className="px-4 pb-3">
        <p className="text-sm leading-relaxed text-text-primary">{caption}</p>
      </div>

      {children}

      <MediaSlot
        media={post.media}
        purchaseSurfaceEnabled={purchaseSurfaceEnabled}
      />

      <InteractionRow postId={post.id} likes={post.likes} caption={caption} />
    </article>
  );
}
