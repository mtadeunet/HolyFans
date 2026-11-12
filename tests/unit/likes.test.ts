/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - the like counter endpoint is
 * "hardened like the checkout endpoint — input caps, IP rate limiting,
 * fail-closed" and the shared count is "the sum of an authored base
 * count ... and a shared delta persisted server-side".
 *
 * Covers `lib/likes.ts`: the authored base-count map the Route Handler
 * serves when the managed store is unconfigured or unreachable, and the
 * narrow body validation that rejects malformed toggle input before any
 * store write — no Redis or framework mocking required (the same
 * route-vs-logic split as `lib/checkout-validation.ts`).
 */
import { describe, expect, it } from 'vitest';
import { FEED_POSTS } from '@/lib/feed-posts';
import {
  baseLikeCounts,
  LIKE_TOKEN_MAX_LENGTH,
  likeKey,
  parseLikeToggleBody,
} from '@/lib/likes';

describe('baseLikeCounts', () => {
  it('returns the authored base count for every FEED_POSTS id', () => {
    const counts = baseLikeCounts();
    expect(Object.keys(counts).sort()).toEqual(
      FEED_POSTS.map((post) => post.id).sort()
    );
    for (const post of FEED_POSTS) {
      expect(counts[post.id]).toBe(post.likes);
    }
  });
});

describe('likeKey', () => {
  it('builds the per-post dedup-set key', () => {
    expect(likeKey('post-hero')).toBe('likes:post-hero');
  });
});

describe('parseLikeToggleBody', () => {
  const valid = {
    postId: 'post-hero',
    token: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    liked: true,
  };

  it('accepts a well-formed toggle body', () => {
    expect(parseLikeToggleBody(valid)).toEqual(valid);
    expect(parseLikeToggleBody({ ...valid, liked: false })).toEqual({
      ...valid,
      liked: false,
    });
  });

  it('rejects non-object input', () => {
    expect(parseLikeToggleBody(null)).toBeNull();
    expect(parseLikeToggleBody('post-hero')).toBeNull();
    expect(parseLikeToggleBody(42)).toBeNull();
    expect(parseLikeToggleBody(undefined)).toBeNull();
  });

  it.each([['not-a-post'], [''], ['POST-HERO'], ['post-hero; DROP']])(
    'rejects postId %s — only real FEED_POSTS ids may name store keys',
    (postId) => {
      expect(parseLikeToggleBody({ ...valid, postId })).toBeNull();
    }
  );

  it.each(FEED_POSTS.map((post) => post.id))(
    'accepts the real post id %s',
    (postId) => {
      expect(
        parseLikeToggleBody({ ...valid, postId })
      ).not.toBeNull();
    }
  );

  it.each([[0], ['x'.repeat(LIKE_TOKEN_MAX_LENGTH + 1)]])(
    'rejects a Like Token of length %s',
    (length) => {
      expect(
        parseLikeToggleBody({ ...valid, token: 'x'.repeat(Number(length)) })
      ).toBeNull();
    }
  );

  it('rejects a Like Token at the boundary correctly', () => {
    expect(
      parseLikeToggleBody({
        ...valid,
        token: 'x'.repeat(LIKE_TOKEN_MAX_LENGTH),
      })
    ).not.toBeNull();
  });

  it.each([[null], [123], [undefined], [{}]])(
    'rejects a non-string Like Token %j',
    (token) => {
      expect(parseLikeToggleBody({ ...valid, token })).toBeNull();
    }
  );

  it.each([['true'], [1], [null], [undefined]])(
    'rejects a non-boolean liked value %j',
    (liked) => {
      expect(parseLikeToggleBody({ ...valid, liked })).toBeNull();
    }
  );
});
