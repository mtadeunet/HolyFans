import { Product, ProductVariant } from '@/types/product';

export const PRODUCT: Product = {
  id: 'holyfans-nsr-001',
  name: 'Nossa Senhora da Rosa',
  description:
    'Premium t-shirt with Our Lady of the Rose design, featuring high-quality printing with embroidered and metal details.',
  price: 90,
  compareAtPrice: 120,
  currency: 'EUR',
  images: {
    female: [
      '/images/product-female-1.jpg',
      '/images/product-female-2.jpg',
      '/images/product-female-3.jpg',
      '/images/product-female-4.jpg',
    ],
  },
  variants: {
    female: [
      {
        id: 'nsr-female-m',
        name: 'Female Fit',
        size: 'M',
        color: 'White',
        fit: 'Slightly tapered waist, shorter torso',
        images: [
          '/images/product-female-1.jpg',
          '/images/product-female-2.jpg',
          '/images/product-female-3.jpg',
          '/images/product-female-4.jpg',
        ],
        // Owner-editable Product Data (ADR 00-004): Availability Flag +
        // Purchase Cap.
        available: true,
        maxQuantity: 5,
      },
      {
        id: 'nsr-female-l',
        name: 'Female Fit',
        size: 'L',
        color: 'White',
        fit: 'Slightly tapered waist, shorter torso',
        images: [
          '/images/product-female-1.jpg',
          '/images/product-female-2.jpg',
          '/images/product-female-3.jpg',
          '/images/product-female-4.jpg',
        ],
        // Owner-editable Product Data (ADR 00-004): Availability Flag +
        // Purchase Cap.
        available: true,
        maxQuantity: 5,
      },
    ],
  },
  features: [
    'Premium cotton material',
    'Hand-finished details',
    'Limited edition production',
    'Ethical manufacturing',
  ],
  materials: [
    '100% premium cotton',
    'High-quality printing',
    'Embroidered details',
    'Metal accent details',
  ],
  care: [
    'Hand wash or machine wash at 30°C',
    'Do not bleach',
    'Dry in shade',
    'Iron on reverse side',
  ],
};

/**
 * Implements ADR 00-004: Commerce and Checkout - Product Data carries
 * "Variants — including optional per-Variant Purchase Caps ... and
 * Availability Flags" as the single source of truth.
 *
 * Resolve a Variant id against Product Data. Shared by the Cart
 * rehydration and the checkout Route Handler's server-side re-validation
 * so both sides identify Variants the same way.
 *
 * @param variantId - Variant identifier from a Cart line or client input.
 * @returns The matching `ProductVariant`, or `undefined` when Product
 *   Data does not carry it.
 */
export function findVariant(variantId: string): ProductVariant | undefined {
  return VARIANTS.find((variant) => variant.id === variantId);
}

/**
 * Implements ADR 00-004: Commerce and Checkout - "sold-out state is
 * expressed through Availability Flags in Product Data".
 *
 * A fit's representative Variant — the first available one, or the first
 * entry when every Variant of the fit has its Availability Flag off
 * (sold-out fits keep a representative for display-only surfaces and
 * label text, where they are shown but never offered as a purchasable
 * path). Availability-Flag-aware only — it takes no Stock Flags, so it
 * suits label/fit text and defensive fallbacks; shopper-facing
 * representative selection composes the Stock Flags through
 * `purchasableRepresentative`.
 *
 * @param variants - The Variant list of one fit in Product Data.
 * @returns The representative `ProductVariant` for that fit.
 */
export function representativeVariant(
  variants: ProductVariant[]
): ProductVariant {
  return variants.find((variant) => variant.available) ?? variants[0];
}

/**
 * A fit key of Product Data — one key of `PRODUCT.variants` per fit the
 * catalog carries (`'female'` today; future fits appear by extending the
 * `variants` map, never this type).
 */
export type FitKey = keyof typeof PRODUCT.variants;

/**
 * Implements ADR 00-010: Pre-order and Stock Notification —
 * "Non-purchasable Variants remain visible and selectable so the
 * visitor can scope the capture to the specific Variant they want
 * restocked".
 *
 * Every fit in Product Data, derived once at module level from the
 * static catalog — never hardcoded. Sold-out fits and Variants stay in
 * the selection set: their non-purchasable selections present the
 * Pre-order state rather than being hidden.
 */
export const FITS = Object.keys(PRODUCT.variants) as FitKey[];

/**
 * A Variant identifier of Product Data — the `id` of one sellable
 * Variant in the catalog. The key domain of the per-Variant Stock
 * Flags in Site Config (`STOCK_KEYS` in `lib/site-config.ts`
 * enumerates the catalog's ids, so a Variant entering Product Data
 * gets its Stock Flag and Admin Console toggle automatically).
 * Variant ids are authored data rather than literal types, so the
 * type is the `id` field's own.
 */
