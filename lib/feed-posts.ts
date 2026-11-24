import type { SectionKey } from './site-config';

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "the authored Post Card
 * registry carries only two units, the limited-edition product unit and
 * the FAQ island, and the scroll inserts one interstitial per every
 * three profile posts, cycling through the section-enabled set in
 * authored order."
 *
 * The authored interstitial set — NOT the feed body: the landing's
 * scroll body is the enabled profiles' visible posts, shuffled per
 * request (ADR 03-004), and these entries are spliced into it. Content
 * is code-managed alongside Product Data (ADR 00-001's content model).
 * Each entry maps to exactly one SectionKey so the existing Site Config
 * section toggles keep governing it — a toggled-off interstitial leaves
 * the insertion cycle entirely.
 *
 * Neither surviving unit carries imagery — the limited-edition unit is
 * the text-only final-CTA card and the FAQ island's content domain has
 * no in-repo master — so the registry holds no media descriptors and
 * both render no Media Slot (ADR 03-002's Imagery rule).
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

/** One authored interstitial Post Card entry — a surviving feed unit
 *  spliced into the profile-post scroll, not a body item of it. */
export interface FeedPost {
  /** Stable id; the Post Card renders it as the anchor `id="post-<…>"`
   *  and the like counter keys its managed-store records on it. */
  id: string;
  /** Optional legacy section anchor the Post Card additionally exposes
   *  (e.g. `#products` on the surviving limited-edition interstitial)
   *  for continuity with the pre-restyle anchor convention. */
  anchorAlias?: string;
  /** Site Config section toggle governing this interstitial (ADR
   *  03-002's semantic remap — the key set is unchanged so stored
   *  configs keep working; a toggle whose content domain left the
   *  landing governs nothing in the feed). */
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
 * Implements ADR 03-002: Landing Page Composition — the surviving
 * authored units, "the limited-edition product unit and the FAQ island",
 * in authored order — the order the insertion cycle hands them out. The
 * limited-edition unit is the text-only final-CTA card (`post-closing`,
 * governed by the `finalCta` section toggle): it leads the cycle and
 * carries the `products` anchor alias inherited from the retired leading
 * product unit so the Shop navigation entry still lands on the purchase
 * call-to-action. Neither surviving unit carries imagery — the registry
 * holds no media descriptors (ADR 03-002's Imagery rule).
 */
export const FEED_POSTS: FeedPost[] = [
  {
    id: 'post-closing',
    anchorAlias: 'products',
    section: 'finalCta',
    captionKey: 'post-closing',
    likes: 203,
  },
  {
    id: 'post-faq',
    section: 'faq',
    captionKey: 'post-faq',
    likes: 54,
  },
];

/**
 * One entry of the composed feed scroll: `post` wraps a scroll-body item
 * (a shuffled profile post pair), `interstitial` wraps an authored unit
 * of `FEED_POSTS`. The discriminant keeps the two domains
 * distinguishable at render — they adapt onto the Post Card through
 * different props. `occurrence` is the interstitial instance's 0-based
 * count per post id: the scroll repeats the same authored units down
 * its length, and the count separates the first — the only
 * DOM-addressable — instance from the id-less clones after it.
 */
export type FeedScrollEntry<P, I> =
  | { kind: 'post'; item: P }
  | { kind: 'interstitial'; item: I; occurrence: number };

/**
 * Implements ADR 03-002: Landing Page Composition — the insertion
 * stride is fixed at "one interstitial per every three profile posts";
 * it is an ADR constant, not a parameter.
 */
const INTERSTITIAL_STRIDE = 3;

/**
 * Implements ADR 03-002: Landing Page Composition — "the scroll inserts
 * one interstitial per every three profile posts, cycling through the
 * section-enabled set in authored order — the limited-edition unit, the
 * FAQ island, and around again; an interstitial whose section toggle is
 * off leaves the cycle."
 *
 * Splice the section-enabled interstitials into the profile-post scroll:
 * after every third scroll post the next interstitial in authored order
 * is appended, wrapping around so the two-unit set cycles for as long
 * as the scroll runs. The same interstitial therefore renders
 * repeatedly down a long scroll. Each instance keeps its post id as
 * the like-store key and share fragment, but a DOM `id` is unique per
 * document — the entry's `occurrence` is the 0-based instance count
 * for that interstitial id, and the uniqueness rule is that only the
 * first instance (`occurrence === 0`) is addressable: it alone renders
 * the anchor `id`s so the nav anchor and the share fragment resolve to
 * it, while later instances are id-less clones sharing the postId
 * domain. Fewer than three scroll posts — or an empty interstitial
 * set — yields the scroll unchanged.
 *
 * @param posts - The scroll body (the shuffled published profile post
 *   pairs).
 * @param interstitials - The section-enabled authored units, in
 *   authored order — section filtering is the caller's job so this
 *   helper stays pure over its inputs. Interstitial items carry a
 *   stable `id` the occurrence counter keys on.
 * @returns The tagged scroll entries in render order.
 */
export function interleaveInterstitials<P, I extends { id: string }>(
  posts: readonly P[],
  interstitials: readonly I[]
): FeedScrollEntry<P, I>[] {
  const out: FeedScrollEntry<P, I>[] = [];
  // Per-interstitial-id instance counter — feeds each entry's
  // `occurrence` so the renderer can tell the addressable first
  // instance from the repeated id-less clones.
  const occurrences = new Map<string, number>();
  let cursor = 0;
  posts.forEach((post, index) => {
    out.push({ kind: 'post', item: post });
    // After every third scroll post the cycle hands out the next
    // interstitial in authored order, wrapping at the end of the set.
    if (
      (index + 1) % INTERSTITIAL_STRIDE === 0 &&
      interstitials.length > 0
    ) {
      const item = interstitials[cursor % interstitials.length];
      const occurrence = occurrences.get(item.id) ?? 0;
      occurrences.set(item.id, occurrence + 1);
      out.push({ kind: 'interstitial', item, occurrence });
      cursor += 1;
    }
  });
  return out;
}
