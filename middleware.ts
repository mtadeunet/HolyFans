import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale, type Locale } from './lib/i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
});

/**
 * ISO alpha-2 codes of the lusophone (Portuguese-speaking) countries:
 * Portugal, Brazil, Angola, Mozambique, Cabo Verde, Guinea-Bissau,
 * São Tomé and Príncipe, Timor-Leste, Equatorial Guinea, and Macau.
 * Compared uppercase; geo headers are normalized before lookup.
 */
const LUSOPHONE_COUNTRIES: ReadonlySet<string> = new Set([
  'PT',
  'BR',
  'AO',
  'MZ',
  'CV',
  'GW',
  'ST',
  'TL',
  'GQ',
  'MO',
]);

function unauthorizedResponse() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="HolyFans Admin", charset="UTF-8"',
    },
  });
}

function checkBasicAuth(header: string | null): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    // Fail closed: if no password configured, deny access in production.
    // In dev we also deny to avoid accidental exposure.
    return false;
  }
  if (!header || !header.toLowerCase().startsWith('basic ')) return false;
  try {
    const encoded = header.slice(6).trim();
    const decoded =
      typeof atob === 'function'
        ? atob(encoded)
        : Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) return false;
    const password = decoded.slice(separatorIndex + 1);
    return password === expected;
  } catch {
    return false;
  }
}

/**
 * Request pipeline, in order:
 * 1. `/admin*` — Basic-auth gate, fail closed (never reaches i18n).
 * 2. `/qrcoderedirect`, `/api*` — locale-neutral early returns.
 * 3. `/[locale]/qrcoderedirect` — stripped back to the locale-neutral route.
 * 4. Geo detection — a present `x-vercel-ip-country` on a non-prefixed path
 *    routes lusophone countries into the `pt` tree and every other
 *    geolocated country into `en` (see inline ADR stamp); an absent header
 *    falls through.
 * 5. `intlMiddleware` — prefix routing + Accept-Language detection for
 *    everything else, defaulting to the `pt` Primary Locale.
 */
export default function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const normalizedPath =
    pathname.endsWith('/') && pathname !== '/'
      ? pathname.slice(0, -1)
      : pathname;

  if (normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')) {
    if (!checkBasicAuth(request.headers.get('authorization'))) {
      return unauthorizedResponse();
    }
    return NextResponse.next();
  }

  if (normalizedPath === '/qrcoderedirect') {
    return NextResponse.next();
  }

  // The checkout Route Handler (ADR 00-002's enumerated dynamic surface)
  // lives outside the Locale trees: `/api/*` must reach it directly —
  // running intlMiddleware here would locale-prefix the POST.
  if (normalizedPath === '/api' || normalizedPath.startsWith('/api/')) {
    return NextResponse.next();
  }

  const localeRedirectRegex = new RegExp(
    `^/(?:${locales.join('|')})/qrcoderedirect$`
  );
  if (localeRedirectRegex.test(normalizedPath)) {
    return NextResponse.redirect(new URL('/qrcoderedirect', request.url));
  }

  // Implements ADR 00-005: Internationalization — "The site root resolves the
  // visitor's Locale ... defaulting to `pt` — the primary market's Locale."
  // Vercel's `x-vercel-ip-country` geo header (ISO alpha-2) routes visitors
  // into a Locale tree ahead of browser-language detection: lusophone
  // countries go to `pt`, every other geolocated country to `en`, and an
  // absent header (local dev, non-Vercel hosts) falls through to
  // intlMiddleware's Accept-Language detection and `pt` default. Only
  // non-prefixed paths qualify — already-prefixed URLs express an explicit
  // Locale choice (per the same ADR) and must not be overridden.
  const hasLocalePrefix = locales.some(
    (locale) =>
      normalizedPath === `/${locale}` ||
      normalizedPath.startsWith(`/${locale}/`)
  );
  const geoCountry = request.headers.get('x-vercel-ip-country')?.toUpperCase();
  if (!hasLocalePrefix && geoCountry !== undefined) {
    const geoLocale: Locale = LUSOPHONE_COUNTRIES.has(geoCountry)
      ? defaultLocale
      : 'en';
    const geoRedirectUrl = request.nextUrl.clone();
    geoRedirectUrl.pathname =
      normalizedPath === '/'
        ? `/${geoLocale}`
        : `/${geoLocale}${normalizedPath}`;
    return NextResponse.redirect(geoRedirectUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
