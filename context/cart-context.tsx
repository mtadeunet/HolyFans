'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import {
  CartItem,
  CartContextType,
  Product,
  ProductVariant,
} from '@/types/product';
import { findVariant, PRODUCT } from '@/lib/constants';
import type { CheckoutLineInput } from '@/lib/checkout-validation';

const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * Implements ADR 00-004: Commerce and Checkout - "Cart is a client-side
 * Island: it lives in the shopper's browser ... and persists across visits
 * on the same device."
 *
 * On-device persistence key: only Variant ids + quantities are stored;
 * full Cart lines are rebuilt from Product Data on rehydration so prices
 * and flags in storage can never go stale.
 */
export const CART_STORAGE_KEY = 'hf-cart';

/**
 * A persisted Cart line — the same `{variantId, quantity}` shape the
 * checkout Route Handler accepts (shared type, `CheckoutLineInput`).
 */
type StoredCartLine = CheckoutLineInput;

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

/**
 * Clamp a quantity to a Variant's Purchase Cap.
 *
 * Implements ADR 00-004: Commerce and Checkout - the Cart "holds selected
 * Variants and quantities clamped to their Purchase Caps".
 *
 * @param quantity - Requested quantity.
 * @param variant - Variant whose Purchase Cap applies.
 * @returns An integer in `[1, variant.maxQuantity]`.
 */
function clampQuantity(quantity: number, variant: ProductVariant): number {
  if (!Number.isFinite(quantity)) {
    return 1;
  }
  return Math.min(Math.max(1, Math.floor(quantity)), variant.maxQuantity);
}

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  // Stays false until stored lines have been read — gates the persistence
  // write so an empty initial render can never wipe a stored Cart
  // (including under StrictMode's double effect setup in dev), and lets
  // consumers hold off "empty Cart" UI until rehydration is done.
  const [hydrated, setHydrated] = useState(false);

  // Rehydrate once, client-side only: the initial render stays empty on
  // server and client alike, so no hydration mismatch is possible.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredCartLine[];
        if (Array.isArray(stored)) {
          const restored: CartItem[] = [];
          for (const line of stored) {
            const variant = findVariant(line.variantId);
            // Product Data no longer carries this Variant, or its
            // Availability Flag went off since the line was stored —
            // drop it, consistent with the addItem guard (ADR 00-004).
            if (!variant || !variant.available) {
              continue;
            }
            restored.push({
              product: PRODUCT,
              variant,
              quantity: clampQuantity(line.quantity, variant),
            });
          }
          if (restored.length > 0) {
            // Rehydrating from localStorage is external-state sync — the
            // one case this rule intentionally allows.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setItems(restored);
          }
        }
      }
    } catch {
      // Corrupt or unavailable storage — start with an empty Cart.
    }
    setHydrated(true);
  }, []);

  // Persist on every change once rehydrated.
  useEffect(() => {
    if (!hydrated) {
      return;
    }
    try {
      const stored: StoredCartLine[] = items.map((item) => ({
        variantId: item.variant.id,
        quantity: item.quantity,
      }));
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage full or unavailable — the in-memory Cart still works.
    }
  }, [items, hydrated]);

  // Every context function is a stable useCallback and `value` a stable
  // useMemo: consumers can safely depend on them in effects without
  // triggering update loops.
  const addItem = useCallback(
    (product: Product, variant: ProductVariant, quantity = 1) => {
      // Availability Flag: sold-out Variants cannot be added (ADR 00-004).
      if (!variant.available) {
        return;
      }

      setItems((prevItems) => {
        const existingItem = prevItems.find(
          (item) => item.variant.id === variant.id
        );

        if (existingItem) {
          // Clamp the merged quantity — what is already in the Cart
          // counts toward the Variant's Purchase Cap.
          return prevItems.map((item) =>
            item.variant.id === variant.id
              ? {
                  ...item,
                  quantity: clampQuantity(item.quantity + quantity, variant),
                }
              : item
          );
        }

        return [
          ...prevItems,
          { product, variant, quantity: clampQuantity(quantity, variant) },
        ];
      });
    },
    []
  );

  // Cart lines are keyed per Variant (ADR 00-004): removeItem and
  // updateQuantity address a single `variantId`, never the shared
  // Product id.
  const removeItem = useCallback((variantId: string) => {
    setItems((prevItems) =>
      prevItems.filter((item) => item.variant.id !== variantId)
    );
  }, []);

  const updateQuantity = useCallback(
    (variantId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(variantId);
        return;
      }

      setItems((prevItems) =>
        prevItems.map((item) =>
          item.variant.id === variantId
            ? { ...item, quantity: clampQuantity(quantity, item.variant) }
            : item
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    // No-op when already empty: returning the same array lets React bail
    // out of the render, so an effect depending on clearCart cannot loop.
    setItems((prevItems) => (prevItems.length === 0 ? prevItems : []));
  }, []);

  const getTotal = useCallback(() => {
    return items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );
  }, [items]);

  const getItemCount = useCallback(() => {
    return items.reduce((count, item) => count + item.quantity, 0);
  }, [items]);

  const value = useMemo<CartContextType>(
    () => ({
      items,
      hydrated,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getTotal,
      getItemCount,
    }),
    [
      items,
      hydrated,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getTotal,
      getItemCount,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
