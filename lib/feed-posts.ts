import type { SectionKey } from './site-config';

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "A vertical scroll of Post
 * Cards — the landing's primary content."
 *
 * The authored feed list: content is code-managed alongside Product Data
 * (ADR 00-001's content model), ordered editorially rather than
 * chronologically. Each entry maps to exactly one SectionKey so the
 * existing Site Config section toggles hide/show the corresponding feed
 * unit(s) with no configuration migration.
 *
 * Media uses only in-repo masters (`public/images/product-female-1..4.jpg`);
 * content-domain posts without a master carry no media and render no
 * Media Slot (ADR 03-002's Imagery rule).
 */

/** A Post Card's media descriptor — an in-repo image master rendered by
 *  the Media Slot through the framework's image optimization (ADR
 *  00-006). `altKey` resolves under the `feed` message namespace (ADR
 *  00-005). */
export interface FeedMedia {
  /** Path to the image master under `public/`. */
  src: string;
  /** Message key for the localized alt text, under `feed`. */
  altKey: string;
  /**
   * Implements ADR 03-004: Model Profiles — an optional literal alt-text
   * override for media whose alt copy is operator data rather than a
   * message key (Model Profile posts carry operator-authored alt text
   * resolved by request Locale). When present it wins over the
   * `altKey` lookup.
   */
  alt?: string;
}

/** One authored Post Card entry in the Feed Surface. */
export interface FeedPost {
  /** Stable id; the Post Card renders it as the anchor `id="post-<…>"`. */
  id: string;
  /** Optional legacy section anchor the Post Card additionally exposes
   *  (e.g. `#products` on the first product post) for continuity with the
   *  pre-restyle anchor convention. */
  anchorAlias?: string;
  /** Site Config section toggle governing this feed unit (ADR 03-002's
   *  semantic remap — the key set is unchanged so stored configs keep
   *  working). */
  section: SectionKey;
  /** Message key for the localized caption, under `feed.posts.<key>`. */
  captionKey: string;
  /** Media Slot content — an in-repo image master. Absent when the
   *  post's content domain carries no imagery: the card then renders no
   *  Media Slot at all (ADR 03-002's Imagery rule — media is earned
   *  product photography, never stand-in filler). */
  media?: FeedMedia;
  /** Implements ADR 03-002 - "The displayed like count is the sum of an
   *  authored base count — part of the Post Card's code-managed content —
   *  and a shared delta persisted server-side in the managed store of
   *  ADR 00-002." The authored base count the Interaction Row renders
   *  immediately and the like counter Route Handler adds the shared
   *  delta to. */
  likes: number;
}

/**
 * The authored Feed Surface posts. The four existing product masters are
 * distributed across the hero and product posts; the remaining content
 * domains carry no media, so their cards render without a Media Slot.
 */
export const FEED_POSTS: FeedPost[] = [
  {
    id: 'post-hero',
    section: 'hero',
    captionKey: 'post-hero',
    media: {
      src: '/images/product-female-1.jpg',
      altKey: 'posts.post-hero.alt',
    },
    likes: 412,
  },
  {
    id: 'post-product-1',
    anchorAlias: 'products',
    section: 'products',
    captionKey: 'post-product-1',
    media: {
      src: '/images/product-female-2.jpg',
      altKey: 'posts.post-product-1.alt',
    },
    likes: 238,
  },
  {
    id: 'post-product-2',
    section: 'products',
    captionKey: 'post-product-2',
    media: {
      src: '/images/product-female-3.jpg',
      altKey: 'posts.post-product-2.alt',
    },
    likes: 187,
  },
  {
    id: 'post-product-3',
    section: 'products',
    captionKey: 'post-product-3',
    media: {
      src: '/images/product-female-4.jpg',
      altKey: 'posts.post-product-3.alt',
    },
    likes: 164,
  },
  {
    id: 'post-craft',
    section: 'craftsmanship',
    captionKey: 'post-craft',
    likes: 96,
  },
  {
    id: 'post-social-proof',
    section: 'socialProof',
    captionKey: 'post-social-proof',
    likes: 351,
  },
  {
    id: 'post-faq',
    section: 'faq',
    captionKey: 'post-faq',
    likes: 54,
  },
  {
    id: 'post-closing',
    section: 'finalCta',
    captionKey: 'post-closing',
    likes: 203,
  },
];
