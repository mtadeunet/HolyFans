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
}

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, variant: ProductVariant) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export interface LanguageContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
}
