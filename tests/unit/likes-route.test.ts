/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 03-004: Model Profiles — the like counter Route
 * Handler "accepts the `pp-` post-id domain in addition to the
 * authored-post ids: it validates the id format, resolves the authored
 * base count for a `pp-` id from the managed store's profile overlays
 * merged onto the folders' post files
 * ... and applies the same dedup, input caps, rate limiting, and
 * fail-closed degradation as authored posts. Only enabled profiles'
 * visible posts are served and toggled — a disabled profile's or an
 * invisible post's id holds no public count, matching the route's
 * not-found posture."
 *
 * Covers `app/api/likes/route.ts`'s `pp-` domain: the POST existence
 * check (real visible post of an enabled profile → `{count}` =
 * authored base + `SCARD` delta; unknown, hidden, or disabled-owned
 * `pp-` ids → 400; unconfigured store → 503; read failure → 502) and
 * the GET merge (enabled profiles' visible posts join the served
 * counts; hidden and disabled-owned posts are excluded; a profiles
 * read failure degrades on its own boundary and a count-read failure
 * answers the feed-only `store_failure` body). `lib/managed-store`,
 * `lib/profiles-server`, and `lib/likes-server` are mocked at the
 * module boundary — the Redis client is the true external dependency;
 * body parsing, rate limiting, and the enabled/visible filtering run
 * for real.
 *
 * The handler's rate logs are module state: each request runs from a
 * unique `x-forwarded-for` IP so cases stay isolated.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';
import { readLiveCounts } from '@/lib/likes-server';
import { baseLikeCounts, likeKey } from '@/lib/likes';
import { getManagedStore } from '@/lib/managed-store';
import type { ModelProfile } from '@/lib/profiles';
import { readProfiles } from '@/lib/profiles-server';
import { GET, POST } from '@/app/api/likes/route';

vi.mock('@/lib/managed-store', () => ({ getManagedStore: vi.fn() }));
vi.mock('@/lib/profiles-server', () => ({ readProfiles: vi.fn() }));
vi.mock('@/lib/likes-server', () => ({ readLiveCounts: vi.fn() }));

const mockedStore = vi.mocked(getManagedStore);
const mockedProfiles = vi.mocked(readProfiles);
const mockedCounts = vi.mocked(readLiveCounts);

/**
 * A fake managed store exposing only the toggle commands the handler
 * calls on it (`SADD`/`SREM`/`SCARD`/`SET`) — `readProfiles` and
 * `readLiveCounts` are mocked at the module boundary, so no read
 * commands are needed here.
 */
function makeStore() {
  return {
    sadd: vi.fn(async () => 1),
    srem: vi.fn(async () => 1),
    scard: vi.fn(async () => 4),
    set: vi.fn(async () => 'OK'),
  };
}

/** An enabled profile carrying one visible and one hidden post —
 *  the effective read shape (filesystem posts + overlay applied). */
const ENABLED_PROFILE: ModelProfile = {
  id: 'model-one',
  enabled: true,
  avatar: '/images/model-one/avatar.png',
  posts: [
    {
      id: 'pp-model-one-1',
      media: '/images/model-one/post-1.png',
      caption: { pt: 'Legenda um', en: 'Caption one' },
      likes: 7,
      visible: true,
    },
    {
      id: 'pp-model-one-2',
      media: '/images/model-one/post-2.png',
      caption: { pt: 'Legenda dois', en: 'Caption two' },
      likes: 3,
      visible: false,
    },
  ],
};

/** A disabled profile whose post holds no public count. */
const DISABLED_PROFILE: ModelProfile = {
  id: 'model-two',
  enabled: false,
  avatar: '/images/model-two/avatar.png',
  posts: [
    {
      id: 'pp-model-two-1',
      media: '/images/model-two/post-1.png',
      caption: { pt: 'Legenda', en: 'Caption' },
      likes: 9,
      visible: true,
    },
  ],
};

let ipCounter = 0;
/** A fresh client IP per request — the rate window is per-IP, so
 *  unique IPs isolate cases. */
