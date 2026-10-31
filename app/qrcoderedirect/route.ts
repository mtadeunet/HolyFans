import { NextResponse } from 'next/server';
import { get } from '@vercel/edge-config';
import { NextRequest } from 'next/server';
import { SITE_CONFIG_KEY } from '@/lib/site-config';

const QRCODE_REDIRECT_KEY = 'qrcoderedirect';
const QRCODE_REDIRECT_DOTTED_KEY = `${SITE_CONFIG_KEY}.${QRCODE_REDIRECT_KEY}`;

type SiteConfigRecord = {
  sections?: Record<string, unknown>;
};

/**
 * Implements ADR 00-003: Permanent QR Redirect Route - "The route carries
 * `noindex` — it is a handoff artifact, not indexable content".
 *
 * Every redirect this route emits is marked `X-Robots-Tag: noindex` so the
 * handoff URL stays out of search indexes regardless of destination.
 *
 * @param url - Destination URL for the redirect.
 * @returns A `NextResponse` redirect carrying the `noindex` header.
 */
function redirectNoIndex(url: string | URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

/**
 * Implements ADR 00-003: Permanent QR Redirect Route - the permanent Route
 * Handler that "reads its destination from Site Config (Edge Config) at
 * request time and issues an HTTP redirect to it" and "MUST always resolve
 * successfully (never 404)", falling back to the site root when the
 * destination is unset or Edge Config cannot be read.
 *
 * @param request - Incoming request; the request origin builds the
 *   site-root fallback URL.
 * @returns A redirect `NextResponse` — never a 404.
 */
export async function GET(request: NextRequest) {
  const fallbackUrl = new URL('/', request.nextUrl).href;

  if (!process.env.EDGE_CONFIG) {
    return redirectNoIndex(fallbackUrl);
  }

  try {
    const dottedValue = await get(QRCODE_REDIRECT_DOTTED_KEY);
    if (typeof dottedValue === 'string' && dottedValue.trim().length > 0) {
      return redirectNoIndex(dottedValue);
    }

    const siteConfig = await get<SiteConfigRecord>(SITE_CONFIG_KEY);
    const value =
      siteConfig?.sections && typeof siteConfig.sections === 'object'
        ? siteConfig.sections[QRCODE_REDIRECT_KEY]
        : undefined;

    if (typeof value === 'string' && value.trim().length > 0) {
      return redirectNoIndex(value);
    }

    return redirectNoIndex(fallbackUrl);
  } catch (error) {
    console.error('[qrcoderedirect] Edge Config read failed:', error);
    return redirectNoIndex(fallbackUrl);
  }
}
