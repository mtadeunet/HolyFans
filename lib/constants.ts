import { Product } from '@/types/product';

export const PRODUCT: Product = {
  id: 'holyfans-nsr-001',
  name: 'Nossa Senhora da Rosa T-Shirt',
  description: 'Premium t-shirt with Our Lady of the Rose design, featuring high-quality printing with embroidered and metal details.',
  price: 89,
  currency: 'EUR',
  images: {
    male: [
      '/images/product-male-1.jpg',
      '/images/product-male-2.jpg',
      '/images/product-male-3.jpg',
      '/images/product-male-4.jpg'
    ],
    female: [
      '/images/product-female-1.jpg',
      '/images/product-female-2.jpg',
      '/images/product-female-3.jpg',
      '/images/product-female-4.jpg'
    ]
  },
  variants: {
    male: {
      id: 'nsr-male-m',
      name: 'Male Fit',
      size: 'M',
      color: 'White',
      fit: 'Regular fit, slightly longer torso',
      images: [
        '/images/product-male-1.jpg',
        '/images/product-male-2.jpg',
        '/images/product-male-3.jpg',
        '/images/product-male-4.jpg'
      ]
    },
    female: {
      id: 'nsr-female-m',
      name: 'Female Fit',
      size: 'M',
      color: 'White',
      fit: 'Slightly tapered waist, shorter torso',
      images: [
        '/images/product-female-1.jpg',
        '/images/product-female-2.jpg',
        '/images/product-female-3.jpg',
        '/images/product-female-4.jpg'
      ]
    }
  },
  features: [
    'Premium cotton material',
    'Hand-finished details',
    'Limited edition production',
    'Ethical manufacturing'
  ],
  materials: [
    '100% premium cotton',
    'High-quality printing',
    'Embroidered details',
    'Metal accent details'
  ],
  care: [
    'Hand wash or machine wash at 30°C',
    'Do not bleach',
    'Dry in shade',
    'Iron on reverse side'
  ]
};

export const SITE_CONFIG = {
  name: 'HolyFans',
  tagline: 'Faith You\'ll Want to Share',
  description: 'Premium Christian clothing with discrete but meaningful designs. High quality t-shirts for believers who want to share their faith.',
  url: 'https://holyfans.pt',
  ogImage: '/images/og-image.jpg',
  links: {
    twitter: 'https://twitter.com/holyfans',
    instagram: 'https://instagram.com/holyfans',
    facebook: 'https://facebook.com/holyfans'
  }
};

export const CHECKOUT_STEPS = [
  {
    id: 'cart',
    name: 'Cart',
    description: 'Review your items'
  },
  {
    id: 'shipping',
    name: 'Shipping',
    description: 'Enter shipping information'
  },
  {
    id: 'confirmation',
    name: 'Confirmation',
    description: 'Review and confirm'
  }
];
