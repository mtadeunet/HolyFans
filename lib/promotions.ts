import { formatPrice } from './utils';

/**
 * Implements ADR 03-003: Promotion Bar — the Promotion Campaign model,
 * its normalization onto Site Config, the selection rules the Promotion
 * Bar applies per render, and the on-device persistence keys the bar's
 * visitor/expanded state lives under.
 *
 * This module is deliberately isomorphic-pure: no 'use client', no
 * browser API touched at module level — every storage access is guarded
 * inside a function body so Site Config normalization can import it from
 * server code. It must NOT import `site-config.ts` (Site Config imports
 * this module — the dependency runs one way to avoid a cycle); the free
 * shipping threshold therefore reaches `selectCampaign` through its
 * context argument, resolved by the caller from Site Config.
 */

/** Where a Promotion Campaign may appear: the landing feed, the purchase surface, or classic-chrome routes. */
export type PromotionSurface = 'feed' | 'purchase' | 'classic';

/** Visitor targeting: `'any'` (or an absent condition) matches everyone. */
export type PromotionVisitor = 'new' | 'returning' | 'any';

/**
 * Bar theme — `light` renders as a white band, `dark` near-black with
 * white text, `accent` a brand-blue banner, `soft` a quiet primary
 * wash. All are token-driven (ADR 03-001).
 */
export type PromotionTheme = 'light' | 'dark' | 'accent' | 'soft';

/** Editorial campaign kinds — presentation hints for the operator, no behavioral difference in v1. */
export type PromotionType = 'editorial' | 'discount' | 'seasonal' | 'exclusive';

/** The schema's allowed value lists — the single source of truth shared by normalization and the Admin Console selects. */
export const PROMOTION_SURFACES: readonly PromotionSurface[] = [
  'feed',
  'purchase',
  'classic',
];
export const PROMOTION_VISITORS: readonly PromotionVisitor[] = [
  'new',
  'returning',
  'any',
];
export const PROMOTION_THEMES: readonly PromotionTheme[] = [
  'light',
  'dark',
  'accent',
  'soft',
];
export const PROMOTION_TYPES: readonly PromotionType[] = [
  'editorial',
  'discount',
  'seasonal',
  'exclusive',
];

/**
 * Campaign ids become on-device storage values and analytics payloads —
 * restrict them to lowercase slugs so operator-entered ids can never
 * inject whitespace, unicode, or control characters into those
 * surfaces.
 */
export const CAMPAIGN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Localized copy block — one per Locale; `label` and `headline` are required, the rest may be empty. */
export interface PromotionCopy {
  label: string;
  headline: string;
  description: string;
  ctaLabel: string;
}

/**
 * Eligibility conditions; every field is optional and every absent field
 * means "no constraint". Cart-dependent conditions require a hydrated
 * Cart (`cartCents !== null`) to ever match — they fail closed while the
 * Cart is still rehydrating.
 */
export interface PromotionConditions {
  /** Surfaces the campaign may appear on; absent = all surfaces. */
  surfaces?: PromotionSurface[];
  /** Visitor targeting; absent or `'any'` = everyone. */
  visitor?: PromotionVisitor;
  /** Cart subtotal (cents) must be >= this value; requires a hydrated Cart. */
  minCartCents?: number;
  /** Cart has items AND subtotal < the Site Config free-shipping threshold. */
  belowFreeShipping?: boolean;
}

/**
 * One Promotion Campaign as stored in Site Config (`promotion.campaigns`).
 * `promoCode` is RESERVED — it is validated into the schema so documents
 * stay forward-compatible, but nothing renders it in v1.
 */
