/**
 * Implements ADR 00-004: Commerce and Checkout - the checkout Route Handler
 * "creates a Checkout Session describing the validated Cart and the
 * fulfillment details the PSP must collect (shipping address and shipping
 * options, so total cost is shown before payment)".
 *
 * Owner-editable shipping configuration. Rates and estimates are
 * owner-supplied values in code-managed Product Data style — edit here and
 * redeploy to change; they are never read from the shopper's request.
 *
 * Known platform limitation (owner decision): Stripe Checkout Sessions show
 * a Session's `shipping_options` to every allowed country — per-country
 * rates are not supported. The owner decision is therefore to collect the
 * address for PT + all EU member states and offer two clearly labeled
 * options ("Portugal — Standard" and "Europe — Standard") so the shopper
 * picks the one matching their destination.
 */

/**
 * ISO 3166-1 alpha-2 codes of the countries shipping is offered to:
 * Portugal plus every other EU member state.
 */
export const SHIPPING_COUNTRIES: readonly string[] = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
];

/**
 * A single shipping option shown on the Hosted Checkout page.
 */
export interface ShippingOptionConfig {
  /** Stable identifier for logs and code references. */
  id: string;
  /** Label shown to the shopper on the Stripe-hosted page. */
  displayName: string;
  /** Price in euro cents (VAT-inclusive, like product prices). */
  amountCents: number;
  /** Delivery estimate range, in business days. */
  minBusinessDays: number;
  maxBusinessDays: number;
}

/**
 * OWNER-SUPPLIED PLACEHOLDER RATES — replace with real carrier pricing.
 * Two flat options covering the allowed-country set (see the module
 * comment for the per-country-rate limitation).
 */
export const SHIPPING_OPTIONS: readonly ShippingOptionConfig[] = [
  {
    id: 'pt-standard',
    displayName: 'Portugal — Standard',
    amountCents: 490, // PLACEHOLDER — owner to confirm
    minBusinessDays: 2,
    maxBusinessDays: 4,
  },
  {
    id: 'eu-standard',
    displayName: 'Europe — Standard',
    amountCents: 990, // PLACEHOLDER — owner to confirm
    minBusinessDays: 3,
    maxBusinessDays: 7,
  },
];
