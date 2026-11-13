import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { FeedPost } from '@/lib/feed-posts';
import { Link } from '@/lib/navigation';
import InteractionRow from './interaction-row';
import MediaSlot from './media-slot';

interface PostCardProps {
  /** The authored feed entry being rendered. */
  post: FeedPost;
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0) — threaded through to the Media Slot and the card-level product
   * link so `/checkout` anchors only exist while
   * `PURCHASE_SURFACE_ENABLED` is `'true'`.
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
 *
 * While the Purchase-Surface Gate is open the whole card resolves
 * purchase intent: a stretched link overlays the card so a tap anywhere
 * navigates to the product's page. The card's interactive Islands — the
 * caption-level extras (`children`) and the Interaction Row — are
 * positioned above the overlay (`relative`) so their controls keep
 * their own clicks and never trigger navigation.
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

      {/* Implements ADR 00-011: Page Model and Product Routes — A
          Landing Page and One Product Page per Product - "Every
          in-shell affordance that resolves purchase intent — Media Slot
          links, the Nav Rail purchase call-to-action, Suggestions Rail
          Variant suggestions — resolves to the Product Page of the
          product it features." The stretched link covers the whole
          Post Card so a tap anywhere resolves purchase intent — a
          single-product catalog means every post features the same
          product. It targets the as-built `/{locale}/checkout` route
          (locale-prefixed by the next-intl Link, ADR 00-005) pending the
          ADR 00-011 rename to `/<Locale>/product/<slug>`, and renders
          only while the Purchase-Surface Gate (ADR 00-004) is open —
          the zero-purchase-anchors contract. Interactive Islands are
          raised above it with `relative`; the Media Slot keeps its own
          link to the same destination. */}
      {purchaseSurfaceEnabled && (
        <Link
          href="/checkout"
          aria-label={t('post.product_aria')}
          className="absolute inset-0"
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

      {/* Interactive caption-level extras (Learn More trigger, FAQ
          Island): `relative` positions them above the card's stretched
          product link so their controls keep their own clicks — the
          buttons are siblings of the link, so no propagation handling
          is needed. */}
      <div className="relative">{children}</div>

      <MediaSlot
        media={post.media}
        purchaseSurfaceEnabled={purchaseSurfaceEnabled}
      />

      {/* Same layering: the like and share controls sit above the
          stretched link and never trigger navigation. */}
      <div className="relative">
        <InteractionRow postId={post.id} likes={post.likes} caption={caption} />
      </div>
    </article>
  );
}