export interface PromotionCampaign {
  id: string;
  type: PromotionType;
  priority: number;
  enabled: boolean;
  /** ISO 8601 timestamp or `null` = unbounded. */
  startDate: string | null;
  endDate: string | null;
  theme: PromotionTheme;
  /** Locale-neutral path (e.g. `'/checkout'`, `'/#products'`); `null` = no CTA. */
  ctaUrl: string | null;
  /** RESERVED — validated in schema, NOT rendered in v1. */
  promoCode: string | null;
  conditions: PromotionConditions | null;
  copy: { pt: PromotionCopy; en: PromotionCopy };
}

/**
 * Implements ADR 03-003: Promotion Bar — "a disabled-by-conditions
 * campaign leaves the always-on editorial fallback". One always-on
 * editorial campaign (`priority: 0`, no conditions, no schedule) so the
 * bar always has tasteful own-brand content when no timed campaign is
 * running. Copy is placeholder own-brand text in both Locales — no
 * real-world identifiers (ADR 00-007).
 */
export const DEFAULT_CAMPAIGNS: PromotionCampaign[] = [
  {
    id: 'the-extra-edit',
    type: 'editorial',
    priority: 0,
    enabled: true,
    startDate: null,
    endDate: null,
    theme: 'dark',
    ctaUrl: '/#products',
    promoCode: null,
    conditions: null,
    copy: {
      pt: {
        label: 'UM EXTRA PARA SI',
        headline: 'Uma pequena recompensa, só para si.',
        description:
          'Descubra a peça pensada para durar — uma edição limitada, feita com cuidado do primeiro fio ao último acabamento.',
        ctaLabel: 'Descobrir',
      },
      en: {
        label: 'A LITTLE EXTRA FOR YOU',
        headline: 'A little reward, just for you.',
        description:
          'Discover the piece made to last — a limited edition, crafted with care from the first thread to the final finish.',
        ctaLabel: 'Discover',
      },
    },
  },
];

/** Narrow an unknown value to a non-empty string, else `null`. */
function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Narrow an unknown value to a member of `allowed`, else `null`. */
function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  return typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/** Accept a string holding a parseable date; everything else becomes `null`. */
function asIsoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

/**
 * Implements ADR 03-003: "validation must keep it to internal paths or
 * absolute `https` URLs" — a CTA destination is an internal path
 * (`/...`, never protocol-relative `//`) or an absolute `https://` URL;
 * anything else (`javascript:`, `http:`, relative, garbage) is dropped
 * to `null` so a hand-edited config can never inject a hostile or
 * broken link into visitor chrome.
 */
function asCtaUrlOrNull(value: unknown): string | null {
  const url = asNonEmptyString(value);
  if (url === null) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('https://')) return url;
  return null;
}

/**
 * Validate one locale copy block. `label` and `headline` must be
 * non-empty strings; `description`/`ctaLabel` coerce to `''` when absent
 * so partially-filled operator entries still normalize.
 */
function normalizeCopy(raw: unknown): PromotionCopy | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const label = asNonEmptyString(source.label);
  const headline = asNonEmptyString(source.headline);
  if (!label || !headline) return null;
  return {
    label,
    headline,
    description:
      typeof source.description === 'string' ? source.description : '',
    ctaLabel: typeof source.ctaLabel === 'string' ? source.ctaLabel : '',
  };
}

/**
 * Validate a conditions object into its known subset; unknown keys are
 * ignored. A non-object input (including `null`) yields `null` — no
 * conditions.
 */
function normalizeConditions(raw: unknown): PromotionConditions | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const out: PromotionConditions = {};

  if (Array.isArray(source.surfaces)) {
    const surfaces = source.surfaces.filter(
      (surface): surface is PromotionSurface =>
        asEnum(surface, PROMOTION_SURFACES) !== null
    );
    // An empty list is dropped: "no surfaces" is not a real posture —
    // absent means "all surfaces", which is what an operator who unticks
    // every checkbox intends.
    if (surfaces.length > 0) out.surfaces = surfaces;
  }

  const visitor = asEnum(source.visitor, PROMOTION_VISITORS);
  if (visitor) out.visitor = visitor;

  if (
    typeof source.minCartCents === 'number' &&
    Number.isFinite(source.minCartCents) &&
    source.minCartCents >= 0
  ) {
    out.minCartCents = source.minCartCents;
  }

  if (source.belowFreeShipping === true) out.belowFreeShipping = true;

  return out;
}

