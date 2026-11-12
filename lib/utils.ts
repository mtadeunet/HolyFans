import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names and resolve Tailwind class conflicts.
 * @param inputs - Class values accepted by `clsx`.
 * @returns A single merged class-name string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric price as a localized currency string.
 * @param price - Amount in major currency units (e.g. euros).
 * @param currency - ISO 4217 currency code; EUR per ADR 00-004.
 * @returns The formatted price (e.g. `90,00 €` for `pt-PT`).
 */
export function formatPrice(price: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: currency,
  }).format(price);
}
