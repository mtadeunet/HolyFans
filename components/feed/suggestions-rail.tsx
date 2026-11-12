import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import { PRODUCT, representativeVariant } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';

interface SuggestionsRailProps {
  /**
   * Implements ADR 00-004: Commerce and Checkout - "Checkout is delegated
   * to the PSP's Hosted Checkout." (interim purchase-surface gate, plan
   * M0) — suggestion cards and the discovery CTA link to the purchase
   * surface only while `PURCHASE_SURFACE_ENABLED` is `'true'`.
   */
  purchaseSurfaceEnabled: boolean;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "A column of product and
 * Variant suggestion cards with a discovery call-to-action and the
 * legal links (privacy, terms) at its foot." and "the Suggestions Rail
 * is the first element to drop below desktop widths."
 *
 * The Feed Shell's right column: a suggestion card per fit (fit name,
 * EUR price, Availability Flag badge — sold-out shown but never
 * linked), each linking its representative Variant — the first
 * purchasable one, or the first entry on a sold-out fit — plus a
 * discovery CTA card, and the legal links at its foot.
 * Present only at `lg` and wider. Legal links render as inert
 * placeholders until the localized legal routes land (temporary test
 * control; wired to `/{locale}/privacy` and `/{locale}/terms` when
 * those pages exist).
 */
export default function SuggestionsRail({
  purchaseSurfaceEnabled,
}: SuggestionsRailProps) {
  const t = useTranslations('feed.suggestions');
  const tProduct = useTranslations('product');
  const tFooter = useTranslations('footer');

  // One suggestion card per fit in Product Data, derived generically —
  // a fit's localized label resolves through the `product.fit.<fit>`
  // message key, so a fit entering or leaving the catalog needs no
  // component change.
  const variants = (
    Object.keys(PRODUCT.variants) as (keyof typeof PRODUCT.variants)[]
  ).map((fit) => ({
    variant: representativeVariant(PRODUCT.variants[fit]),
    label: tProduct(`fit.${fit}`),
  }));

  return (
    <aside className="sticky top-0 hidden h-screen w-80 flex-shrink-0 flex-col overflow-y-auto border-l border-border bg-background px-6 py-6 lg:flex">
      <h2 className="text-lg font-semibold text-text-primary">{t('title')}</h2>

      <div className="mt-4 space-y-3">
        {variants.map(({ variant, label }) => {
          const card = (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors group-hover:border-accent/40">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {label}
                </p>
                <p className="text-sm text-text-secondary">
                  {/* Promotional compare-at price (ADR 00-004, display
                      only): struck through next to the current price. */}
                  {PRODUCT.compareAtPrice !== undefined && (
                    <s className="mr-1.5">
                      {formatPrice(PRODUCT.compareAtPrice, PRODUCT.currency)}
                    </s>
                  )}
                  <span className="font-medium text-text-primary">
                    {formatPrice(PRODUCT.price, PRODUCT.currency)}
                  </span>
                </p>
              </div>
              {variant.available ? (
                <span className="text-sm font-semibold text-primary">
                  {t('view')}
                </span>
              ) : (
                /* Availability Flag (ADR 00-004): sold-out Variants are
                   shown but never become links to the purchase surface. */
                <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent">
                  {t('sold_out')}
                </span>
              )}
            </div>
          );

          return variant.available && purchaseSurfaceEnabled ? (
            /* Implements ADR 03-002 - "an available Variant suggestion
               selects that Variant on the surface": the card's link
               carries the `?fit=<variantId>` preselection parameter the
               Simplified Purchase Surface honors; a sold-out Variant is
               shown but never linked (Availability Flag, ADR 00-004). */
            <Link
              key={variant.id}
              href={`/checkout?fit=${variant.id}`}
              className="group block"
            >
              {card}
            </Link>
          ) : (
            <div key={variant.id}>{card}</div>
          );
        })}
      </div>

      {/* Discovery CTA card; its purchase link renders only while the
          gate is open (ADR 00-004 / plan M0). */}
      <div className="mt-6 rounded-xl border border-accent/30 bg-gradient-to-br from-primary to-accent/70 p-5 text-white">
        {/* Serif display face on the heading (ADR 03-001 whitelist);
            explicit text-white overrides the base heading color on the
            gradient card. */}
        <h3 className="font-serif text-lg text-white">{t('discover_title')}</h3>
        <p className="mt-1 text-sm text-white/85">{t('discover_body')}</p>
        {purchaseSurfaceEnabled && (
          <Link
            href="/checkout"
            className="mt-4 inline-block rounded-lg bg-white px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
          >
            {t('discover_cta')}
          </Link>
        )}
      </div>

      {/* Legal links — inert placeholders until the localized legal
          routes land (temporary control). */}
      <div className="mt-auto pt-8">
        <nav className="flex items-center gap-4 text-xs text-text-secondary">
          <a href="#" className="transition-colors hover:text-primary">
            {tFooter('privacy')}
          </a>
          <a href="#" className="transition-colors hover:text-primary">
            {tFooter('terms')}
          </a>
        </nav>
      </div>
    </aside>
  );
}
