/**
 * Shared down-pointing disclosure chevron — the expand/collapse glyph
 * used by the Promotion Bar's collapsed row and the Feed FAQ's
 * disclosure buttons — defined once so the affordance reads identically
 * on every surface.
 *
 * Implements ADR 03-003: Promotion Bar — "transitions, honor
 * `prefers-reduced-motion`, and carry no flashing, rotating, or
 * banner-style motion — the unit reads as editorial chrome, not
 * ad-tech": the `rotate-180` state flip is the only motion, and
 * `motion-reduce` strips it.
 *
 * Provider-free and directive-free: no hooks or client-only APIs, so it
 * can render inside both Server and Client Components.
 *
 * @param expanded - `true` rotates the chevron 180° to its
 *   disclosure-open, pointing-up state.
 * @param className - Sizing/color classes applied to the `<svg>`; the
 *   path uses `stroke="currentColor"`, so text-color classes tint it.
 * @returns The chevron `<svg>` element, hidden from assistive technology.
 */
export default function ChevronGlyph({
  expanded,
  className,
}: {
  expanded: boolean;
  className?: string;
}) {
  const classes = [
    'shrink-0 transition-transform duration-300 motion-reduce:transition-none',
    expanded ? 'rotate-180' : '',
    className ?? '',
  ]
    .join(' ')
    .trim();
  return (
    <svg
      aria-hidden="true"
      className={classes}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}
