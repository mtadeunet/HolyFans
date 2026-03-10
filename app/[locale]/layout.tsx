import {NextIntlClientProvider} from 'next-intl';
import {getMessages, getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/lib/routing';
import {SITE_CONFIG} from '@/lib/constants';
import {CartProvider} from '@/context/cart-context';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import './globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({params}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'common'});
  
  return {
    title: `${SITE_CONFIG.name} | ${t('tagline')}`,
    description: SITE_CONFIG.description,
    openGraph: {
      title: `${SITE_CONFIG.name} | ${t('tagline')}`,
      description: SITE_CONFIG.description,
      url: `${SITE_CONFIG.url}/${locale}`,
      siteName: SITE_CONFIG.name,
      images: [
        {
          url: SITE_CONFIG.ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_CONFIG.name} - ${t('tagline')}`,
        },
      ],
      locale: locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_CONFIG.name} | ${t('tagline')}`,
      description: SITE_CONFIG.description,
      images: [SITE_CONFIG.ogImage],
    },
    alternates: {
      canonical: `${SITE_CONFIG.url}/${locale}`,
      languages: {
        'pt-PT': `${SITE_CONFIG.url}/pt`,
        'en-US': `${SITE_CONFIG.url}/en`,
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params
}) {
  // Ensure that the incoming `locale` is valid
  const {locale} = await params;
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <CartProvider>
          <NextIntlClientProvider messages={messages}>
            <Header />
            <main className="pt-16 md:pt-20">
              {children}
            </main>
            <Footer />
          </NextIntlClientProvider>
        </CartProvider>
      </body>
    </html>
  );
}
