'use client';

import { useCart } from '@/context/cart-context';
import { useLocale, useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/utils';
import { useState } from 'react';
import type {
  CartCorrection,
  CartDriftReason,
} from '@/lib/checkout-validation';

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
 * Implements ADR 00-004: Commerce and Checkout - "the shopper's Cart is
 * submitted to the Storefront's single checkout Route Handler ... then
 * redirects the shopper to the PSP-hosted payment page". Shipping address
 * and payment method are collected by the PSP's Hosted Checkout, not by
 * local forms.
 */
export default function Purchase() {
  const t = useTranslations('purchase');
  const locale = useLocale();
  const { items, hydrated, getTotal, removeItem, updateQuantity } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [failure, setFailure] = useState<CheckoutFailure | null>(null);

  /**
   * Implements ADR 00-004: Commerce and Checkout - "creates Sessions
   * idempotently — retries never produce duplicate Checkout Sessions".
   *
   * One idempotency key per mounted purchase session: retries reuse the
   * same `attemptId`, so a retry after a failed or abandoned handoff can
   * never mint a second Checkout Session. A successful attempt navigates
   * away to the PSP-hosted page, so the key never needs regenerating.
   */
  const [attemptId] = useState<string>(() => crypto.randomUUID());

  /**
   * Correct the local Cart to match Product Data using the handler's
   * corrections: `over_cap` clamps (a `maxQuantity` of `0` removes the
   * line via updateQuantity's non-positive path), `unknown`/`sold_out`
   * remove the line. Corrections are keyed by `variantId` — the same key
   * the Cart lines are stored under.
   */
  const applyCorrections = (corrections: CartCorrection[]) => {
    for (const correction of corrections) {
      if (
        correction.reason === 'over_cap' &&
        typeof correction.maxQuantity === 'number'
      ) {
        updateQuantity(correction.variantId, correction.maxQuantity);
      } else {
        removeItem(correction.variantId);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing || items.length === 0) {
      return;
    }

    // Idempotent submit (ADR 00-004): the control disables on first use
    // and every retry reuses this mount's `attemptId` as the idempotency
    // key, so retries never create duplicate Checkout Sessions.
    setIsProcessing(true);
    setFailure(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            variantId: item.variant.id,
            quantity: item.quantity,
          })),
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
              items.find((i) => i.variant.id === correction.variantId)?.variant
                .name ?? correction.variantId,
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

      // Handoff to the PSP-hosted page; keep the control disabled while the
      // browser navigates away.
      window.location.href = data.url;
    } catch {
      setFailure({ kind: 'unavailable' });
      setIsProcessing(false);
    }
  };

  // Stored Cart lines rehydrate in an effect after mount; holding the
  // render until then avoids a one-frame "cart is empty" flash for
  // returning shoppers.
  if (!hydrated) {
    return null;
  }

  if (items.length === 0) {
    return (
      <section
        data-testid="purchase-surface"
        className="py-16 md:py-24 lg:py-32 bg-surface"
      >
        <div className="container">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-10 h-10 text-accent"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M3 1a1 1 0 000 2h1a1 1 0 000-2H3zM16 1a1 1 0 000 2h1a1 1 0 000-2h-1zM6 1a1 1 0 000 2h1a1 1 0 000-2H6zM11 1a1 1 0 000 2h1a1 1 0 000-2h-1z" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif text-primary">
              {t('empty.title')}
            </h2>
            <p className="text-text-secondary max-w-md mx-auto">
              {t('empty.description')}
            </p>
            <button
              onClick={() => (window.location.href = '#products')}
              className="btn-primary"
            >
              {t('empty.continue_shopping')}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="purchase-surface"
      className="py-16 md:py-24 lg:py-32 bg-surface"
    >
      <div className="container">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-serif text-primary mb-4">
            {t('title')}
          </h1>
          <p className="text-text-secondary">{t('subtitle')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h2 className="text-xl font-semibold text-primary mb-6">
                {t('items.title')}
              </h2>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-4 pb-4 border-b border-border last:border-0"
                  >
                    {/* Product Image */}
                    <div className="w-20 h-20 bg-gradient-to-br from-surface to-border rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                          <svg
                            className="w-5 h-5 text-accent"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path
                              fillRule="evenodd"
                              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-primary">
                            {item.product.name}
                          </h3>
                          <p className="text-sm text-text-secondary">
                            {item.variant.name} - {item.variant.size}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.variant.id)}
                          className="text-text-secondary hover:text-red-500 transition-colors"
                          aria-label={t('items.remove')}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() =>
                              updateQuantity(item.variant.id, item.quantity - 1)
                            }
                            className="w-6 h-6 rounded border border-border bg-background hover:bg-surface transition-colors flex items-center justify-center"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 12H4"
                              />
                            </svg>
                          </button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.variant.id, item.quantity + 1)
                            }
                            className="w-6 h-6 rounded border border-border bg-background hover:bg-surface transition-colors flex items-center justify-center"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
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
                        <div className="text-right">
                          <p className="font-semibold text-primary">
                            {item.product.currency}{' '}
                            {formatPrice(item.product.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary & Submit */}
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h2 className="text-xl font-semibold text-primary mb-6">
                {t('summary.title')}
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    {t('summary.subtotal')}
                  </span>
                  <span className="font-medium">
                    {items[0]?.product.currency || 'EUR'}{' '}
                    {formatPrice(getTotal())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    {t('summary.shipping')}
                  </span>
                  <span className="font-medium">
                    {t('summary.at_checkout')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    {t('summary.tax')}
                  </span>
                  <span className="font-medium">
                    {t('summary.at_checkout')}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-semibold text-primary">
                    {t('summary.total')}
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {items[0]?.product.currency || 'EUR'}{' '}
                    {formatPrice(getTotal())}
                  </span>
                </div>
              </div>
            </div>

            {/* Cart/Product-Data divergence — "cart updated, review changes" */}
            {failure?.kind === 'drift' && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-amber-800 mb-2">
                  {t('drift.title')}
                </h2>
                <p className="text-sm text-amber-800 mb-3">
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

            {/* Degradation — "checkout unavailable, cart preserved" */}
            {failure?.kind === 'unavailable' && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-red-800 mb-2">
                  {t('unavailable.title')}
                </h2>
                <p className="text-sm text-red-800">
                  {t('unavailable.description')}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full btn-primary text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
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
                <span>{t('submit_button')}</span>
              )}
            </button>

            {/* Trust Indicators */}
            <div className="bg-gradient-to-r from-primary to-accent rounded-xl p-6 text-white text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-semibold">{t('trust.title')}</span>
              </div>
              <p className="text-sm text-white/90">{t('trust.description')}</p>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
