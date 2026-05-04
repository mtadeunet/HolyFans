import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './lib/i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
});

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

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const normalizedPath = pathname.endsWith('/') && pathname !== '/'
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

  const localeRedirectRegex = new RegExp(
    `^/(?:${locales.join('|')})/qrcoderedirect$`
  );
  if (localeRedirectRegex.test(normalizedPath)) {
    return NextResponse.redirect(new URL('/qrcoderedirect', request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
