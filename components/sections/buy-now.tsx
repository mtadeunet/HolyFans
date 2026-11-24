'use client';

import { useCart } from '@/context/cart-context';
import {
  findVariant,
  FITS,
  fitOfVariant,
  isVariantPurchasable,
  PRODUCT,
  purchasableRepresentative,
  representativeVariant,
  type FitKey,
  type VariantKey,
} from '@/lib/constants';
import type {
  CartCorrection,
  CartDriftReason,
} from '@/lib/checkout-validation';
import { formatPrice } from '@/lib/utils';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * A Cart/Product-Data divergence reported by the Route Handler, snapshotted
 * with its display label so the panel stays stable after the Cart is
 * corrected.
 */
interface DriftLine {
  label: string;
  reason: CartDriftReason;
  maxQuantity?: number;
}

/**
 * Implements ADR 00-004: Commerce and Checkout - "refuses checkout on any
 * Cart/Product Data divergence, surfacing a review-and-correct state to the
 * shopper" and "checkout must degrade gracefully" (the unavailable state).
 */
type CheckoutFailure =
  { kind: 'drift'; lines: DriftLine[] } | { kind: 'unavailable' };

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "The existing checkout page is
 * reduced to the single decision the shopper must make: Variant selection,
 * quantity, the VAT-inclusive EUR price, and one purchase action that
 * submits the selection into the existing checkout path."
 *
 * Implements ADR 00-010: Pre-order and Stock Notification — "When the
 * visitor's selected Variant is not purchasable, the Simplified
 * Purchase Surface keeps rendering in place: a localized sold-out
 * message, and the purchase action replaced by a notify-me control
 * that asks for the visitor's email."
 *
 * The Simplified Purchase Surface: one centered card with the product
 * image, Variant selection (fit, then size within the fit), a quantity
 * stepper clamped to the Variant's Purchase Cap, the price, and a
 * single action. Every Variant in Product Data stays visible and
 * selectable — a fit selector renders only when more than one fit
 * exists, a size selector only when the selected fit carries more than
 * one Variant, and a lone Variant of a lone fit shows a compact static
 * label instead. A Variant is purchasable exactly when its
 * Availability Flag is on AND its own Stock Flag in Site Config is
 * off (the conjunctive composition of ADR 00-010): a purchasable
 * selection offers the single purchase action, a non-purchasable one
 * the Pre-order state — the sold-out message plus the consented
 * notify-me email capture. The Cart remains the shopper-held
 * collection underneath — the purchase submit replaces its contents
 * with the single selected line, preserving cancel-preserved and
 * drift-correction semantics; the Pre-order capture touches it not at
 * all. This is the canonical purchase block.
 */
