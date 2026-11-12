import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import { getStripeClient } from '@/lib/stripe';
import ClearCartOnMount from '@/components/ui/clear-cart-on-mount';
import TestModeBanner from '@/components/ui/test-mode-banner';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "the localized
 * post-checkout success page renders per request on the Node runtime and
 * performs a single read-only retrieval of the just-created Checkout
 * Session through the PSP SDK ... The read is implemented directly in
 * the page — not inside the checkout Route Handler — reads nothing else,
 * mutates nothing, and degrades to a generic post-checkout state when
 * the PSP is unreachable." Rendering per request also evaluates the
 * purchase-surface gate per request.
 */
export const dynamic = 'force-dynamic';

/** The three post-checkout presentation states. */
type SuccessState = 'paid' | 'pending' | 'generic';

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

/**
 * Locale-prefixed post-checkout success page.
 *
 * Implements ADR 00-004: Commerce and Checkout - "The localized
 * post-checkout success page distinguishes a paid outcome from an
 * asynchronous pending-payment state (e.g., a Multibanco reference
 * awaiting payment) through the session-status read enumerated in
 * ADR 00-002's dynamic surface." The pending state tells the shopper to
 * complete the payment at the ATM or homebanking with the issued
 * reference, separate from "paid".
 *
 * Behind the same fail-closed `PURCHASE_SURFACE_ENABLED` gate as the
 * checkout page: `notFound()` when the flag is unset. The Session is
 * retrieved server-side via `session_id`; when Stripe is not configured
 * (no key in this environment) or retrieval fails, a generic thank-you
 * state renders instead of crashing. The Cart is cleared on mount only
 * for the confirmed `paid`/`pending` states — a `generic` landing (bogus
 * or missing `session_id`) must not wipe a shopper's stored Cart.
 *
 * @param searchParams - URL search params; `session_id` is set by Stripe
 *   on the `success_url` redirect.
 * @returns The localized paid / pending / generic state.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const t = await getTranslations('purchase.success_page');

  if (!isPurchaseSurfaceEnabled()) {
    notFound();
  }

  const { session_id: sessionId } = await searchParams;

  let state: SuccessState = 'generic';
  const stripe = getStripeClient();
  if (stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'unpaid') {
        // Delayed-confirmation method (e.g. Multibanco): the reference was
        // issued on the hosted page and payment completes later.
        state = 'pending';
      } else if (
        session.payment_status === 'paid' ||
        session.payment_status === 'no_payment_required'
      ) {
        state = 'paid';
      }
    } catch (error) {
      // Retrieval failure must not break the shopper's landing page —
      // degrade to the generic thank-you state.
      console.error('[checkout] Session retrieval failed:', error);
    }
  }

  return (
    <main className="min-h-screen">
      <TestModeBanner />
      {/* Cart cleared only on a confirmed Session outcome — a direct
          visit rendering `generic` must not wipe the stored Cart. */}
      {(state === 'paid' || state === 'pending') && <ClearCartOnMount />}
      <section className="py-16 md:py-24 lg:py-32 bg-background">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                state === 'pending' ? 'bg-amber-100' : 'bg-green-100'
              }`}
            >
              {state === 'pending' ? (
                <svg
                  className="w-10 h-10 text-amber-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="w-10 h-10 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-serif text-text-primary">
              {t(`${state}.title`)}
            </h1>
            <div className="bg-surface rounded-xl p-6 border-2 border-accent/20">
              <p className="text-text-secondary">{t(`${state}.description`)}</p>
            </div>
            <Link href="/" className="btn-primary inline-block">
              {t('continue_shopping')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
