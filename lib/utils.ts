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
 * @returns The formatted price (e.g. `89,00 €` for `pt-PT`).
 */
export function formatPrice(price: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: currency,
  }).format(price);
}

/**
 * Validate an email address shape (local@domain.tld).
 * @param email - Candidate email string.
 * @returns `true` when the shape is valid.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate a phone number shape (digits, spaces, dashes, parentheses,
 * optional leading `+`) of at least 10 characters.
 * @param phone - Candidate phone string.
 * @returns `true` when the shape is valid.
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.length >= 10;
}
