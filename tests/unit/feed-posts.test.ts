/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover ...
 * message-catalog parity across Locales" and the quality gates for the
 * feed data that drives the landing composition.
 *
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - the Feed Surface's body is
 * "the profile post scroll" into which "the surviving authored units
 * are inserted as interstitials ... one interstitial per every three
 * profile posts, cycling through the section-enabled set in authored
 * order"; media come "from in-repo masters through the framework image
 * optimization" (ADR 00-006) and the decorative handle is "own brand
 * only, never a third-party account reference and never a link"
 * (identifier hygiene, ADR 00-007).
 *
 * Verifies `FEED_POSTS` integrity: the authored registry carries exactly
 * the two surviving interstitial units in authored order, every post
 * maps to a real SectionKey (so Site Config toggles govern it), each
 * media descriptor — present only on posts carrying imagery —
 * references an image master that exists on disk, like counts are
 * well-formed, and the decorative handle carries no URL and no
 * third-party reference. Also covers `interleaveInterstitials`, the pure
 * splice the scroll composition is built on.
 */
import { existsSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { FEED_POSTS, interleaveInterstitials } from '@/lib/feed-posts';
import { SECTION_KEYS } from '@/lib/site-config';
import en from '@/messages/en.json';
import pt from '@/messages/pt.json';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

describe('FEED_POSTS', () => {
  // Implements ADR 03-002 - "the authored Post Card registry carries
  // only two units, the limited-edition product unit and the FAQ
  // island", in the authored order the insertion cycle hands out.
  it('carries exactly the surviving interstitial units in authored order', () => {
    expect(FEED_POSTS.map((post) => post.id)).toEqual([
      'post-closing',
      'post-faq',
    ]);
  });

  // Implements ADR 03-002 - the limited-edition unit "inherits the
  // `products` navigation anchor alias from the retired leading product
  // unit" so the Shop nav entry still lands: the text-only final-CTA
  // card is the purchase call-to-action the alias resolves to.
  it('keeps the products anchor alias on the limited-edition unit', () => {
    const product = FEED_POSTS.find((post) => post.id === 'post-closing');
    expect(product?.anchorAlias).toBe('products');
  });

  it('uses unique post ids', () => {
    const ids = FEED_POSTS.map((post) => post.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(FEED_POSTS.map((post) => [post.id, post.section] as const))(
    'post %s maps to a valid SectionKey',
    (_id, section) => {
      expect(SECTION_KEYS).toContain(section);
    }
  );

  it.each(FEED_POSTS)(
    'post $id carries a non-negative like count',
    (post) => {
      expect(Number.isFinite(post.likes)).toBe(true);
      expect(post.likes).toBeGreaterThanOrEqual(0);
    }
  );

  // Implements ADR 03-002's Imagery rule — posts without an in-repo
  // master carry no media descriptor and render no Media Slot: both
  // surviving authored units are text-only (the limited-edition
  // final-CTA card and the FAQ island), so the registry holds no media
  // descriptors at all.
  it('carries no media descriptors — the surviving authored units are all text-only', () => {
    expect(FEED_POSTS.every((post) => post.media === undefined)).toBe(true);
  });

  it.each(
    FEED_POSTS.flatMap((post) =>
      post.media ? ([[post.id, post.media]] as const) : []
    )
  )(
    'post %s carries a media descriptor referencing an image master that exists under public/',
    (_id, media) => {
      expect(media.src.startsWith('/')).toBe(true);
      expect(existsSync(path.join(PUBLIC_DIR, media.src))).toBe(true);
      expect(typeof media.altKey).toBe('string');
      expect(media.altKey.length).toBeGreaterThan(0);
    }
  );

  it.each(FEED_POSTS)(
    'post $id has a caption message key in both Locales',
    (post) => {
      const posts = en.feed.posts as Record<string, { caption: string }>;
      const postsPt = pt.feed.posts as Record<string, { caption: string }>;
      expect(posts[post.captionKey]?.caption).toBeTruthy();
      expect(postsPt[post.captionKey]?.caption).toBeTruthy();
    }
  );
});

// Implements ADR 03-002 - "the scroll inserts one interstitial per
// every three profile posts, cycling through the section-enabled set in
// authored order ... an interstitial whose section toggle is off leaves
// the cycle".
describe('interleaveInterstitials', () => {
  const specials = [{ id: 'special-a' }, { id: 'special-b' }];
  const posts = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => `p${i + 1}`);

  /** Map the tagged entries back to plain ids for order assertions. */
  const ids = (
    entries: ReturnType<
      typeof interleaveInterstitials<string, { id: string }>
    >
  ): string[] =>
    entries.map((entry) =>
      entry.kind === 'post' ? entry.item : entry.item.id
    );

  it('returns the scroll unchanged when there are no interstitials', () => {
    expect(ids(interleaveInterstitials(posts(5), []))).toEqual(posts(5));
  });

  it('returns the scroll unchanged when fewer than three posts precede the first slot', () => {
    expect(ids(interleaveInterstitials(posts(2), specials))).toEqual(
      posts(2)
    );
  });

  // Implements ADR 03-002 - the stride is fixed at one interstitial
  // per every three profile posts; it is an ADR constant, not a
  // parameter.
  it('inserts the first interstitial after the third post', () => {
    expect(ids(interleaveInterstitials(posts(3), specials))).toEqual([
      'p1',
      'p2',
      'p3',
      'special-a',
    ]);
  });

  it('cycles the interstitial set in authored order around the scroll', () => {
    expect(ids(interleaveInterstitials(posts(9), specials))).toEqual([
      'p1',
      'p2',
      'p3',
      'special-a',
      'p4',
      'p5',
      'p6',
      'special-b',
      'p7',
      'p8',
      'p9',
      'special-a',
    ]);
  });

  it('runs a single-interstitial cycle when only one unit is section-enabled', () => {
    expect(
      ids(interleaveInterstitials(posts(6), [{ id: 'special-a' }]))
    ).toEqual([
      'p1',
      'p2',
      'p3',
      'special-a',
      'p4',
      'p5',
      'p6',
      'special-a',
    ]);
  });

  it('tags every entry so scroll posts and interstitials stay distinguishable', () => {
    const entries = interleaveInterstitials(posts(3), specials);
    expect(entries.map((entry) => entry.kind)).toEqual([
      'post',
      'post',
      'post',
      'interstitial',
    ]);
  });

  // The DOM-id uniqueness rule: each interstitial entry carries the
  // 0-based count of its post id's instances so far — the renderer
  // gives the anchor ids to `occurrence === 0` only, and later
  // instances render as id-less clones.
  it('numbers each interstitial instance per post id, 0-based', () => {
    const interstitials = interleaveInterstitials(posts(9), specials).filter(
      (entry) => entry.kind === 'interstitial'
    );
    expect(
      interstitials.map((entry) => [entry.item.id, entry.occurrence])
    ).toEqual([
      ['special-a', 0],
      ['special-b', 0],
      ['special-a', 1],
    ]);
  });
});

describe('feed.post.handle (identifier hygiene, ADR 00-007)', () => {
  it.each([en.feed.post.handle, pt.feed.post.handle])(
    'handle "%s" is own-brand decorative text — no URL, no third-party reference',
    (handle) => {
      expect(handle).not.toMatch(/https?:|www\.|\.[a-z]{2,}\//i);
      expect(handle).toBe('@holyfans');
    }
  );
});
