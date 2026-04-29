'use server';

import { revalidatePath } from 'next/cache';
import { writeSiteConfig } from '@/lib/edge-config-write';
import {
  CHROME_KEYS,
  SECTION_KEYS,
  type SiteConfig,
} from '@/lib/site-config';

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveSiteConfig(formData: FormData): Promise<SaveResult> {
  const next: SiteConfig = {
    sections: {} as SiteConfig['sections'],
    chrome: {} as SiteConfig['chrome'],
  };

  for (const key of SECTION_KEYS) {
    next.sections[key] = formData.get(`sections.${key}`) === 'on';
  }
  for (const key of CHROME_KEYS) {
    next.chrome[key] = formData.get(`chrome.${key}`) === 'on';
  }

  try {
    await writeSiteConfig(next);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown write error';
    return { ok: false, error: message };
  }

  // Edge Config propagates to readers within ~seconds; invalidate RSC cache so
  // the next request re-renders with the new flags.
  revalidatePath('/', 'layout');
  revalidatePath('/admin');

  return { ok: true };
}
