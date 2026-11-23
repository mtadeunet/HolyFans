import { FEED_POSTS } from '@/lib/feed-posts';
import type { ModelProfile } from '@/lib/profiles';
import { publishedProfilePostPairs, shuffled } from '@/lib/profiles';
import type { SiteConfig } from '@/lib/site-config';
import FeedFaq from './feed-faq';
import PostCard from './post-card';
import PremiumModalTrigger from './premium-modal-trigger';
import ProfilePostCard from './profile-post-card';

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
  /**
   * Implements ADR 03-004: Model Profiles — the Model Profile list:
   * the `public/images/profiles/` folders overlaid with the managed
   * store's `profile:<slug>` documents; every enabled profile's
   * visible posts render after the authored `FEED_POSTS`, shuffled
   * per request.
   */
  profiles: ModelProfile[];
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
  profiles,
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
      {/* Implements ADR 03-004: Model Profiles — every enabled
          profile's VISIBLE posts follow the authored feed as an
          appended tail, SHUFFLED per request (`shuffled` runs a
          Fisher–Yates pass on the collected {profile, post} pairs, so
          the post→profile mapping survives and posts interleave
          across profiles instead of grouping in folder order), each
          rendered through the shared `ProfilePostCard` adapter so the
          card carries the profile's author identity and its `pp-` id
          as the anchor. Server-rendered per request — a fresh order
          every render, no hydration mismatch. Hidden posts
          (`visible: false`) render nowhere. */}
      {shuffled(publishedProfilePostPairs(profiles)).map(
        ({ profile, post }) => (
          <ProfilePostCard
            key={post.id}
            profile={profile}
            post={post}
            purchaseSurfaceEnabled={purchaseSurfaceEnabled}
          />
        )
      )}
    </>
  );
}
