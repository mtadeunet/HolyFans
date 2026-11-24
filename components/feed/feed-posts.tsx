import { FEED_POSTS, interleaveInterstitials } from '@/lib/feed-posts';
import type { ModelProfile } from '@/lib/profiles';
import { publishedProfilePostPairs, shuffled } from '@/lib/profiles';
import type { SiteConfig } from '@/lib/site-config';
import FeedFaq from './feed-faq';
import PostCard from './post-card';
import ProfilePostCard from './profile-post-card';

interface FeedPostsProps {
  /**
   * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
   * Shell with Simplified Purchase Surface - "each section toggle
   * governs the interstitial carrying its content domain — a saved
   * "hide FAQ" still hides FAQ content, now expressed as removing the
   * FAQ island from the insertion cycle — and keeps governing the
   * non-feed surfaces it already names; a toggle whose content domain
   * left the landing governs nothing in the feed."
   *
   * The Site Config section toggles, evaluated server-side: only the
   * two surviving authored interstitials remain governed here — a
   * toggled-off unit leaves the insertion cycle entirely. Stored
   * configs keep their semantics unchanged.
   */
  sections: SiteConfig['sections'];
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
   * visible posts ARE the feed body, shuffled per request, with the
   * authored interstitials spliced in every three posts.
   */
  profiles: ModelProfile[];
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "On the landing roots its
 * body is the profile post scroll — the visible posts of every enabled
 * Model Profile, collected and shuffled per request (ADR 03-004) —
 * into which the surviving authored units are inserted as
 * interstitials."
 *
 * The landing's Feed Surface occupant: the shuffled profile-post scroll
 * with the section-enabled interstitial set — the limited-edition
 * final-CTA unit and the FAQ island — spliced in one per every three
 * profile posts, cycling in authored order. Rendered as the shell's
 * center-column children on the Locale landing roots.
 */
export default function FeedPosts({
  sections,
  purchaseSurfaceEnabled,
  profiles,
}: FeedPostsProps) {
  // Implements ADR 03-002 — "an interstitial whose section toggle is
  // off leaves the cycle": the insertion cycle runs over the
  // section-enabled authored units only, in authored order.
  const interstitials = FEED_POSTS.filter((post) => sections[post.section]);

  // Implements ADR 03-004: Model Profiles — the feed body is every
  // enabled profile's VISIBLE posts as `{profile, post}` pairs,
  // SHUFFLED per request (`shuffled` runs a Fisher–Yates pass so the
  // post→profile mapping survives and posts interleave across profiles
  // instead of grouping in folder order), each rendered through the
  // shared `ProfilePostCard` adapter so the card carries the profile's
  // author identity and its `pp-` id as the anchor. Server-rendered
  // per request — a fresh order every render, no hydration mismatch.
  // Hidden posts (`visible: false`) render nowhere. The authored
  // interstitials splice into this scroll via `interleaveInterstitials`.
  const entries = interleaveInterstitials(
    shuffled(publishedProfilePostPairs(profiles)),
    interstitials
  );

  return (
    <>
      {entries.map((entry, index) =>
        entry.kind === 'interstitial' ? (
          <PostCard
            // Interstitial instances repeat down a long scroll, so the
            // React key is positional. The post id doubles as the
            // card's anchor and its like-store key, but a DOM id is
            // unique per document: only the first instance
            // (`occurrence === 0`) renders the anchor ids — repeated
            // cards are id-less clones sharing the postId domain, and
            // the share fragment keeps resolving to the first.
            key={`interstitial-${index}`}
            post={entry.item}
            anchorable={entry.occurrence === 0}
            purchaseSurfaceEnabled={purchaseSurfaceEnabled}
          >
            {entry.item.id === 'post-faq' && <FeedFaq />}
          </PostCard>
        ) : (
          <ProfilePostCard
            key={entry.item.post.id}
            profile={entry.item.profile}
            post={entry.item.post}
            purchaseSurfaceEnabled={purchaseSurfaceEnabled}
          />
        )
      )}
    </>
  );
}
