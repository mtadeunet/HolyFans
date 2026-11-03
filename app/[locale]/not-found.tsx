import NotFoundContent from '@/components/ui/not-found-content';

/**
 * Locale-scoped not-found boundary.
 *
 * Implements ADR 00-005: Internationalization - each Locale is a complete
 * page tree, so a 404 inside `/pt/*` or `/en/*` must render in that
 * Locale rather than in a locale-neutral fallback.
 *
 * Catches every unmatched URL under the `[locale]` segment — including
 * `notFound()` thrown by the gated checkout page — and renders the shared
 * `NotFoundContent`, which resolves the request Locale from the matched
 * `[locale]` segment.
 */
export default function NotFound() {
  return <NotFoundContent />;
}
