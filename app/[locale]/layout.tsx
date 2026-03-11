import {NextIntlClientProvider} from 'next-intl';
import {SITE_CONFIG} from '@/lib/constants';
import {CartProvider} from '@/context/cart-context';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import './globals.css';

export function generateStaticParams() {
  return [{locale: 'en'}, {locale: 'pt'}];
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  
  // Load messages for static export
  let messages = {};
  try {
    if (locale === 'pt') {
      messages = require('../../messages/pt.json');
    } else {
      messages = require('../../messages/en.json');
    }
  } catch (error) {
    console.warn('Could not load messages:', error);
  }

  return (
    <html lang={locale}>
      <head>
        <title key="title">{SITE_CONFIG.name}</title>
        <meta name="description" content={SITE_CONFIG.description} key="description" />
        <meta name="viewport" content="width=device-width, initial-scale=1" key="viewport" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <CartProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
