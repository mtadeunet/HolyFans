'use client';

import WhatsAppGlyph from '@/components/ui/whatsapp-glyph';
import { useCart } from '@/context/cart-context';
import {
  findVariant,
  PRODUCT,
  representativeVariant,
  SITE_CONFIG,
} from '@/lib/constants';
import type {
  CartCorrection,
  CartDriftReason,
} from '@/lib/checkout-validation';
import { whatsappShareUrl } from '@/lib/whatsapp';
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

type FitKey = keyof typeof PRODUCT.variants;

/**
 * Implements ADR 00-004: Commerce and Checkout - "sold-out state is
 * expressed through Availability Flags in Product Data".
 *
 * The fits carrying at least one purchasable Variant, derived once at
 * module level from the static Product Data — never hardcoded.
 */
const AVAILABLE_FITS = (Object.keys(PRODUCT.variants) as FitKey[]).filter(
  (fit) => PRODUCT.variants[fit].some((variant) => variant.available)
);

/**
 * Resolve a Variant id to the fit that carries it, restricted to fits
 * with a purchasable Variant. Shared by the `?fit=<variantId>`
 * preselection parameter and the rehydrated-Cart-line preselection so
 * both paths identify the fit the same way.
 *
 * @param variantId - Variant identifier from the `fit` search parameter
 *   or a stored Cart line.
 * @returns The `FitKey` carrying the Variant, or `undefined` when no
 *   available fit does.
 */
function fitOfVariant(variantId: string): FitKey | undefined {
  return AVAILABLE_FITS.find((key) =>
    PRODUCT.variants[key].some((variant) => variant.id === variantId)
  );
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "The existing checkout page is
 * reduced to the single decision the shopper must make: Variant selection,
 * quantity, the VAT-inclusive EUR price, and one purchase action that
 * submits the selection into the existing checkout path."
 *
 * The Simplified Purchase Surface: one centered card with the product
 * image, Variant selection (fit, then size within the fit), a quantity
 * stepper clamped to the Variant's Purchase Cap, the price, and a
 * single purchase action. Selectable Variants are derived from Product
 * Data's Availability Flags (ADR 00-004 is the single source of
 * truth): a fit selector renders only when more than one fit carries a
 * purchasable Variant, a size selector renders only when the selected
 * fit carries more than one, and a lone purchasable Variant of a lone
 * available fit shows a compact static label instead. The Cart remains
 * the shopper-held collection underneath — submit replaces its contents
 * with the single selected line, preserving cancel-preserved and
 * drift-correction semantics. The Outbound Share Surface (ADR 00-009)
 * lives beneath the buy action, making this the canonical purchase
 * block.
 */
export default function BuyNow() {
  const t = useTranslations('purchase');
  const tProduct = useTranslations('product');
  const tWhatsApp = useTranslations('whatsapp');
  const locale = useLocale();
  const { items, hydrated, clearCart, addItem, removeItem, updateQuantity } =
    useCart();
  // Default to the first purchasable Variant — never a sold-out one.
  const [selectedFit, setSelectedFit] = useState<FitKey>(
    () => AVAILABLE_FITS[0] ?? 'female'
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    () =>
      representativeVariant(PRODUCT.variants[AVAILABLE_FITS[0] ?? 'female'])
        .size
  );
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [failure, setFailure] = useState<CheckoutFailure | null>(null);

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

    // Implements ADR 03-002 - "an available Variant suggestion selects
    // that Variant on the surface, while a sold-out Variant is shown
    // but never offered as a purchasable path": the `fit` parameter is
    // honored only when it names a Variant that exists in Product Data
    // AND is purchasable; an absent, unknown, or sold-out value falls
    // back to the Cart preselection below.
    const fitParam = searchParams.get('fit');
    const paramVariant = fitParam ? findVariant(fitParam) : undefined;
    const paramFit =
      paramVariant && paramVariant.available
        ? fitOfVariant(paramVariant.id)
        : undefined;
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
      // A stale Cart line can hold a Variant whose Availability Flag has
      // since flipped off (or that Product Data no longer carries):
      // ignore its fit and keep the available default — the preselect
      // must never resurrect a sold-out Variant.
      const fit = line.variant.available
        ? fitOfVariant(line.variant.id)
        : undefined;
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

  // The purchasable Variants of the selected fit, then the selected one
  // within them — the resolved Variant is always available (the fit only
  // ever takes AVAILABLE_FITS values, and an unmatched size falls back
  // to the fit's first purchasable Variant).
  const availableVariants = PRODUCT.variants[selectedFit].filter(
    (entry) => entry.available
  );
  const variant =
    availableVariants.find((entry) => entry.size === selectedSize) ??
    availableVariants[0];

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
    if (isProcessing || !variant.available) {
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
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-xl"
          >
            {/* Product image — the selected Variant's first master. */}
            <div className="relative aspect-square overflow-hidden rounded-xl bg-background">
              <Image
                src={variant.images[0]}
                alt={`${PRODUCT.name} — ${variant.name}`}
                fill
                sizes="(max-width: 768px) 100vw, 512px"
                className="object-cover"
                priority
              />
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

            {/* Variant selection (ADR 00-004 Availability Flags): a
                fit choice only exists when more than one fit carries a
                purchasable Variant — a lone available fit renders as a
                compact static label (with the size appended only when
                it also carries a single purchasable Variant), no
                `choose_fit` heading. */}
            {AVAILABLE_FITS.length > 1 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  {tProduct('choose_fit')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_FITS.map((fit) => {
                    const option = representativeVariant(PRODUCT.variants[fit]);
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
            ) : AVAILABLE_FITS.length === 1 ? (
              <p className="text-sm text-text-secondary">
                {tProduct(`fit.${selectedFit}`)}
                {availableVariants.length === 1 && ` · ${variant.size}`}
              </p>
            ) : null}

            {/* Size selection (ADR 00-004 Availability Flags): a size
                choice only exists when the selected fit carries more
                than one purchasable Variant — sold-out size Variants
                are never offered as a purchasable path. */}
            {availableVariants.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  {tProduct('choose_size')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {availableVariants.map((option) => {
                    const isSelected = variant.id === option.id;
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
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity stepper — clamped to the Variant's Purchase Cap
                (ADR 00-004). */}
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

            {/* Single purchase action — idempotent submit; every retry
                reuses this mount's `attemptId` (ADR 00-004). */}
            <button
              type="submit"
              disabled={isProcessing || !variant.available}
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

            {/* Implements ADR 00-009: WhatsApp Deep-Link Channels — "a
                control on the canonical purchase block lets a visitor
                compose a message containing the Storefront's canonical
                URL". Outbound Share Surface: ungated, configuration-free;
                shares `SITE_CONFIG.url` only — never a preview,
                deployment, or current-location URL. */}
            <a
              href={whatsappShareUrl(
                `${tWhatsApp('share_text')} ${SITE_CONFIG.url}`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border bg-surface px-8 py-3 font-semibold text-text-secondary transition-colors hover:border-accent/40 hover:bg-background"
            >
              <WhatsAppGlyph className="h-5 w-5 text-[#25D366]" />
              <span>{tWhatsApp('share_label')}</span>
            </a>
          </form>
        </div>
      </div>
    </section>
  );
}
