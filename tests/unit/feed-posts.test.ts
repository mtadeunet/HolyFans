/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover ...
 * message-catalog parity across Locales" and the quality gates for the
 * feed data that drives the landing composition.
 *
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - the Feed Surface is "a
 * vertical scroll of Post Cards" whose media come "from in-repo masters
 * through the framework image optimization" (ADR 00-006) and whose
 * decorative handle is "own brand only, never a third-party account
 * reference and never a link" (identifier hygiene, ADR 00-007).
 *
 * Verifies `FEED_POSTS` integrity: every post maps to a real SectionKey
 * (so Site Config toggles govern it), every image master exists on disk,
 * media/likes fields are well-formed, and the decorative handle carries
 * no URL and no third-party reference.
 */
import { existsSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { FEED_POSTS } from '@/lib/feed-posts';
import { SECTION_KEYS } from '@/lib/site-config';
import en from '@/messages/en.json';
import pt from '@/messages/pt.json';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

describe('FEED_POSTS', () => {
  it('contains at least 3 posts', () => {
    expect(FEED_POSTS.length).toBeGreaterThanOrEqual(3);
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
    'post $id carries a media descriptor and a non-negative like count',
    (post) => {
      expect(['image', 'placeholder']).toContain(post.media.kind);
      expect(typeof post.media.altKey).toBe('string');
      expect(post.media.altKey.length).toBeGreaterThan(0);
      expect(Number.isFinite(post.likes)).toBe(true);
      expect(post.likes).toBeGreaterThanOrEqual(0);
    }
  );

  it.each(FEED_POSTS.filter((post) => post.media.kind === 'image'))(
    'post $id references an image master that exists under public/',
    (post) => {
      if (post.media.kind !== 'image') return;
      expect(post.media.src.startsWith('/')).toBe(true);
      expect(existsSync(path.join(PUBLIC_DIR, post.media.src))).toBe(true);
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

describe('feed.post.handle (identifier hygiene, ADR 00-007)', () => {
  it.each([en.feed.post.handle, pt.feed.post.handle])(
    'handle "%s" is own-brand decorative text — no URL, no third-party reference',
    (handle) => {
      expect(handle).not.toMatch(/https?:|www\.|\.[a-z]{2,}\//i);
      expect(handle).toBe('@holyfans');
    }
  );
});
