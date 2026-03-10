'use client';

import {useTranslations} from 'next-intl';
import {useCart} from '@/context/cart-context';
import Hero from '@/components/sections/hero';
import ProductGallery from '@/components/sections/product-gallery';
import VariationSelector from '@/components/sections/variation-selector';
import Craftsmanship from '@/components/sections/craftsmanship';
import ObjectionHandling from '@/components/sections/objection-handling';
import FAQ from '@/components/sections/faq';
import SocialProof from '@/components/sections/social-proof';
import Cart from '@/components/sections/cart';
import Checkout from '@/components/sections/checkout';
import FinalCTA from '@/components/sections/final-cta';

export default function HomePage() {
  const t = useTranslations('hero');
  const {addItem} = useCart();

  const handleAddToCart = (item: any) => {
    addItem(item.product, item.variant);
    // You could add a toast notification here
    console.log('Added to cart:', item);
  };

  return (
    <main className="min-h-screen">
      <section id="hero">
        <Hero />
      </section>
      <section id="products">
        <ProductGallery />
      </section>
      <section id="order">
        <VariationSelector onAddToCart={handleAddToCart} />
      </section>
      <section id="craftsmanship">
        <Craftsmanship />
      </section>
      <section id="objections">
        <ObjectionHandling />
      </section>
      <section id="faq">
        <FAQ />
      </section>
      <section id="social">
        <SocialProof />
      </section>
      <section id="final-cta">
        <FinalCTA />
      </section>
      <section id="cart">
        <Cart />
      </section>
      <section id="checkout">
        <Checkout />
      </section>
    </main>
  );
}
