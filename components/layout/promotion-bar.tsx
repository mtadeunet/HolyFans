'use client';

import { track } from '@vercel/analytics';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useCart } from '@/context/cart-context';
import { Link, usePathname } from '@/lib/navigation';
import {
  dismissCampaign,
  interpolateRemaining,
  isPurchasePath,
  isVisitorNew,
  markDisplayed,
  markVisited,
  readDismissedIds,
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
  dismissedIds: string[];
  /** Selection timestamp snapshot taken at mount. */
  now: Date;
}

/**
 * Implements ADR 03-003: Promotion Bar — the campaign themes, and
 * ADR 03-001: Design System — token-driven only, no raw colors.
 * `section` styles the collapsed row (the expanded block inherits its
 * palette), `panel` optionally overrides the expanded block's
 * background, `label` is the secondary-text treatment on the expanded
 * micro-label, and `ring` keeps `focus-visible` rings visible on the
 * theme's own background — a `surface` ring where the band itself is
 * dark or brand-colored.
 */
const THEME_CLASSES: Record<
  PromotionTheme,
  { section: string; panel: string; label: string; ring: string }
> = {
  light: {
    section: 'bg-surface text-text-primary border-b border-border',
    panel: '',
    label: 'text-text-secondary',
    ring: 'focus-visible:ring-primary',
  },
  dark: {
    section: 'bg-text-primary text-surface',
    panel: '',
    label: 'opacity-70',
    ring: 'focus-visible:ring-surface',
  },
  accent: {
    section: 'bg-primary text-surface',
    panel: 'bg-gradient-to-b from-primary to-accent',
    label: 'opacity-70',
    ring: 'focus-visible:ring-surface',
  },
  soft: {
    section: 'bg-primary/5 text-text-primary border-b border-primary/10',
    panel: '',
    label: 'text-text-secondary',
    ring: 'focus-visible:ring-primary',
  },
};

/**
 * Implements ADR 03-003: Promotion Bar — "an editorial, operator-run
 * promotion strip above all other chrome: a thin collapsed row that
 * expands in-flow into a two-column editorial offer."
 *
 * Selection is delegated to `selectCampaign` in `lib/promotions.ts` and
 * re-evaluated on every render against the live context (surface from
 * the locale-stripped pathname, Cart subtotal once hydrated, dismissals
 * and visitor state from on-device persistence). The picked campaign is
 * frozen while the bar is expanded so the offer never swaps
 * mid-reading; the fresh pick applies once collapsed again.
 *
 * Analytics: `promo_displayed` fires once per campaign id per session;
 * `promo_expanded` / `promo_collapsed` / `promo_cta_clicked` /
 * `promo_dismissed` carry `{campaignId, surface}` only (ADR 00-008's
 * privacy posture — no shopper data in event payloads).
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
    dismissedIds: [],
    now: new Date(0),
  });
  // The campaign snapshot the expanded panel is showing; `null` while
  // collapsed so a fresh selection applies on the next expand.
  const [frozen, setFrozen] = useState<PromotionCampaign | null>(null);
  const expandedRegionId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const displayedRef = useRef<Set<string>>(new Set());

  // One mount-time pass over on-device persistence: visitor flag is
  // read BEFORE it is marked, the expanded campaign id is restored from
  // sessionStorage, dismissals from localStorage, and the
  // displayed-once-per-session set is seeded.
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
      dismissedIds: readDismissedIds(),
      now: new Date(),
    });
  }, []);

  const live = client.mounted
    ? selectCampaign(campaigns, {
        surface,
        visitor: client.visitor,
        cartCents,
        freeShippingThresholdCents,
        dismissedIds: client.dismissedIds,
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

  // Shared expanded-state teardown — collapse and dismiss both close the
  // panel, clear the freeze, and return focus to the toggler; callers add
  // their own persistence (dismissal merge) and analytics event on top.
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

  const dismiss = (): void => {
    dismissCampaign(selected.id);
    resetExpanded();
    setClient((prev) => ({
      ...prev,
      dismissedIds: [...prev.dismissedIds, selected.id],
    }));
    track('promo_dismissed', { campaignId: selected.id, surface });
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

  return (
    <section
      aria-label={t('aria_label')}
      data-testid="promotion-bar"
      className={theme.section}
    >
      {/* Collapsed row: one thin line — glyph + label (+headline snippet
          on sm+) on the left, the expand affordance on the right; the
          dismiss control sits beside the row-wide toggle. */}
      <div className="flex h-9 items-stretch">
        <button
          type="button"
          ref={toggleRef}
          data-testid="promotion-bar-toggle"
          aria-expanded={expanded}
          aria-controls={expandedRegionId}
          aria-label={expanded ? t('collapse') : t('expand')}
          onClick={toggle}
          className={`group flex min-w-0 flex-1 items-center justify-between gap-3 px-4 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${theme.ring}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true">✦</span>
            <span
              aria-live="polite"
              className="truncate text-[11px] font-medium uppercase tracking-[0.2em]"
            >
              {copyText(copy.label)}
            </span>
            <span className="hidden truncate text-[11px] opacity-70 sm:inline">
              {copyText(copy.headline)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-[0.2em]">
            {ctaLabel}
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
            >
              ↗
            </span>
          </span>
        </button>
        <button
          type="button"
          data-testid="promotion-bar-dismiss"
          aria-label={t('dismiss')}
          onClick={dismiss}
          className={`shrink-0 px-3 text-xs opacity-70 transition-opacity hover:opacity-100 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${theme.ring}`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      {/* Expanded region — an in-flow grid-rows collapse so the page
          reflows smoothly; inner content is `inert` while collapsed so
          its controls stay out of the tab order. Two-column editorial
          composition per ADR 03-003: label + headline left, description
          + CTA right; stacked on the small-viewport baseline. */}
      <div
        id={expandedRegionId}
        data-testid="promotion-bar-expanded"
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className={`overflow-hidden ${theme.panel}`}>
          <div
            inert={!expanded}
            className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14"
          >
            <button
              type="button"
              aria-label={t('close')}
              onClick={collapse}
              className={`absolute right-4 top-4 px-2 text-sm opacity-70 transition-opacity hover:opacity-100 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${theme.ring}`}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <p
                  className={`text-[11px] uppercase tracking-[0.2em] ${theme.label}`}
                >
                  {copyText(copy.label)}
                </p>
                <p className="mt-3 font-serif text-2xl md:text-3xl">
                  {copyText(copy.headline)}
                </p>
              </div>
              <div className="md:justify-self-end">
                {copy.description.length > 0 && (
                  <p className="text-sm leading-relaxed opacity-80 md:text-base">
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
          </div>
        </div>
      </div>
    </section>
  );
}
