'use client';

import { useEffect } from 'react';
import { CART_STORAGE_KEY, useCart } from '@/context/cart-context';

/**
 * Implements ADR 00-004: Commerce and Checkout - the Cart "lives in the
 * shopper's browser ... and persists across visits on the same device".
 * Once the shopper lands back on the success page with a completed
 * Checkout Session (paid, or a pending-payment reference issued), that
 * persisted Cart has served its purpose and is emptied (plan M3).
 *
 * Mounted by the post-checkout success page. Child effects run before the
 * `CartProvider` rehydration read on a fresh page load, so the stored Cart
 * key is emptied first — otherwise the provider would restore the
 * just-purchased items from `localStorage`. `clearCart()` then also covers
 * the client-side-navigation case where the provider was already mounted.
 *
 * @returns Nothing — behavior-only component.
 */
export default function ClearCartOnMount() {
  const { clearCart } = useCart();

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, '[]');
    } catch {
      // Storage unavailable — clearing the in-memory Cart is enough.
    }
    clearCart();
  }, [clearCart]);

  return null;
}
