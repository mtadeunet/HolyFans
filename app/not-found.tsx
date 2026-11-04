import NotFoundContent from '@/components/ui/not-found-content';

/**
 * Root not-found boundary.
 *
 * Renders for routes that miss every page outside the `[locale]` tree
 * (e.g. unmatched `/admin/*` paths after auth, or edge cases bypassing the
 * intl middleware redirect). Locale-aware 404s inside the storefront are
 * handled by `app/[locale]/not-found.tsx`; here the request Locale falls
 * back to the `pt` Primary Locale when none is resolvable (ADR 00-005).
 * The document (`<html>`/`<body>`) comes from `app/layout.tsx`.
 */
export default function NotFound() {
  return <NotFoundContent />;
}
