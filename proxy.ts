import {NextRequest} from 'next/server';
import createMiddleware from 'next-intl/middleware';
import {routing} from '@/lib/routing';

const intlMiddleware = createMiddleware({
  ...routing,
  // Explicitly set the default locale
  defaultLocale: 'pt',
  // Force the default locale for the root path
  localeDetection: false
});

export default function middleware(request: NextRequest) {
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
