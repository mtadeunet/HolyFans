import { getTranslations } from 'next-intl/server';

/**
 * Implements ADR 00-007: Quality Tooling and CI - "secrets exist only as
 * environment variables in the Hosting Platform and in untracked local
 * env files — never in tracked files". Only the `STRIPE_SECRET_KEY`
 * prefix is inspected server-side; the key itself is never rendered.
 *
 * Temporary test control (plan M3): a prominent "TEST MODE" banner on
 * checkout-related UI while Stripe test keys are active. The banner
 * shows when the key starts with `sk_test`/`rk_test` or is unset — a
 * missing key is also non-live — and renders nothing on live keys, so it
 * auto-hides at launch. Rendered inside the purchase-surface gate on the
 * checkout, success, and cancel pages.
 *
 * @returns The localized banner element, or `null` on live keys.
 */
export default async function TestModeBanner() {
  const key = process.env.STRIPE_SECRET_KEY;
  const nonLive =
    !key || key.startsWith('sk_test') || key.startsWith('rk_test');
  if (!nonLive) {
    return null;
  }

  const t = await getTranslations('purchase.test_mode');
  return (
    <div data-testid="test-mode-banner" className="bg-amber-400">
      <div className="container py-3 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-amber-950">
          {t('title')}
        </p>
        <p className="text-xs md:text-sm text-amber-900">{t('description')}</p>
      </div>
    </div>
  );
}
