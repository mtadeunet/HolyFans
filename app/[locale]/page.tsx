export const dynamic = 'force-static';

import Craftsmanship from '@/components/sections/craftsmanship';
import FAQ from '@/components/sections/faq';
import FinalCTA from '@/components/sections/final-cta';
import Hero from '@/components/sections/hero';
import ObjectionHandling from '@/components/sections/objection-handling';
import ProductGallery from '@/components/sections/product-gallery';
import Purchase from '@/components/sections/purchase';
import SocialProof from '@/components/sections/social-proof';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section id="hero">
        <Hero />
      </section>
      <section id="products">
        <ProductGallery />
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
      <section id="social-proof">
        <SocialProof />
      </section>
      <section id="purchase">
        <Purchase />
      </section>
      <section id="final-cta">
        <FinalCTA />
      </section>
    </main>
  );
}
