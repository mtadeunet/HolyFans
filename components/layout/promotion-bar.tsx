'use client';

import { track } from '@vercel/analytics';
import { useLocale, useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import ChevronGlyph from '@/components/ui/chevron-glyph';
import { useCart } from '@/context/cart-context';
import { Link, usePathname } from '@/lib/navigation';
import {
  interpolateRemaining,
  isPurchasePath,
  isVisitorNew,
  markDisplayed,
  markVisited,
  readDisplayedIds,
  readExpandedId,
  selectCampaign,
  surfaceForPathname,
  writeExpandedId,
  type PromotionCampaign,
  type PromotionTheme,
} from '@/lib/promotions';

interface PromotionBarProps {
  /** Normalized campaigns from Site Config (`promotion.campaigns`). */
  campaigns: PromotionCampaign[];
  /**
   * The Site Config free-shipping threshold in cents
   * (`shipping.freeShippingThresholdCents`) — fed to `selectCampaign`
   * for the `belowFreeShipping` condition and to the `{remaining}`
   * interpolation, so the bar's promise is the value checkout enforces.
   */
  freeShippingThresholdCents: number;
  /**
   * Fail-closed purchase-surface gate evaluated server-side per request
   * (ADR 00-004 / plan M0) — a CTA resolving to the gated `/checkout`
   * surface is suppressed, and a campaign conditioned on that surface
   * only is ineligible (ADR 03-003).
   */
  purchaseSurfaceEnabled: boolean;
}

/**
 * Client-side state read from on-device persistence on mount (never
 * during render — the server render stays a stable `null` so no
 * hydration mismatch is possible, same posture as the Cart's
 * rehydration gate).
 */
interface ClientState {
  mounted: boolean;
  visitor: 'new' | 'returning';
  /** The expanded campaign's id, or `null` while collapsed. */
  expandedId: string | null;
  /** Selection timestamp snapshot taken at mount. */
  now: Date;
}

/**
 * Implements ADR 03-003: Promotion Bar — the campaign themes, and
 * ADR 03-001: Design System — token-driven only, no raw colors.
 * `section` styles the collapsed row (the expanded block inherits its
 * palette), `panel` optionally overrides the expanded block's
 * background, and `ring` keeps `focus-visible` rings visible on the
 * theme's own background — a `surface` ring where the band itself is
 * dark or brand-colored.
 */
const THEME_CLASSES: Record<
  PromotionTheme,
  { section: string; panel: string; ring: string }
> = {
  light: {
    section: 'bg-surface text-text-primary border-b border-border',
    panel: '',
    ring: 'focus-visible:ring-primary',
  },
  dark: {
    section: 'bg-text-primary text-surface',
    panel: '',
    ring: 'focus-visible:ring-surface',
  },
  accent: {
    section: 'bg-primary text-surface',
    panel: 'bg-gradient-to-b from-primary to-accent',
    ring: 'focus-visible:ring-surface',
  },
  soft: {
    section: 'bg-primary/5 text-text-primary border-b border-primary/10',
    panel: '',
    ring: 'focus-visible:ring-primary',
  },
};

/**
 * Collapsed-row text-cycle cadence — Implements ADR 03-003: Promotion
 * Bar — "subtle transitions ... no flashing ... editorial chrome, not
 * ad-tech": each text holds for ~4s before the ~0.5s vertical slide
 * (the `animate-ticker-in`/`animate-ticker-out` keyframes in
 * globals.css); one item at a time, slow, no flashing.
 */
const CYCLE_HOLD_MS = 4000;

/**
 * Shared stacking/typography classes for the collapsed row's two
 * cycling texts. Both spans occupy the same grid cell
 * (`col-start-1 row-start-1`), so the slot is permanently sized to
 * the wider of micro-label/headline and the flanking chevrons never
 * jump; `min-w-0` + `truncate` ellipsizes an over-long string instead
 * of stretching the row. The headline adopts the row's micro-label
 * typography — one type style keeps the ticker uniform.
 */
const CYCLE_TEXT_CLASSES =
  'col-start-1 row-start-1 min-w-0 truncate text-center text-[11px] font-medium uppercase tracking-[0.2em]';

/**
 * Constrains the bar's visible content to the Feed Surface column
 * track — mirrors `FeedShell`'s `mx-auto flex justify-center` row with
 * spacer tracks matching the Nav Rail (`w-16` at `md`, `w-64` at `lg`)
 * and Suggestions Rail (`w-80` at `lg`) widths, so the copy aligns
 * vertically with the center content column on every locale route the
 * bar mounts above rather than sitting at the viewport edges. If the
 * shell's rail widths change, these spacers must change with them.
 */
function FeedColumn({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex justify-center">
      <div
        aria-hidden="true"
        className="hidden w-16 flex-shrink-0 md:block lg:w-64"
      />
      <div className="w-full max-w-xl">{children}</div>
      <div aria-hidden="true" className="hidden w-80 flex-shrink-0 lg:block" />
    </div>
  );
}

/**
 * Implements ADR 03-003: Promotion Bar — "an editorial, operator-run
 * promotion strip above all other chrome: a thin collapsed row that
 * expands in-flow" into a centered vertical offer stack (serif
 * headline → description → CTA; the campaign micro-label lives only
 * in the collapsed row) held to the Feed Surface's column track.
 *
 * Selection is delegated to `selectCampaign` in `lib/promotions.ts` and
 * re-evaluated on every render against the live context (surface from
 * the locale-stripped pathname, Cart subtotal once hydrated, and
 * visitor state from on-device persistence). The picked campaign is
 * frozen while the bar is expanded so the offer never swaps
 * mid-reading; the fresh pick applies once collapsed again.
 *
 * While collapsed, the row's visible text cycles slowly between the
 * campaign micro-label and the campaign headline — a vertical ticker
 * where the outgoing text slides up and fades while the incoming
 * rises from below, on a `CYCLE_HOLD_MS` cadence. The pair is
 * grid-stacked in one width-stable cell so the flanking chevrons
 * never jump; the cycle pauses while expanded and never runs under
 * `prefers-reduced-motion` (both pin the static micro-label), and the
 * cycling texts are `aria-hidden` — the toggle's accessible name
 * comes from its `aria-label`, not the text.
 *
 * The bar is permanent chrome while a campaign is eligible — there is
 * no dismiss control; the row toggle is the only expand/collapse
 * affordance (Escape collapses too).
 *
 * Analytics: `promo_displayed` fires once per campaign id per session;
 * `promo_expanded` / `promo_collapsed` / `promo_cta_clicked` carry
 * `{campaignId, surface}` only (ADR 00-008's privacy posture — no
 * shopper data in event payloads).
 */
export default function PromotionBar({
  campaigns,
  freeShippingThresholdCents,
  purchaseSurfaceEnabled,
}: PromotionBarProps) {
  const t = useTranslations('promotion');
  const locale = useLocale();
  const pathname = usePathname();
  const surface = surfaceForPathname(pathname);
  const { hydrated, getTotal } = useCart();
  // `null` until the Cart has rehydrated — cart-conditioned campaigns
  // fail closed in `selectCampaign`, never flashing in a frame early.
  const cartCents = hydrated ? Math.round(getTotal() * 100) : null;

  const [client, setClient] = useState<ClientState>({
    mounted: false,
    visitor: 'new',
    expandedId: null,
    now: new Date(0),
  });
  // The campaign snapshot the expanded panel is showing; `null` while
  // collapsed so a fresh selection applies on the next expand.
  const [frozen, setFrozen] = useState<PromotionCampaign | null>(null);
  const expandedRegionId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const displayedRef = useRef<Set<string>>(new Set());
  // Collapsed-row cycle state — `cycleTick` parity picks the visible
  // text (even → micro-label, odd → headline); it only advances while
  // collapsed and never under `prefers-reduced-motion`, so both of
  // those cases pin the static micro-label below.
  const [cycleTick, setCycleTick] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // One mount-time pass over on-device persistence: visitor flag is
  // read BEFORE it is marked, the expanded campaign id is restored from
  // sessionStorage, and the displayed-once-per-session set is seeded.
  useEffect(() => {
    const firstVisit = isVisitorNew();
    markVisited();
    displayedRef.current = new Set(readDisplayedIds());
    // Reading on-device storage is external-state sync — the one case
    // this rule intentionally allows (same posture as the Cart's
    // rehydration effect in cart-context).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient({
      mounted: true,
      visitor: firstVisit ? 'new' : 'returning',
      expandedId: readExpandedId(),
      now: new Date(),
    });
  }, []);

  const live = client.mounted
    ? selectCampaign(campaigns, {
        surface,
        visitor: client.visitor,
        cartCents,
        freeShippingThresholdCents,
        now: client.now,
        purchaseSurfaceEnabled,
      })
    : null;

  // Freeze the selection while expanded (restored expanded state falls
  // back to the live pick — there is no snapshot yet); `expanded` holds
  // only while the stored/restored expanded id names the selected
  // campaign, so a campaign swap never inherits an open panel.
  const selected = client.expandedId !== null ? (frozen ?? live) : live;
  const expanded = selected !== null && client.expandedId === selected.id;

  // `promo_displayed` — once per campaign id per session.
  useEffect(() => {
    if (!selected || displayedRef.current.has(selected.id)) return;
    displayedRef.current.add(selected.id);
    markDisplayed(selected.id);
    track('promo_displayed', { campaignId: selected.id, surface });
  }, [selected, surface]);

  // Expanded-state teardown — collapses the panel, clears the freeze,
  // and returns focus to the toggler; the caller adds the analytics
  // event on top.
  const resetExpanded = useCallback((): void => {
    writeExpandedId(null);
    setFrozen(null);
    setClient((prev) => ({ ...prev, expandedId: null }));
    // The expanded controls leave the tab order — return focus to the
    // toggler so keyboard users keep their place (ADR 03-003 a11y).
    toggleRef.current?.focus();
  }, [setFrozen, setClient]);

  const collapse = useCallback((): void => {
    resetExpanded();
    if (selected) {
      track('promo_collapsed', { campaignId: selected.id, surface });
    }
  }, [selected, surface, resetExpanded]);

  // Escape collapses the expanded panel (tracked like a manual collapse).
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') collapse();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, collapse]);

  // Follow OS-level `prefers-reduced-motion` changes after mount — the
  // lazy initializer above holds the mount-time value (the bar renders
  // `null` until `client.mounted`, so server and client first paints
  // can never disagree); this listener keeps the flag live.
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Implements ADR 03-003: Promotion Bar — the collapsed row cycles
  // its visible text between the micro-label and the headline on the
  // `CYCLE_HOLD_MS` cadence. The interval exists ONLY while collapsed
  // and never under `prefers-reduced-motion`; the cleanup clears it on
  // expand and on unmount, so no timer outlives its row.
  useEffect(() => {
    if (expanded || reducedMotion) return;
    const id = window.setInterval(
      () => setCycleTick((tick) => tick + 1),
      CYCLE_HOLD_MS
    );
    return () => window.clearInterval(id);
  }, [expanded, reducedMotion]);

  if (!client.mounted || !selected) return null;

  const theme = THEME_CLASSES[selected.theme];
  const copy = locale === 'en' ? selected.copy.en : selected.copy.pt;

  // {remaining} interpolation — applied only while a belowFreeShipping
  // campaign is active; its eligibility guarantees `cartCents` is set
  // and strictly below the threshold.
  const copyText = (text: string): string =>
    selected.conditions?.belowFreeShipping === true && cartCents !== null
      ? interpolateRemaining(
          text,
          Math.max(0, freeShippingThresholdCents - cartCents),
          locale
        )
      : text;

  const toggle = (): void => {
    if (expanded) {
      collapse();
      return;
    }
    writeExpandedId(selected.id);
    setFrozen(selected);
    setClient((prev) => ({ ...prev, expandedId: selected.id }));
    track('promo_expanded', { campaignId: selected.id, surface });
  };

  const ctaClicked = (): void => {
    track('promo_cta_clicked', { campaignId: selected.id, surface });
  };

  const ctaLabel = copyText(copy.ctaLabel) || t('discover');
  // Implements ADR 03-003: "the CTA is suppressed" — a campaign may
  // still render while the purchase surface is gated off, but a CTA
  // that would lead to the 404'd /checkout route is hidden.
  const ctaSuppressed =
    selected.ctaUrl !== null &&
    isPurchasePath(selected.ctaUrl) &&
    !purchaseSurfaceEnabled;

  // Collapsed-row cycle derivation — the visible text alternates only
  // in a live, collapsed, motion-allowed cycle; first paint, expanded
  // rows, and reduced-motion all pin the micro-label statically.
  // `animate-ticker-out` leaves its element parked above the slot and
  // `animate-ticker-in` always enters from below, so every flip reads
  // as one continuous upward slide regardless of cycle direction.
  const showHeadline = !expanded && cycleTick % 2 === 1;
  const cycleStill = reducedMotion || expanded || cycleTick === 0;
  const labelCycleClass = cycleStill
    ? 'opacity-100'
    : showHeadline
      ? 'animate-ticker-out'
      : 'animate-ticker-in';
  const headlineCycleClass = cycleStill
    ? 'opacity-0'
    : showHeadline
      ? 'animate-ticker-in'
      : 'animate-ticker-out';

  return (
    <section
      aria-label={t('aria_label')}
      data-testid="promotion-bar"
      className={theme.section}
    >
      {/* Collapsed row: one thin line — the campaign micro-label and
          the campaign headline cycling in a width-stable text slot
          (grid-stacked so the cell is sized to the wider string and
          the flanking `ChevronGlyph`s never jump) centered on the feed
          column's true center, so the row itself reads as the expand
          affordance. The cycle is visual only — the texts are
          `aria-hidden` and the toggle's accessible name comes from
          `aria-label`; under `prefers-reduced-motion` the slot pins
          the static micro-label. The toggle is the row's only
          control — the bar has no dedicated dismiss affordance. */}
      <FeedColumn>
        <div className="flex h-9 items-stretch">
          <button
            type="button"
            ref={toggleRef}
            data-testid="promotion-bar-toggle"
            aria-expanded={expanded}
            aria-controls={expandedRegionId}
            aria-label={expanded ? t('collapse') : t('expand')}
            onClick={toggle}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 px-4 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${theme.ring}`}
          >
            <ChevronGlyph expanded={expanded} className="h-3 w-3" />
            <span
              aria-hidden="true"
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden"
            >
              <span className={`${CYCLE_TEXT_CLASSES} ${labelCycleClass}`}>
                {copyText(copy.label)}
              </span>
              <span className={`${CYCLE_TEXT_CLASSES} ${headlineCycleClass}`}>
                {copyText(copy.headline)}
              </span>
            </span>
            <ChevronGlyph expanded={expanded} className="h-3 w-3" />
          </button>
        </div>
      </FeedColumn>

      {/* Expanded region — an in-flow grid-rows collapse so the page
          reflows smoothly; inner content is `inert` while collapsed so
          its controls stay out of the tab order. Centered vertical
          stack inside the feed column (owner-directed composition):
          serif headline, body-copy description, then the CTA — the
          campaign micro-label renders only in the collapsed row, and
          there are no side-by-side columns. */}
      <div
        id={expandedRegionId}
        data-testid="promotion-bar-expanded"
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className={`overflow-hidden ${theme.panel}`}>
          <FeedColumn>
            <div inert={!expanded} className="px-4 py-4 sm:px-6 md:py-6">
              <div className="flex flex-col items-center text-center">
                <p className="font-serif text-2xl md:text-3xl">
                  {copyText(copy.headline)}
                </p>
                {copy.description.length > 0 && (
                  <p className="mt-4 text-sm leading-relaxed opacity-80 md:text-base">
                    {copyText(copy.description)}
                  </p>
                )}
                {selected.ctaUrl &&
                  !ctaSuppressed &&
                  // External destinations open a new tab (plan M3); internal
                  // paths keep next-intl's locale-aware Link navigation.
                  (selected.ctaUrl.startsWith('https://') ? (
                    <a
                      href={selected.ctaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="promotion-bar-cta"
                      onClick={ctaClicked}
                      className={`mt-4 inline-block text-sm font-medium uppercase tracking-wide underline underline-offset-4 transition-opacity hover:opacity-70 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${theme.ring}`}
                    >
                      {ctaLabel} <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <Link
                      href={selected.ctaUrl}
                      data-testid="promotion-bar-cta"
                      onClick={ctaClicked}
                      className={`mt-4 inline-block text-sm font-medium uppercase tracking-wide underline underline-offset-4 transition-opacity hover:opacity-70 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${theme.ring}`}
                    >
                      {ctaLabel} <span aria-hidden="true">↗</span>
                    </Link>
                  ))}
              </div>
            </div>
          </FeedColumn>
        </div>
      </div>
    </section>
  );
}
