import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { FeedPost } from '@/lib/feed-posts';
import { Link } from '@/lib/navigation';
import InteractionRow from './interaction-row';
import MediaSlot from './media-slot';

/**
 * Implements ADR 03-004: Model Profiles — a Model Profile's author
 * identity for the Post Card header: when set, the header renders the
 * profile's avatar and name wrapped in a link to the profile's
 * `/u/<slug>` route instead of the brand avatar and name.
 */
interface PostCardAuthor {
  /** The profile's display name — derived from the slug, rendered
   *  verbatim. */
  name: string;
  /** The profile's slug — rendered as the decorative `@handle`. */
  handle: string;
  /** The profile's avatar path under `public/`; '' renders a plain
   *  circle placeholder. */
  avatarSrc: string;
  /** The profile route (`/u/<slug>`) — locale-prefixed by the
   *  next-intl Link. */
  href: string;
}

interface PostCardProps {
  /**
   * The post being rendered — the subset of `FeedPost` the card reads;
   * `FeedPost` satisfies it, and Model Profile posts adapt onto it
   * (`ProfilePostCard`) without carrying feed-only fields like
   * `section` (ADR 03-004).
   */
  post: Pick<FeedPost, 'id' | 'anchorAlias' | 'captionKey' | 'media' | 'likes'>;
  /**
   * Implements ADR 03-004: Model Profiles — the post's author identity;
   * absent (authored feed posts) the header renders the brand avatar
   * and name exactly as before.
   */
  author?: PostCardAuthor;
  /**
   * Implements ADR 03-004: Model Profiles — literal caption text that
   * replaces the `feed.posts.<captionKey>.caption` message lookup for
   * posts whose copy lives in the managed store's profile records
   * rather than messages. The `useTranslations` hook still runs
   * unconditionally; only the key lookup is skipped.
   */
  captionOverride?: string;
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0) — threaded through to the Media Slot and the card-level product
   * link so `/checkout` anchors only exist while
   * `PURCHASE_SURFACE_ENABLED` is `'true'`.
   */
  purchaseSurfaceEnabled: boolean;
  /**
   * Whether this instance carries the post's anchor ids. A DOM `id` is
   * unique per document, and an interstitial repeats down the scroll:
   * the feed composer passes `false` for every instance after the first
   * (`occurrence === 0`), and a non-anchorable card renders neither the
   * article's `id={post.id}` nor the `anchorAlias` span — an id-less
   * clone that leaves the nav anchor and share fragment resolving to
   * the first instance. Defaults to `true` — single-instance posts are
   * always anchorable.
   */
  anchorable?: boolean;
  /** Optional caption-level extras (the FAQ interstitial's condensed
   *  FAQ Island). */
  children?: ReactNode;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "Each Post Card — profile
 * post or authored interstitial — is a self-contained unit: a header
 * carrying the author's avatar, name, and a decorative handle string
 * (own-brand attribution for authored units, the profile's attribution
 * and Profile Route link per the author override of ADR 03-004 — never
 * a third-party account reference); localized caption copy; a Media
 * Slot for posts carrying imagery; and an Interaction Row."
 *
 * The Feed Surface's repeating unit. The article carries the stable
 * anchor `id={post.id}` (`post-closing`, `post-faq`, `pp-<…>`, …) so
 * Nav Rail entries can scroll to it; posts with an `anchorAlias`
 * additionally expose the legacy section anchor (the limited-edition
 * interstitial keeps `id="products"` working). Because an interstitial
 * repeats down the scroll and a DOM id must stay unique, only the
 * first instance is addressable: `anchorable` gates both ids, and
 * later instances render as id-less clones — their post id still keys
 * the like store and names the share fragment, which resolves to the
 * first instance.
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
  author,
  captionOverride,
  purchaseSurfaceEnabled,
  anchorable = true,
  children,
}: PostCardProps) {
  const t = useTranslations('feed');
  const tCommon = useTranslations('common');
  // A `captionOverride` replaces the message lookup entirely — profile
  // posts carry managed-store copy, not `feed.posts` message keys
  // (ADR 03-004). The hooks above stay unconditional.
  const caption = captionOverride ?? t(`posts.${post.captionKey}.caption`);

  return (
    <article
      id={anchorable ? post.id : undefined}
      className="relative border-b border-border bg-surface"
    >
      {/* The legacy section anchor lives only on the addressable
          instance like the article's own id — a non-anchorable clone
          renders no alias span at all (it would be dead markup). */}
      {anchorable && post.anchorAlias && (
        <span
          id={post.anchorAlias}
          aria-hidden="true"
          className="absolute top-0 block"
        />
      )}

      {/* Implements ADR 00-011: Page Model and Product Routes — A
          Landing Page and One Product Page per Product - "Every
          in-shell affordance that resolves purchase intent — Media Slot
          links, the Nav Rail purchase entry, Suggestions Rail
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
          third-party account name (identifier hygiene, ADR 00-007).
          Implements ADR 03-004: Model Profiles — when `author` is set
          the header instead shows the profile's avatar and name inside
          a link to the profile route; the Link carries `relative` so it
          sits above the card's stretched product link like the other
          interactive Islands, and the displayed @handle is the profile
          slug carried on `author.handle`. */}
      <header className="flex items-center gap-3 px-4 py-3">
        {author !== undefined ? (
          <Link
            href={author.href}
            aria-label={t('profile.view_profile', { name: author.name })}
            className="relative flex min-w-0 items-center gap-3"
          >
            {author.avatarSrc !== '' ? (
              <Image
                src={author.avatarSrc}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-full border border-border object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-10 w-10 rounded-full border border-border bg-background"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {author.name}
              </p>
              <p className="truncate text-sm text-text-secondary">
                @{author.handle}
              </p>
            </div>
          </Link>
        ) : (
          <>
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
          </>
        )}
      </header>

      <div className="px-4 pb-3">
        <p className="text-sm leading-relaxed text-text-primary">{caption}</p>
      </div>

      {/* Interactive caption-level extras (the FAQ Island): `relative`
          positions them above the card's stretched
          product link so their controls keep their own clicks — the
          buttons are siblings of the link, so no propagation handling
          is needed. */}
      <div className="relative">{children}</div>

      {/* Implements ADR 03-002: Landing Page Composition — "a Media
          Slot for posts carrying imagery" — the media region mounts
          only when the post carries an in-repo image master; posts
          without imagery render no Media Slot markup at all rather
          than substituting stand-in media. */}
      {post.media && (
        <MediaSlot
          media={post.media}
          purchaseSurfaceEnabled={purchaseSurfaceEnabled}
        />
      )}

      {/* Same layering: the like and share controls sit above the
          stretched link and never trigger navigation. */}
      <div className="relative">
        <InteractionRow postId={post.id} likes={post.likes} caption={caption} />
      </div>
    </article>
  );
}
