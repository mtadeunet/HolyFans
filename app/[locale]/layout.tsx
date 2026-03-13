import {SITE_CONFIG} from '@/lib/constants';
import {CartProvider} from '@/context/cart-context';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import './globals.css';

export const dynamic = 'force-static';

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

  return (
    <html lang={locale}>
      <head>
        <title key="title">{SITE_CONFIG.name}</title>
        <meta name="description" content={SITE_CONFIG.description} key="description" />
        <meta name="viewport" content="width=device-width, initial-scale=1" key="viewport" />
      </head>
      <body>
        <CartProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