export type VariantKey = ProductVariant['id'];

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "a Stock
 * Flag **per Variant** in Site Config ... the flag keys are the
 * catalog's own Variant ids".
 *
 * Every Variant in Product Data across every fit, flattened once at
 * module level from the static catalog — never hardcoded. The
 * per-Variant Stock Flag key domain (`STOCK_KEYS` in
 * `lib/site-config.ts`) and `findVariant`'s lookup both iterate it.
 */
export const VARIANTS: ProductVariant[] = Object.values(
  PRODUCT.variants
).flat();

/**
 * Resolve a Variant id to the fit that carries it. Shared by the
 * `?fit=<variantId>` preselection parameter and the rehydrated
 * Cart-line preselection so every consumer identifies the fit the
 * same way.
 *
 * @param variantId - Variant identifier from the `fit` search parameter,
 *   a stored Cart line, or a Product Data Variant.
 * @returns The `FitKey` carrying the Variant, or `undefined` when no
 *   fit does.
 */
export function fitOfVariant(variantId: string): FitKey | undefined {
  return FITS.find((key) =>
    PRODUCT.variants[key].some((variant) => variant.id === variantId)
  );
}

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "a Variant
 * is purchasable exactly when every Availability Flag applying to it in
 * Product Data is on AND its own Stock Flag in Site Config is off".
 *
 * The conjunctive purchasability composition, shared by every buy
 * surface (the Simplified Purchase Surface's selectors and submit, the
 * Suggestions Rail's badge gating) so the rule lives in exactly one
 * place. An id absent from the flag record reads `undefined` — flag
 * off — so a Variant the record does not cover composes by its
 * Availability Flag alone, matching Site Config's fail-open read
 * posture (the Product Data server-side re-validation remains the
 * hard purchase backstop either way).
 *
 * @param variant - The Product Data Variant being resolved.
 * @param stockFlags - The per-Variant Stock Flags from Site Config
 *   (`SiteConfig['stock']`; `true` marks that Variant out of stock).
 * @returns `true` when the Variant can be purchased.
 */
export function isVariantPurchasable(
  variant: ProductVariant,
  stockFlags: Record<VariantKey, boolean>
): boolean {
  return variant.available && !stockFlags[variant.id];
}

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — "Fit-level
 * surfaces ... present the fit's first purchasable Variant".
 *
 * The single rule for which Variant represents a fit to a shopper — the
 * Suggestions Rail's card link and the Simplified Purchase Surface's
 * default selection, unresolved-size fallback, and fit-switch target
 * all resolve through it. The first `isVariantPurchasable` Variant,
 * falling back to `representativeVariant`'s flag-agnostic rule (first
 * `available`, then first entry) when no Variant of the fit is
 * purchasable — a sold-out fit still needs a representative so its card
 * can badge and its selectors can render, but that representative is
 * never offered as a purchasable path. Never `undefined` while the fit
 * carries at least one Variant.
 *
 * @param variants - The Variant list of one fit in Product Data.
 * @param stockFlags - The per-Variant Stock Flags from Site Config
 *   (`SiteConfig['stock']`; `true` marks that Variant out of stock).
 * @returns The shopper-facing representative `ProductVariant` for that
 *   fit.
 */
export function purchasableRepresentative(
  variants: ProductVariant[],
  stockFlags: Record<VariantKey, boolean>
): ProductVariant {
  return (
    variants.find((variant) => isVariantPurchasable(variant, stockFlags)) ??
    representativeVariant(variants)
  );
}

/**
 * Implements ADR 00-007: Quality Tooling and CI - "tracked files carry no
 * real-world identifiers".
 *
 * The public base URL is environment-driven: set `NEXT_PUBLIC_BASE_URL` in
 * the Hosting Platform's environment configuration (or an untracked local
 * env file). The fallback is the localhost dev origin — a placeholder, never
 * a real-world identifier — so the constant stays usable when the variable
 * is unset in local development.
 *
 * Social links are intentionally empty placeholder-neutral values: real
 * profile URLs are owner-supplied configuration and must not be hard-coded
 * into tracked files. They are populated from environment configuration
 * when the owner supplies them.
 */
export const SITE_CONFIG = {
  name: 'HolyFans',
  tagline: "Faith You'll Want to Share",
  description:
    'Premium Christian clothing with discrete but meaningful designs. High quality t-shirts for believers who want to share their faith.',
  url: process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
  ogImage: '/images/og-image.jpg',
  links: {
    twitter: '',
    instagram: '',
    facebook: '',
  },
};
