export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: {
    male: string[];
    female: string[];
  };
  variants: {
    male: ProductVariant;
    female: ProductVariant;
  };
  features: string[];
  materials: string[];
  care: string[];
}

export interface ProductVariant {
  id: string;
  name: string;
  size: string;
  color: string;
  fit: string;
  images: string[];
  /**
   * Implements ADR 00-004: Commerce and Checkout - "sold-out state is
   * expressed through Availability Flags in Product Data".
   *
   * Availability Flag: `false` means the Variant cannot be added to the
   * Cart or checked out (re-validated server-side at Session creation).
   */
  available: boolean;
  /**
   * Implements ADR 00-004: Commerce and Checkout - "optional per-Variant
   * Purchase Caps for small handmade runs" and quantities "clamped to
   * their Purchase Caps".
   *
   * Purchase Cap: maximum quantity of this Variant per Cart/order.
   */
  maxQuantity: number;
}

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export interface CartContextType {
  items: CartItem[];
  /**
   * Whether stored Cart lines have been rehydrated from on-device
   * persistence. Consumers gate "empty Cart" UI on it so returning
   * shoppers never see a one-frame empty state before rehydration.
   */
  hydrated: boolean;
  /**
   * Add `quantity` units of `variant` to the Cart (defaults to 1);
   * the resulting line quantity is clamped to the Variant's Purchase
   * Cap including what is already in the Cart.
   */
  addItem: (
    product: Product,
    variant: ProductVariant,
    quantity?: number
  ) => void;
  /**
   * Remove the Cart line for `variantId`. The Cart is keyed per Variant
   * (ADR 00-004) — in a one-product store every line shares the same
   * Product id, so keying on it would wipe every line.
   */
  removeItem: (variantId: string) => void;
  /**
   * Set the quantity of the `variantId` Cart line (clamped to the
   * Variant's Purchase Cap); `quantity <= 0` removes the line.
   */
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export interface LanguageContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
}