/**
 * Implements ADR 03-003: Promotion Bar — campaigns are operator-supplied
 * data inside Site Config, so normalization follows the same posture as
 * `normalizeSiteConfig`: unknown keys ignored, malformed entries drop out
 * entirely, and the function never throws.
 *
 * An entry must carry a non-empty `id`, a valid `type` and `theme`, and
 * both-Locale `copy` with non-empty `label`/`headline` to survive;
 * everything else is coerced to its default (`priority: 0`,
 * `enabled: true`, dates/ctaUrl/promoCode `null`).
 *
 * @param raw - Untrusted value (typically `siteConfig.promotion.campaigns`).
 * @returns The well-formed campaigns contained in `raw`, in order.
 */
export function normalizeCampaigns(raw: unknown): PromotionCampaign[] {
  if (!Array.isArray(raw)) return [];
  const out: PromotionCampaign[] = [];
  const seenIds = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const source = entry as Record<string, unknown>;

    const id = asNonEmptyString(source.id);
    const type = asEnum(source.type, PROMOTION_TYPES);
    const theme = asEnum(source.theme, PROMOTION_THEMES);
    const copySource =
      source.copy && typeof source.copy === 'object'
        ? (source.copy as Record<string, unknown>)
        : null;
    const pt = copySource ? normalizeCopy(copySource.pt) : null;
    const en = copySource ? normalizeCopy(copySource.en) : null;
    // Hard requirements — a malformed entry drops out entirely. Ids
    // must be slug-safe (they become on-device storage values and
    // analytics payloads) and unique: duplicates would collapse the
    // expanded-state memory and the displayed-event dedup, so a
    // repeated id drops the later entry.
    if (
      !id ||
      !CAMPAIGN_ID_PATTERN.test(id) ||
      !type ||
      !theme ||
      !pt ||
      !en ||
      seenIds.has(id)
    )
      continue;
    seenIds.add(id);

    const startDate = asIsoDateOrNull(source.startDate);
    const endDate = asIsoDateOrNull(source.endDate);
    // An inverted schedule is malformed data — the campaign drops out
    // rather than running unbounded or never eligible.
    if (
      startDate !== null &&
      endDate !== null &&
      Date.parse(startDate) > Date.parse(endDate)
    ) {
      continue;
    }

    out.push({
      id,
      type,
      priority:
        typeof source.priority === 'number' && Number.isFinite(source.priority)
          ? source.priority
          : 0,
      enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
      startDate,
      endDate,
      theme,
      ctaUrl: asCtaUrlOrNull(source.ctaUrl),
      promoCode: asNonEmptyString(source.promoCode),
      conditions: normalizeConditions(source.conditions),
      copy: { pt, en },
    });
  }
  return out;
}

/**
 * Map a locale-stripped pathname (from `lib/navigation`'s `usePathname`)
 * onto a Promotion Surface: the landing root is `feed`, the checkout
 * subtree is `purchase`, everything else keeps `classic` chrome.
 */
export function surfaceForPathname(pathname: string): PromotionSurface {
  if (pathname === '/') return 'feed';
  // Exact match mirrors ChromeFrame's SHELL_ROUTES — the post-checkout
  // success/cancel pages keep classic chrome, so they are 'classic'.
  if (pathname === '/checkout') return 'purchase';
  return 'classic';
}

