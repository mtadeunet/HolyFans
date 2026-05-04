import { NextResponse } from 'next/server';
import { get } from '@vercel/edge-config';
import { NextRequest } from 'next/server';
import { SITE_CONFIG_KEY } from '@/lib/site-config';

const QRCODE_REDIRECT_KEY = 'qrcoderedirect';
const QRCODE_REDIRECT_DOTTED_KEY = `${SITE_CONFIG_KEY}.${QRCODE_REDIRECT_KEY}`;

type SiteConfigRecord = {
  sections?: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
  const fallbackUrl = new URL('/', request.nextUrl).href;

  if (!process.env.EDGE_CONFIG) {
    return NextResponse.redirect(fallbackUrl);
  }

  try {
    const dottedValue = await get(QRCODE_REDIRECT_DOTTED_KEY);
    if (typeof dottedValue === 'string' && dottedValue.trim().length > 0) {
      return NextResponse.redirect(dottedValue);
    }

    const siteConfig = await get<SiteConfigRecord>(SITE_CONFIG_KEY);
    const value =
      siteConfig?.sections && typeof siteConfig.sections === 'object'
        ? siteConfig.sections[QRCODE_REDIRECT_KEY]
        : undefined;

    if (typeof value === 'string' && value.trim().length > 0) {
      return NextResponse.redirect(value);
    }

    return NextResponse.redirect(fallbackUrl);
  } catch (error) {
    console.error('[qrcoderedirect] Edge Config read failed:', error);
    return NextResponse.redirect(fallbackUrl);
  }
}
