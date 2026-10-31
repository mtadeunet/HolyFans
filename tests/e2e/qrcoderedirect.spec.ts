/**
 * Implements ADR 00-003: Permanent QR Redirect Route - "The route MUST
 * always resolve successfully (never 404)", "Locale-prefixed variants of
 * the path canonicalize to the bare route", and "The route carries
 * `noindex`".
 *
 * e2e contract coverage required by ADR 00-007 ("the QR Redirect Route
 * resolves to its destination and falls back safely"). Runs against the
 * production-built app via the `storefront` project. With no `EDGE_CONFIG`
 * set, every response must be the site-root fallback redirect.
 */
import { expect, test } from '@playwright/test';

test.describe('QR Redirect Route invariant', () => {
  test('GET /qrcoderedirect resolves with a redirect, never a 404', async ({
    request,
  }) => {
    const response = await request.get('/qrcoderedirect', {
      maxRedirects: 0,
    });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()['location']).toBeDefined();
  });

  test('falls back to the site root when no destination is configured', async ({
    request,
  }) => {
    const response = await request.get('/qrcoderedirect', {
      maxRedirects: 0,
    });
    const location = response.headers()['location'] ?? '';
    // Fallback target is the site root, which forwards to a Locale.
    expect(new URL(location).pathname).toBe('/');
  });

  test('carries X-Robots-Tag: noindex', async ({ request }) => {
    const response = await request.get('/qrcoderedirect', {
      maxRedirects: 0,
    });
    expect(response.headers()['x-robots-tag']).toContain('noindex');
  });

  for (const path of ['/pt/qrcoderedirect', '/en/qrcoderedirect']) {
    test(`Locale-prefixed ${path} canonicalizes to the bare route`, async ({
      request,
    }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBeGreaterThanOrEqual(300);
      expect(response.status()).toBeLessThan(400);
      // The middleware canonicalizes to a relative Location
      // (`/qrcoderedirect`); resolve it against the request URL.
      const location = response.headers()['location'] ?? '';
      expect(new URL(location, response.url()).pathname).toBe(
        '/qrcoderedirect'
      );
    });
  }
});