/** Inputs `selectCampaign` evaluates eligibility against, all pre-resolved by the caller. */
export interface PromotionContext {
  surface: PromotionSurface;
  visitor: PromotionVisitor;
  /** Cart subtotal in cents, or `null` while the Cart is not yet hydrated. */
  cartCents: number | null;
  /**
   * The Site Config free-shipping threshold in cents
   * (`shipping.freeShippingThresholdCents`) — the bound the
   * `belowFreeShipping` condition compares the Cart subtotal against.
   */
  freeShippingThresholdCents: number;
  now: Date;
  purchaseSurfaceEnabled: boolean;
}

/**
 * Implements ADR 03-003: Promotion Bar — the single decision point for
 * which campaign (if any) the bar shows.
 *
 * Eligibility, in order: enabled → schedule (`startDate <= now <=
 * endDate` when set) → surface match → visitor match → cart conditions
 * (`minCartCents` and `belowFreeShipping` both fail closed while the Cart
 * is unhydrated) → the Purchase-Surface Gate (a
 * campaign conditioned on the purchase surface ONLY is ineligible
 * while the gate is closed; a `/checkout` CTA on an otherwise-eligible
 * campaign is suppressed at render — `isPurchasePath` — mirroring the
 * fail-closed posture of ADR 00-004 / plan M0).
 *
 * @param campaigns - Normalized campaigns, evaluated in array order.
 * @param ctx - The resolved selection context.
 * @returns The eligible campaign with the highest `priority` (ties keep
 *   array order), or `null` when none is eligible.
 */
export function selectCampaign(
  campaigns: PromotionCampaign[],
  ctx: PromotionContext
): PromotionCampaign | null {
  let best: PromotionCampaign | null = null;
  const now = ctx.now.getTime();

  for (const campaign of campaigns) {
    if (!campaign.enabled) continue;

    const start = campaign.startDate ? Date.parse(campaign.startDate) : null;
    if (start !== null && !Number.isNaN(start) && now < start) continue;
    const end = campaign.endDate ? Date.parse(campaign.endDate) : null;
    if (end !== null && !Number.isNaN(end) && now > end) continue;

    const conditions = campaign.conditions;
    if (conditions?.surfaces && !conditions.surfaces.includes(ctx.surface)) {
      continue;
    }
    if (
      conditions?.visitor &&
      conditions.visitor !== 'any' &&
      conditions.visitor !== ctx.visitor
    ) {
      continue;
    }

    // Cart conditions fail closed while the Cart is unhydrated — a
    // cart-conditioned campaign never flashes in before rehydration.
    if (conditions?.minCartCents !== undefined) {
      if (ctx.cartCents === null || ctx.cartCents < conditions.minCartCents) {
        continue;
      }
    }
    if (conditions?.belowFreeShipping === true) {
      if (
        ctx.cartCents === null ||
        ctx.cartCents <= 0 ||
        ctx.cartCents >= ctx.freeShippingThresholdCents
      ) {
        continue;
      }
    }

    // Implements ADR 03-003: "a campaign whose conditions target only
    // the purchase surface is ineligible" while the Purchase-Surface
    // Gate is closed — the gated /checkout subtree renders the
    // not-found boundary inside the layout, where the bar still
    // mounts, so the exclusion must happen here. An otherwise-eligible
    // campaign merely linking there keeps rendering with its CTA
    // suppressed at render time.
    if (
      !ctx.purchaseSurfaceEnabled &&
      conditions?.surfaces !== undefined &&
      conditions.surfaces.length > 0 &&
      conditions.surfaces.every((surface) => surface === 'purchase')
    ) {
      continue;
    }

    // Strictly-greater keeps the first campaign on a priority tie.
    if (best === null || campaign.priority > best.priority) {
      best = campaign;
    }
  }

  return best;
}

/**
 * Whether a CTA URL resolves to the purchase surface (`/checkout` and
 * descendants) — the Promotion Bar suppresses such CTAs while the
 * Purchase-Surface Gate is closed (ADR 03-003: "the CTA is suppressed"),
 * mirroring the fail-closed posture of ADR 00-004 / plan M0.
 */
