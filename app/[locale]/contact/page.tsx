import { getTranslations } from 'next-intl/server';
import FeedShell from '@/components/feed/feed-shell';
import ContactForm from '@/components/sections/contact-form';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import { getSiteConfig } from '@/lib/site-config-server';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - "Site Config is
 * read from Edge Config at request time" — the Locale tree renders at
 * request time (the layout's `force-dynamic`), so the chrome and Stock
 * Flags the shell consumes are evaluated per request.
 */
export const dynamic = 'force-dynamic';

/**
 * Implements ADR 00-014: Contact Channel — "a **Contact Page inside
 * the Feed Shell** ... the Feed Surface carries the Contact Form while
 * the Nav Rail and the mobile bottom band persist. It is a third page
 * kind beside the Landing Page and Product Pages — an auxiliary
 * support page composed inside the shell rather than under the
 * classic header/footer chrome (ADR 00-011, ADR 03-002)."
 *
 * The Locale-prefixed Contact Page (`/<Locale>/contact`): the Feed
 * Surface carries the Contact Form panel; Nav Rail anchor entries get
 * `returnToFeed` so they resolve back to the landing's feed units
 * within the same Locale — the same composition the purchase route
 * uses. Gate posture (ADR 00-014): "it is NOT behind the
 * Purchase-Surface Gate and must work pre-launch" — no
 * `isPurchaseSurfaceEnabled()` check gates this page; the flag only
 * feeds the shell's cart-entry gating, exactly like the landing page.
 *
 * @returns The shell-wrapped contact panel.
 */
export default async function ContactPage() {
  const { chrome, stock } = await getSiteConfig();
  const purchaseSurfaceEnabled = isPurchaseSurfaceEnabled();
  const t = await getTranslations('contact');

  return (
    <FeedShell
      chrome={chrome}
      purchaseSurfaceEnabled={purchaseSurfaceEnabled}
      returnToFeed
      stockFlags={stock}
    >
      {/* Feed Surface occupant (ADR 00-014 / ADR 03-002): the contact
          panel — one centered card holding the heading, the intro,
          and the Contact Form Island. */}
      <section className="bg-background px-4 py-16 md:py-24">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl md:p-8">
          <div className="mb-8 text-center">
            <h1 className="mb-4 font-serif text-3xl text-text-primary md:text-4xl">
              {t('heading')}
            </h1>
            <p className="text-text-secondary">{t('intro')}</p>
          </div>
          <ContactForm />
        </div>
      </section>
    </FeedShell>
  );
}
