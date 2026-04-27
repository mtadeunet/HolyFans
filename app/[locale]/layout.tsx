import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { SITE_CONFIG } from '@/lib/constants';
import { CartProvider } from '@/context/cart-context';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import {Analytics} from '@vercel/analytics/next';
import './globals.css';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

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
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </CartProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
