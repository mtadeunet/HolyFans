import { useLocale } from 'next-intl';
import type { FeedMedia, FeedPost } from '@/lib/feed-posts';
import type { Locale } from '@/lib/i18n';
import {
  profileDisplayName,
  profilePath,
  type ModelProfile,
  type ProfilePost,
} from '@/lib/profiles';
import PostCard from './post-card';

interface ProfilePostCardProps {
  /** The Model Profile the post belongs to — supplies the card's
   *  author identity and the media-alt fallback name. */
  profile: ModelProfile;
  /** The profile's post being rendered. */
  post: ProfilePost;
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0) — forwarded to the Post Card unchanged.
   */
  purchaseSurfaceEnabled: boolean;
}

/**
 * Implements ADR 03-004: Model Profiles — the adapter rendering a
 * Model Profile post through the shared Post Card. The profile post's
 * effective copy (overlay fields merged onto the filesystem baseline)
 * becomes the Post Card's override surface: the `author` prop carries
 * the profile's avatar, name, and `/u/<slug>` link (so the header
 * links to the profile instead of showing the brand header),
 * `captionOverride` carries the Locale-resolved caption (skipping the
 * `feed.posts` message lookup), and the Media Slot gets the post's
 * literal alt text — `post.alt[locale]` when authored, the profile's
 * display name otherwise.
 *
 * Shared by the `/u/<slug>` profile route and the landing Feed
 * Surface's profile-post mixing so both render profile posts
 * identically through one path.
 */
export default function ProfilePostCard({
  profile,
  post,
  purchaseSurfaceEnabled,
}: ProfilePostCardProps) {
  const locale = useLocale() as Locale;
  // Implements ADR 03-004: per-Locale copy falls back to the sibling
  // Locale when the request Locale's field is empty — an operator who
  // authors pt-only copy still renders it on the en site rather than a
  // blank caption/alt (empty strings, not just absent fields,
  // fall through — `||` over `??` deliberately). The display name is
  // derived from the slug — not stored, never localized.
  const other: Locale = locale === 'pt' ? 'en' : 'pt';
  const name = profileDisplayName(profile);

  // The profile post adapted onto the Post Card's post shape: `id`,
  // `likes`, and `media` carry over directly — a profile post IS its
  // image file, so the Media Slot always exists; `captionKey` is
  // inert (the captionOverride replaces its lookup) and
  // `FeedMedia.altKey` likewise (`alt` is always resolved here) —
  // both keep the post's own id as a self-documenting placeholder,
  // never rendered.
  const cardPost: Pick<
    FeedPost,
    'id' | 'anchorAlias' | 'captionKey' | 'media' | 'likes'
  > = {
    id: post.id,
    captionKey: post.id,
    media: {
      src: post.media,
      altKey: post.id,
      alt: post.alt?.[locale] || post.alt?.[other] || name,
    } satisfies FeedMedia,
    likes: post.likes,
  };

  return (
    <PostCard
      post={cardPost}
      author={{
        name,
        handle: profile.id,
        avatarSrc: profile.avatar,
        href: profilePath(profile.id),
      }}
      captionOverride={post.caption[locale] || post.caption[other]}
      purchaseSurfaceEnabled={purchaseSurfaceEnabled}
    />
  );
}