export function isPurchasePath(url: string): boolean {
  return url === '/checkout' || url.startsWith('/checkout/');
}

/**
 * On-device persistence keys. The visit flag lives in `localStorage`
 * (it persists across visits on the same device); the expanded and
 * displayed state lives in `sessionStorage` (it resets per browser
 * session, so a returning visit re-shows the bar collapsed). All access
 * is try/catch-guarded — storage full, blocked, or absent degrades to
 * the default posture, never a crash.
 */
export const PROMO_VISITED_KEY = 'hf-visited';
export const PROMO_EXPANDED_KEY = 'hf-promo-expanded';
export const PROMO_DISPLAYED_KEY = 'hf-promo-displayed';

/**
 * Whether this browser has never been marked visited. Read BEFORE
 * `markVisited()` on mount; storage failures report `true` (new) — the
 * bounded direction, since `returning`-targeted campaigns then stay
 * hidden rather than possibly flashing at first-time visitors.
 */
export function isVisitorNew(): boolean {
  try {
    return localStorage.getItem(PROMO_VISITED_KEY) === null;
  } catch {
    return true;
  }
}

/** Mark this browser as having visited; call once, after `isVisitorNew()`. */
export function markVisited(): void {
  try {
    localStorage.setItem(PROMO_VISITED_KEY, '1');
  } catch {
    // Storage unavailable — the visitor simply stays "new" next load.
  }
}

/**
 * Implements ADR 03-003: the expanded state is remembered per session —
 * keyed to the campaign id so a campaign swap within the session never
 * inherits a different campaign's expanded panel.
 *
 * @returns The expanded campaign's id, or `null` when collapsed/absent.
 */
export function readExpandedId(): string | null {
  try {
    return sessionStorage.getItem(PROMO_EXPANDED_KEY);
  } catch {
    return null;
  }
}

/** Persist the per-session expanded campaign id (`null` clears the key). */
export function writeExpandedId(campaignId: string | null): void {
  try {
    if (campaignId !== null) {
      sessionStorage.setItem(PROMO_EXPANDED_KEY, campaignId);
    } else {
      sessionStorage.removeItem(PROMO_EXPANDED_KEY);
    }
  } catch {
    // Storage unavailable — the expanded state just won't persist.
  }
}

/** Read the per-session set of campaign ids the bar has already displayed. */
export function readDisplayedIds(): string[] {
  try {
    const raw = sessionStorage.getItem(PROMO_DISPLAYED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Record a campaign id as displayed this session (idempotent). */
export function markDisplayed(id: string): void {
  try {
    const ids = readDisplayedIds();
    if (!ids.includes(id)) {
      sessionStorage.setItem(PROMO_DISPLAYED_KEY, JSON.stringify([...ids, id]));
    }
  } catch {
    // Storage unavailable — the displayed dedup just won't persist.
  }
}

/**
 * Replace every `{remaining}` placeholder in a copy string with the
 * formatted amount left to free shipping (e.g. "Faltam {remaining} para
 * envio grátis"). Applied by the bar when a `belowFreeShipping` campaign
 * is active.
 *
 * @param text - Copy possibly containing the `{remaining}` placeholder.
 * @param remainingCents - The configured free-shipping threshold minus
 *   the Cart subtotal, in cents.
 * @param locale - The visitor's Locale; `'en'` formats in en-IE EUR,
 *   everything else follows the storefront's pt-PT convention
 *   (`formatPrice`).
 * @returns The interpolated string.
 */
export function interpolateRemaining(
  text: string,
  remainingCents: number,
  locale: string = 'pt'
): string {
  const formatted =
    locale === 'en'
      ? new Intl.NumberFormat('en-IE', {
          style: 'currency',
          currency: 'EUR',
        }).format(remainingCents / 100)
      : formatPrice(remainingCents / 100);
  return text.split('{remaining}').join(formatted);
}
