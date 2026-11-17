/**
 * Implements ADR 00-005: Internationalization — "The site root resolves the
 * visitor's Locale ... defaulting to `pt` — the primary market's Locale."
 *
 * Covers the middleware request pipeline: locale-neutral early returns
 * (`/admin`, `/qrcoderedirect`, `/api`), geo routing on non-prefixed
 * paths — `x-vercel-ip-country` in the lusophone set goes to `pt`, any
 * other geolocated country goes to `en` — and the fall-through to
 * next-intl's Accept-Language detection when the geo header is absent.
 */
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from '@/middleware';

const BASE_URL = 'https://example.com';

/**
 * Builds a `NextRequest` for `path` against a synthetic host.
 *
 * @param path - Path (optionally with query string) to request.
 * @param headers - Request headers to attach; pass
 *   `x-vercel-ip-country` to simulate Vercel geo detection.
 * @returns A `NextRequest` the middleware can consume.
 */
function makeRequest(
  path: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(new URL(path, BASE_URL), { headers });
}

/**
 * Extracts the redirect target pathname (plus query) from a middleware
 * response, or `null` when the response is not a redirect.
 */
function redirectTarget(response: Response): string | null {
  const location = response.headers.get('location');
  return location === null
    ? null
    : new URL(location).pathname + new URL(location).search;
}

describe('middleware geo detection (x-vercel-ip-country)', () => {
  it.each(['PT', 'BR', 'MZ'])(
    'redirects lusophone geo %s on / to /pt',
    (country) => {
      const response = middleware(
        makeRequest('/', { 'x-vercel-ip-country': country })
      );
      expect(redirectTarget(response)).toBe('/pt');
    }
  );

  it.each(['US', 'GB', 'FR'])(
    'redirects non-lusophone geo %s on / to /en',
    (country) => {
      const response = middleware(
        makeRequest('/', { 'x-vercel-ip-country': country })
      );
      expect(redirectTarget(response)).toBe('/en');
    }
  );

  it('redirects PT geo on a non-prefixed path to the pt-prefixed equivalent', () => {
    const response = middleware(
      makeRequest('/faq', { 'x-vercel-ip-country': 'PT' })
    );
    expect(redirectTarget(response)).toBe('/pt/faq');
  });

  it('redirects US geo on a non-prefixed path to the en-prefixed equivalent', () => {
    const response = middleware(
      makeRequest('/faq', { 'x-vercel-ip-country': 'US' })
    );
    expect(redirectTarget(response)).toBe('/en/faq');
  });

  it('lets non-lusophone geo override Accept-Language entirely', () => {
    const response = middleware(
      makeRequest('/', {
        'x-vercel-ip-country': 'US',
        'accept-language': 'pt',
      })
    );
    // A present geo header wins over browser-language detection.
    expect(redirectTarget(response)).toBe('/en');
  });

  it('preserves the query string on the pt geo redirect', () => {
    const response = middleware(
      makeRequest('/?utm_source=test', { 'x-vercel-ip-country': 'PT' })
    );
    expect(redirectTarget(response)).toBe('/pt?utm_source=test');
  });

  it('preserves the query string on the en geo redirect', () => {
    const response = middleware(
      makeRequest('/?utm_source=test', { 'x-vercel-ip-country': 'US' })
    );
    expect(redirectTarget(response)).toBe('/en?utm_source=test');
  });

  it('matches the country code case-insensitively', () => {
    const response = middleware(
      makeRequest('/', { 'x-vercel-ip-country': 'pt' })
    );
    expect(redirectTarget(response)).toBe('/pt');
  });

  it('falls through to intlMiddleware when the header is absent', () => {
    const response = middleware(makeRequest('/', { 'accept-language': 'en' }));
    expect(redirectTarget(response)).toBe('/en');
  });

  it('does not override an explicit locale prefix', () => {
    const response = middleware(
      makeRequest('/en/faq', { 'x-vercel-ip-country': 'PT' })
    );
    // Already-prefixed path passes through intlMiddleware (rewrite, not
    // redirect) — the visitor's explicit Locale choice stands.
    expect(redirectTarget(response)).toBeNull();
  });
});

describe('middleware early returns are unaffected by geo detection', () => {
  it('keeps /admin fail-closed even with PT geo', () => {
    const response = middleware(
      makeRequest('/admin', { 'x-vercel-ip-country': 'PT' })
    );
    expect(response.status).toBe(401);
  });

  it('passes /api/* through without a locale redirect', () => {
    const response = middleware(
      makeRequest('/api/checkout', { 'x-vercel-ip-country': 'PT' })
    );
    expect(redirectTarget(response)).toBeNull();
  });

  it('still strips the locale prefix from /[locale]/qrcoderedirect', () => {
    const response = middleware(
      makeRequest('/pt/qrcoderedirect', { 'x-vercel-ip-country': 'PT' })
    );
    expect(redirectTarget(response)).toBe('/qrcoderedirect');
  });
});