function nextIp() {
  ipCounter += 1;
  return `10.2.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

/**
 * Build a POST `NextRequest` to `/api/likes` from a fresh client IP.
 *
 * @param body - The toggle body object, or a raw string for malformed input.
 * @returns The request the handler consumes.
 */
function makePostRequest(body: unknown): NextRequest {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new NextRequest('https://example.test/api/likes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': nextIp(),
    },
    body: raw,
  });
}

/** Build a GET `NextRequest` to `/api/likes` from a fresh client IP. */
function makeGetRequest(): NextRequest {
  return new NextRequest('https://example.test/api/likes', {
    method: 'GET',
    headers: { 'x-forwarded-for': nextIp() },
  });
}

const TOGGLE = {
  postId: 'pp-model-one-1',
  token: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  liked: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  const store = makeStore();
  mockedStore.mockReturnValue(store as unknown as Redis);
  mockedProfiles.mockResolvedValue([ENABLED_PROFILE, DISABLED_PROFILE]);
  mockedCounts.mockResolvedValue({
    'post-hero': 55,
    'pp-model-one-1': 11,
  });
});

describe('POST /api/likes — the `pp-` post-id domain (ADR 03-004)', () => {
  it('records the toggle on a real visible post of an enabled profile and answers base + delta', async () => {
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(makePostRequest(TOGGLE));
    expect(response.status).toBe(200);
    // authored base (7) + deduped delta (SCARD → 4).
    expect(await response.json()).toEqual({ count: 11 });

    expect(store.sadd).toHaveBeenCalledWith(
      likeKey('pp-model-one-1'),
      TOGGLE.token
    );
    // A genuinely new like stamps the last-like record for the Admin
    // Console's aggregate view.
    expect(store.set).toHaveBeenCalledWith(
      'likes:last:pp-model-one-1',
      expect.any(String)
    );
    expect(store.scard).toHaveBeenCalledWith(likeKey('pp-model-one-1'));
  });

  it('removes the toggle with SREM when `liked` is false — no last-like stamp', async () => {
    const store = makeStore();
    store.scard.mockResolvedValue(0);
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(makePostRequest({ ...TOGGLE, liked: false }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 7 });
    expect(store.srem).toHaveBeenCalledWith(
      likeKey('pp-model-one-1'),
      TOGGLE.token
    );
    expect(store.sadd).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it('answers 400 for a well-formed `pp-` id no stored post carries', async () => {
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(
      makePostRequest({ ...TOGGLE, postId: 'pp-model-one-9' })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    // The existence check ran against the profile records — with
    // avatar resolution and caption reads off, since the counter
    // renders neither...
    expect(mockedProfiles).toHaveBeenCalledTimes(1);
    expect(mockedProfiles).toHaveBeenCalledWith(expect.anything(), {
      resolveAvatars: false,
      readCaptions: false,
    });
    // ...and no managed-store key was minted for the unknown id.
    expect(store.sadd).not.toHaveBeenCalled();
    expect(store.srem).not.toHaveBeenCalled();
  });

  it('answers 400 for a `visible: false` post — hidden posts hold no public count', async () => {
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(
      makePostRequest({ ...TOGGLE, postId: 'pp-model-one-2' })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(store.sadd).not.toHaveBeenCalled();
  });

  it("answers 400 for a disabled profile's post — unpublished content holds no public count", async () => {
    const store = makeStore();
    mockedStore.mockReturnValue(store as unknown as Redis);

    const response = await POST(
      makePostRequest({ ...TOGGLE, postId: 'pp-model-two-1' })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(store.sadd).not.toHaveBeenCalled();
  });

  it('answers 400 for a malformed `pp-` id without touching the store', async () => {
    const response = await POST(
      makePostRequest({ ...TOGGLE, postId: 'pp-NOT A SLUG' })
    );
    expect(response.status).toBe(400);
    // `parseLikeToggleBody` rejects the id by shape — the profile
    // read never runs.
    expect(mockedProfiles).not.toHaveBeenCalled();
  });

  it('answers 503 likes_unavailable when the store is unconfigured — fail-closed (ADR 00-002)', async () => {
    mockedStore.mockReturnValue(null);

    const response = await POST(makePostRequest(TOGGLE));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'likes_unavailable' });
    expect(mockedProfiles).not.toHaveBeenCalled();
  });

  it('answers 502 when the profile-records read fails — the toggle could not be validated', async () => {
    mockedProfiles.mockRejectedValue(new Error('store unreachable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await POST(makePostRequest(TOGGLE));
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: 'likes_unavailable' });
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('GET /api/likes — profile posts in the served counts (ADR 03-004)', () => {
  it("merges enabled profiles' visible posts into the served counts", async () => {
    const response = await GET(makeGetRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.live).toBe(true);
    expect(body.counts['pp-model-one-1']).toBe(11);

    // The aggregate read skips what it never renders — avatars and
    // sidecar captions.
    expect(mockedProfiles).toHaveBeenCalledWith(expect.anything(), {
      resolveAvatars: false,
      readCaptions: false,
    });

    // Only the enabled profile's VISIBLE post reaches the count read —
    // the hidden post and the disabled profile's post are excluded
    // before `readLiveCounts` ever sees them.
    const profilePosts = mockedCounts.mock.calls[0][1];
    expect(profilePosts?.map((post) => post.id)).toEqual(['pp-model-one-1']);
  });

  it('excludes hidden posts and disabled profiles from the count read', async () => {
    await GET(makeGetRequest());
    const profilePosts = mockedCounts.mock.calls[0][1] ?? [];
    expect(profilePosts.map((post) => post.id)).not.toContain('pp-model-one-2');
    expect(profilePosts.map((post) => post.id)).not.toContain('pp-model-two-1');
  });

  it('degrades to feed-only counts and store_failure when both profile and count reads fail', async () => {
    mockedProfiles.mockRejectedValue(new Error('profiles read failed'));
    mockedCounts.mockRejectedValue(new Error('count read failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await GET(makeGetRequest());
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.live).toBe(false);
      expect(body.error).toBe('store_failure');
      // Feed-only authored bases — no `pp-` keys survived the failed
      // profiles read.
      expect(body.counts).toEqual(baseLikeCounts());
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps serving live feed counts when only the profiles read fails — its own failure boundary', async () => {
    mockedProfiles.mockRejectedValue(new Error('profiles read failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await GET(makeGetRequest());
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.live).toBe(true);
      // The count read runs with an empty profile-post domain.
      expect(mockedCounts.mock.calls[0][1]).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("answers feed-only base counts with error 'unconfigured' when no store exists", async () => {
    mockedStore.mockReturnValue(null);

    const response = await GET(makeGetRequest());
    const body = await response.json();
    expect(body).toEqual({
      counts: baseLikeCounts(),
      live: false,
      error: 'unconfigured',
    });
    expect(mockedProfiles).not.toHaveBeenCalled();
  });
});