export default function BuyNow({
  stockFlags,
}: {
  /**
   * Implements ADR 00-010: "a Variant is purchasable exactly when
   * every Availability Flag applying to it in Product Data is on AND
   * its own Stock Flag in Site Config is off". The server-evaluated
   * per-Variant Stock Flags: a `true` entry resolves that Variant
   * non-purchasable, forcing its selection into the Pre-order state
   * while sibling Variants stay purchasable. Presentation-level only —
   * Product Data server-side re-validation stays the hard backstop.
   */
  stockFlags: Record<VariantKey, boolean>;
}) {
  const t = useTranslations('purchase');
  const tProduct = useTranslations('product');
  const locale = useLocale();
  const { items, hydrated, clearCart, addItem, removeItem, updateQuantity } =
    useCart();
  // Default to the first fit's shopper-facing representative — the
  // first purchasable Variant under the Availability and Stock Flags
  // (ADR 00-010), else the flag-agnostic representative (first
  // available, then first entry) on a fully sold-out fit.
  const [selectedFit, setSelectedFit] = useState<FitKey>(
    () => FITS[0] ?? 'female'
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    () =>
      purchasableRepresentative(
        PRODUCT.variants[FITS[0] ?? 'female'],
        stockFlags
      ).size
  );
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [failure, setFailure] = useState<CheckoutFailure | null>(null);
  // Pre-order capture state (ADR 00-010): the email being captured, an
  // in-flight guard, the graceful unavailable flag, and the Variant id
  // whose capture already confirmed — confirmation is scoped per
  // Variant so switching the selection offers a fresh capture.
  const [email, setEmail] = useState('');
  const [isNotifying, setIsNotifying] = useState(false);
  const [notifyError, setNotifyError] = useState(false);
  const [confirmedVariantId, setConfirmedVariantId] = useState<string | null>(
    null
  );

  /**
   * Implements ADR 00-004: Commerce and Checkout - "creates Sessions
   * idempotently — retries never produce duplicate Checkout Sessions".
   *
   * One idempotency key per mounted purchase session: retries reuse the
   * same `attemptId`, so a retry after a failed or abandoned handoff can
   * never mint a second Checkout Session.
   */
  const [attemptId] = useState<string>(() => crypto.randomUUID());
  const searchParams = useSearchParams();

  // Returning-shopper/cancel continuity: once the stored Cart has
  // rehydrated, preselect the Variant and quantity of its held line.
  // A `?fit=<variantId>` preselection parameter (Suggestions Rail card
  // links, ADR 03-002) takes priority over the Cart's held line.
  // Runs exactly once — the ref keeps later user edits from being
  // overwritten.
  const preselected = useRef(false);
  useEffect(() => {
    if (!hydrated || preselected.current) {
      return;
    }
    preselected.current = true;
    const line = items[0];

    // Implements ADR 00-010 - "Non-purchasable Variants remain visible
    // and selectable so the visitor can scope the capture to the
    // specific Variant they want restocked": the `fit` parameter is
    // honored whenever it names a Variant that exists in Product Data —
    // a sold-out Variant selects too and scopes its Pre-order capture;
    // an absent or unknown value falls back to the Cart preselection
    // below.
    const fitParam = searchParams.get('fit');
    const paramVariant = fitParam ? findVariant(fitParam) : undefined;
    const paramFit = paramVariant ? fitOfVariant(paramVariant.id) : undefined;
    if (paramFit && paramVariant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedFit(paramFit);
      setSelectedSize(paramVariant.size);
      setQuantity(
        line && line.variant.id === paramVariant.id
          ? Math.min(line.quantity, paramVariant.maxQuantity)
          : 1
      );
      return;
    }

    if (line) {
      // Implements ADR 00-010 - "Non-purchasable Variants remain
      // visible and selectable so the visitor can scope the capture to
      // the specific Variant they want restocked": the rehydrated Cart
      // line resolves like the `?fit=` path above — any Variant still
      // carried in Product Data preselects, flag state included, so a
      // line whose Availability Flag flipped off scopes its Pre-order
      // capture instead of silently dropping to the default. Only a
      // Variant Product Data no longer carries keeps the default.
      const fit = fitOfVariant(line.variant.id);
      if (fit) {
        setSelectedFit(fit);
        setSelectedSize(line.variant.size);
      }
      // External-state sync from the Cart store — the same case
      // `cart-context` allows for its rehydration write. The stored
      // quantity is clamped to the resolved Variant's Purchase Cap
      // defensively — the rehydration path already clamps, this keeps
      // the selector honest if it ever shows a line written elsewhere.
      const resolvedCap = fit
        ? line.variant.maxQuantity
        : representativeVariant(PRODUCT.variants[selectedFit]).maxQuantity;
      setQuantity(Math.min(line.quantity, resolvedCap));
    }
  }, [hydrated, items, selectedFit, searchParams]);

  // Every Variant of the selected fit stays selectable (ADR 00-010);
  // the resolved Variant always exists — every fit carries at least one
  // Variant, and an unmatched size falls back to the fit's
  // shopper-facing representative (first purchasable, ADR 00-010).
  const fitVariants = PRODUCT.variants[selectedFit];
  const variant =
    fitVariants.find((entry) => entry.size === selectedSize) ??
    purchasableRepresentative(fitVariants, stockFlags);

  // Implements ADR 00-010: "a Variant is purchasable exactly when every
  // Availability Flag applying to it in Product Data is on AND its
  // own Stock Flag in Site Config is off" — the conjunctive
  // composition that resolves the purchase action versus the Pre-order
  // state.
  const purchasable = isVariantPurchasable(variant, stockFlags);

  /**
   * Correct the local Cart to match Product Data using the handler's
   * corrections: `over_cap` clamps (a `maxQuantity` of `0` removes the
   * line via updateQuantity's non-positive path), `unknown`/`sold_out`
   * remove the line. The selector's own quantity follows an `over_cap`
   * clamp on its line.
   */
  const applyCorrections = (corrections: CartCorrection[]) => {
    for (const correction of corrections) {
      if (
        correction.reason === 'over_cap' &&
        typeof correction.maxQuantity === 'number'
      ) {
        updateQuantity(correction.variantId, correction.maxQuantity);
        if (correction.variantId === variant.id) {
          setQuantity(Math.max(1, correction.maxQuantity));
        }
      } else {
        removeItem(correction.variantId);
      }
    }
  };

  /**
   * Implements ADR 00-004: Commerce and Checkout - "the shopper's Cart is
   * submitted to the Storefront's single checkout Route Handler ... then
   * redirects the shopper to the PSP-hosted payment page".
   *
   * The Cart stays the submission carrier: its contents are replaced
   * with the single selected line before the POST, so cancel-preserved
   * and drift-correction semantics keep working on a one-line Cart.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing || !purchasable) {
      return;
    }

    setIsProcessing(true);
    setFailure(null);
    clearCart();
    addItem(PRODUCT, variant, quantity);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ variantId: variant.id, quantity }],
          locale: locale === 'pt' ? 'pt' : 'en',
          attemptId,
        }),
      });

      if (response.status === 409) {
        const data = (await response.json()) as {
          corrections?: CartCorrection[];
        };
        const corrections = data.corrections ?? [];
        setFailure({
          kind: 'drift',
          lines: corrections.map((correction) => ({
            label:
              findVariant(correction.variantId)?.name ?? correction.variantId,
            reason: correction.reason,
            maxQuantity: correction.maxQuantity,
          })),
        });
        applyCorrections(corrections);
        setIsProcessing(false);
        return;
      }

      if (!response.ok) {
        setFailure({ kind: 'unavailable' });
        setIsProcessing(false);
        return;
      }

      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        setFailure({ kind: 'unavailable' });
        setIsProcessing(false);
        return;
      }

      // Handoff to the PSP-hosted page; keep the control disabled while
      // the browser navigates away. `assign` navigates like an `href`
      // write (history entry preserved) without mutating a global.
      window.location.assign(data.url);
    } catch {
      setFailure({ kind: 'unavailable' });
      setIsProcessing(false);
    }
  };

  /**
   * Implements ADR 00-010: Pre-order and Stock Notification —
   * "Submitting stores the email and shows an in-page confirmation that
   * the visitor will be notified when stock returns."
   *
   * The Pre-order capture submit: POSTs the visitor's email, Locale,
   * and the selected Variant to the stock-notification Route Handler.
   * The Cart is untouched — a Pre-order creates no payment, no
   * Checkout Session, no reservation. Any non-200 or network failure
   * surfaces the graceful unavailable state — honest failure, never a
   * fake success (ADR 00-010); success shows the in-page confirmation
   * scoped to this Variant.
   */
  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNotifying) {
      return;
    }

    setIsNotifying(true);
    setNotifyError(false);
    try {
      const response = await fetch('/api/stock-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          locale: locale === 'pt' ? 'pt' : 'en',
          variantId: variant.id,
        }),
      });
      if (!response.ok) {
        setNotifyError(true);
        return;
      }
      setConfirmedVariantId(variant.id);
    } catch {
      setNotifyError(true);
    } finally {
      setIsNotifying(false);
    }
  };

  // Stored Cart lines rehydrate in an effect after mount; holding the
  // render until then avoids a one-frame flash of the default selection
  // for returning shoppers.
  if (!hydrated) {
    return null;
  }

  return (
    <section
      data-testid="purchase-surface"
      className="bg-background py-16 md:py-24 lg:py-32"
    >
      <div className="container">
        <div className="mx-auto max-w-lg">
          <div className="mb-8 text-center">
            <h1 className="mb-4 font-serif text-3xl text-text-primary md:text-4xl">
              {t('title')}
            </h1>
            <p className="text-text-secondary">{t('subtitle')}</p>
          </div>

          <form
            onSubmit={purchasable ? handleSubmit : handleNotifySubmit}
            className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-xl"
          >
            {/* Product image — the selected Variant's first master, or
                the branded placeholder composition (Brand Palette
                gradient with the centered logo mark, ADR 03-001) when
                Product Data carries no imagery for it. Unlike a feed
                Post Card, the purchase surface keeps the image region
                mounted so the panel's layout holds. */}
            <div className="relative aspect-square overflow-hidden rounded-xl bg-background">
              {variant.images[0] ? (
                <Image
                  src={variant.images[0]}
                  alt={`${PRODUCT.name} — ${variant.name}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 512px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent/50">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10">
                    <Image
                      src="/logo/logo-mark.png"
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 object-contain opacity-90"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {tProduct('name')}
              </h2>
              <p className="text-lg font-bold text-text-primary">
                <span className="sr-only">{t('price_label')}: </span>
                {/* Promotional compare-at price (ADR 00-004, display
                    only): the pre-promotion price struck through next
                    to the charged amount. */}
                {PRODUCT.compareAtPrice !== undefined && (
                  <s className="mr-2 text-sm font-normal text-text-secondary">
                    {formatPrice(
                      PRODUCT.compareAtPrice * quantity,
                      PRODUCT.currency
                    )}
                  </s>
                )}
                {formatPrice(PRODUCT.price * quantity, PRODUCT.currency)}
              </p>
            </div>

            {/* Variant selection (ADR 00-010): every fit stays
                selectable — a fit choice only exists when Product Data
                carries more than one fit; a lone fit renders as a
                compact static label (with the size appended only when
                it also carries a single Variant), no `choose_fit`
                heading. */}
            {FITS.length > 1 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  {tProduct('choose_fit')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {FITS.map((fit) => {
                    // Fit-switch target: the fit's shopper-facing
                    // representative — its first purchasable Variant
                    // (ADR 00-010).
                    const option = purchasableRepresentative(
                      PRODUCT.variants[fit],
                      stockFlags
                    );
                    const isSelected = selectedFit === fit;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          // A selection change keys quantity off the new
                          // Variant: reset rather than carry a count
                          // chosen under a different Purchase Cap.
                          setSelectedFit(fit);
                          setSelectedSize(option.size);
                          setQuantity(1);
                        }}
                        className={`relative rounded-xl border-2 p-4 transition-all duration-500 ${
                          isSelected
                            ? 'border-accent bg-accent/5 shadow-lg'
                            : 'border-transparent bg-background hover:border-accent/30'
                        }`}
                      >
                        <span className="block text-center">
                          <span className="block font-semibold text-text-primary">
                            {tProduct(`fit.${fit}`)}
                          </span>
                          <span className="mt-1 block text-xs text-text-secondary">
                            {option.fit}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : FITS.length === 1 ? (
              <p className="text-sm text-text-secondary">
                {tProduct(`fit.${selectedFit}`)}
                {fitVariants.length === 1 && ` · ${variant.size}`}
              </p>
            ) : null}

            {/* Size selection (ADR 00-010): sold-out size Variants
                remain visible and selectable so the visitor scopes the
                capture to the Variant they want restocked — a
                non-purchasable option carries the sold-out badge; the
                capture control, never the purchase action, answers its
                selection. */}
            {fitVariants.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  {tProduct('choose_size')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {fitVariants.map((option) => {
                    const isSelected = variant.id === option.id;
                    const optionPurchasable = isVariantPurchasable(
                      option,
                      stockFlags
                    );
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          // Same keying rule as the fit switch: reset
                          // the quantity for the newly selected Variant.
                          setSelectedSize(option.size);
                          setQuantity(1);
                        }}
                        className={`relative rounded-xl border-2 p-4 transition-all duration-500 ${
                          isSelected
                            ? 'border-accent bg-accent/5 shadow-lg'
                            : 'border-transparent bg-background hover:border-accent/30'
                        }`}
                      >
                        <span className="block text-center font-semibold text-text-primary">
                          {option.size}
                        </span>
                        {!optionPurchasable && (
                          <span className="mt-1 block text-center text-xs font-medium uppercase tracking-wide text-text-secondary">
                            {t('pre_order.badge')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity stepper — clamped to the Variant's Purchase Cap
                (ADR 00-004). Purchase-only: a quantity is meaningless
                to the Pre-order capture, so the stepper renders only
                for a purchasable selection. */}
            {purchasable && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  {tProduct('quantity')}
                </h3>
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background transition-colors hover:bg-border/40 disabled:opacity-40"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12H4"
                      />
                    </svg>
                  </button>
                  <span className="w-16 text-center text-xl font-medium">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(Math.min(quantity + 1, variant.maxQuantity))
                    }
                    disabled={quantity >= variant.maxQuantity}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background transition-colors hover:bg-border/40 disabled:opacity-40"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Cart/Product-Data divergence — "cart updated, review
                changes" (ADR 00-004). */}
            {failure?.kind === 'drift' && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6">
                <h2 className="mb-2 text-lg font-semibold text-amber-800">
                  {t('drift.title')}
                </h2>
                <p className="mb-3 text-sm text-amber-800">
                  {t('drift.description')}
                </p>
                <ul className="space-y-1">
                  {failure.lines.map((line, index) => (
                    <li key={index} className="text-sm text-amber-800">
                      {line.reason === 'over_cap' &&
                      typeof line.maxQuantity === 'number'
                        ? t('drift.reasons.over_cap', {
                            name: line.label,
                            maxQuantity: line.maxQuantity,
                          })
                        : t(`drift.reasons.${line.reason}`, {
                            name: line.label,
                          })}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Degradation — "checkout unavailable, cart preserved"
                (ADR 00-004). */}
            {failure?.kind === 'unavailable' && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6">
                <h2 className="mb-2 text-lg font-semibold text-red-800">
                  {t('unavailable.title')}
                </h2>
                <p className="text-sm text-red-800">
                  {t('unavailable.description')}
                </p>
              </div>
            )}

            {/* Implements ADR 00-010: "the action for a non-purchasable
                selection is always the capture control, never the
                purchase action". */}
            {purchasable ? (
              /* Single purchase action — idempotent submit; every
                 retry reuses this mount's `attemptId` (ADR 00-004). */
              <button
                type="submit"
                disabled={isProcessing}
                className="btn-primary w-full text-lg shadow-xl hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg
                      className="h-5 w-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>{t('processing')}</span>
                  </span>
                ) : (
                  <span>{t('buy_now')}</span>
                )}
              </button>
            ) : (
              /* Implements ADR 00-010: the Pre-order state — "a
                 localized sold-out message, and the purchase action
                 replaced by a notify-me control that asks for the
                 visitor's email ... an in-page confirmation that the
                 visitor will be notified when stock returns." The
                 consent statement (ADR 00-008's single-purpose
                 consent language) renders at the capture point in the
                 visitor's Locale; the capture creates no payment, no
                 Checkout Session, no reservation. */
              <div data-testid="pre-order-state" className="space-y-4">
                <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-6 text-center">
                  <h2 className="mb-2 text-lg font-semibold text-text-primary">
                    {t('pre_order.sold_out_title')}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {t('pre_order.sold_out_description')}
                  </p>
                </div>

                {confirmedVariantId === variant.id ? (
                  /* In-page confirmation only — no email is sent
                     (deferred per ADR 00-010). */
                  <div
                    role="status"
                    className="rounded-xl border-2 border-green-300 bg-green-50 p-6 text-center"
                  >
                    <h2 className="mb-2 text-lg font-semibold text-green-800">
                      {t('pre_order.confirmed_title')}
                    </h2>
                    <p className="text-sm text-green-800">
                      {t('pre_order.confirmed_description')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold text-text-primary">
                        {t('pre_order.email_label')}
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={t('pre_order.email_placeholder')}
                        autoComplete="email"
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-text-primary outline-none ring-primary/30 transition focus:border-primary focus:ring"
                      />
                    </label>
                    {/* Consent statement at the capture point (ADR
                        00-008): states the single purpose — stock
                        notification for this Variant. */}
                    <p className="text-xs text-text-secondary">
                      {t('pre_order.consent')}
                    </p>
                    {notifyError && (
                      /* Graceful unavailable state — honest failure,
                         never a fake success (ADR 00-010). */
                      <div
                        role="alert"
                        className="rounded-xl border-2 border-red-300 bg-red-50 p-4"
                      >
                        <h2 className="mb-1 text-sm font-semibold text-red-800">
                          {t('pre_order.unavailable_title')}
                        </h2>
                        <p className="text-sm text-red-800">
                          {t('pre_order.unavailable_description')}
                        </p>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isNotifying}
                      className="btn-primary w-full text-lg shadow-xl hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isNotifying
                        ? t('pre_order.submitting')
                        : t('pre_order.notify_cta')}
                    </button>
                  </div>
                )}
              </div>
            )}

          </form>
        </div>
      </div>
    </section>
  );
}
