import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['pt', 'en'],

  // Used when no locale matches
  defaultLocale: 'pt',
  
  // Explicitly set the locale detection strategy
  localePrefix: 'always'
});

// Persistent layouts
export const {Link, redirect, usePathname, useRouter} = createNavigation(routing);
