import Craftsmanship from '@/components/sections/craftsmanship';
import FAQ from '@/components/sections/faq';
import FinalCTA from '@/components/sections/final-cta';
import Hero from '@/components/sections/hero';
import ProductGallery from '@/components/sections/product-gallery';
import SocialProof from '@/components/sections/social-proof';
import { getSiteConfig } from '@/lib/site-config';

export default async function HomePage() {
  const { sections, chrome } = await getSiteConfig();

  return (
    <main className="min-h-screen">
      {sections.hero && (
        <section id="hero">
          <Hero showPremiumFeaturesModal={chrome.premiumFeaturesModal} />
        </section>
      )}
      {sections.socialProof && (
        <section id="social-proof">
          <SocialProof />
        </section>
      )}
      {sections.products && (
        <section id="products">
          <ProductGallery />
        </section>
      )}
      {sections.craftsmanship && (
        <section id="craftsmanship">
          <Craftsmanship />
        </section>
      )}
      {sections.faq && (
        <section id="faq">
          <FAQ />
        </section>
      )}
      {sections.finalCta && (
        <section id="final-cta">
          <FinalCTA />
        </section>
      )}
    </main>
  );
}
