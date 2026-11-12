import { FEED_POSTS } from '@/lib/feed-posts';
import type { SiteConfig } from '@/lib/site-config';
import FeedFaq from './feed-faq';
import PostCard from './post-card';
import PremiumModalTrigger from './premium-modal-trigger';

interface FeedPostsProps {
  /**
   * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
   * Shell with Simplified Purchase Surface - "each existing section
   * toggle governs the feed unit(s) carrying that content domain."
   *
   * The Site Config section toggles, evaluated server-side: every Post
   * Card whose `section` is toggled off is filtered out of the Feed
   * Surface, so stored configs keep their semantics unchanged.
   */
  sections: SiteConfig['sections'];
  /**
   * Site Config chrome toggles consumed by feed units: the
   * `premiumFeaturesModal` key gates the hero Post Card's Learn More
   * trigger.
   */
  chrome: SiteConfig['chrome'];
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0) — threaded to every Media Slot so media links only exist while
   * `PURCHASE_SURFACE_ENABLED` is `'true'`.
   */
  purchaseSurfaceEnabled: boolean;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "On the landing roots [the
 * Feed Surface] is a vertical scroll of Post Cards — the landing's
 * primary content."
 *
 * The landing's Feed Surface occupant: the authored Post Card list,
 * filtered by section toggle and carrying each post's optional
 * caption-level extras (the hero post's Learn More trigger, the FAQ
 * post's condensed FAQ Island). Rendered as the shell's center-column
 * children on the Locale landing roots.
 */
export default function FeedPosts({
  sections,
  chrome,
  purchaseSurfaceEnabled,
}: FeedPostsProps) {
  const posts = FEED_POSTS.filter((post) => sections[post.section]);

  return (
    <>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          purchaseSurfaceEnabled={purchaseSurfaceEnabled}
        >
          {post.id === 'post-hero' && chrome.premiumFeaturesModal && (
            <PremiumModalTrigger />
          )}
          {post.id === 'post-faq' && <FeedFaq />}
        </PostCard>
      ))}
    </>
  );
}
