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
  return Object.values(PRODUCT.variants)
    .flat()
    .find((variant) => variant.id === variantId);
}

/**
 * Implements ADR 00-004: Commerce and Checkout - "sold-out state is
 * expressed through Availability Flags in Product Data".
 *
 * A fit's representative Variant — the first available one, or the first
 * entry when every Variant of the fit is flagged off (sold-out fits keep
 * a representative for display-only surfaces like the Suggestions Rail,
 * where they are shown but never offered as a purchasable path).
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
