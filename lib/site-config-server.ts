import { get } from '@vercel/edge-config';
import { readFile } from 'fs/promises';
import path from 'path';
import {
  DEFAULT_SITE_CONFIG,
  normalizeSiteConfig,
  SITE_CONFIG_KEY,
  type SiteConfig,
} from './site-config';

/**
 * Server-only: reads the Site Config store (Edge Config in production, a
 * local JSON file in dev). Never import this module from client code —
 * it pulls in `fs`, which webpack can't bundle for the browser. Shared
 * types/keys stay in `lib/site-config.ts` for that reason.
 */

/**
 * Untracked local stand-in for Edge Config, used only when `EDGE_CONFIG`
 * is unset (local dev). `writeSiteConfig()` persists here, `getSiteConfig()`
 * reads it back — the admin toggles work locally with no Vercel wiring.
 */
export const LOCAL_SITE_CONFIG_PATH = path.join(
  process.cwd(),
  '.site-config.local.json'
);

/**
 * Fetch the current site config from Vercel Edge Config.
 * Returns defaults (all enabled) if the store is unavailable or the key is missing.
 *
 * When `EDGE_CONFIG` is unset (local dev), falls back to the untracked
 * `LOCAL_SITE_CONFIG_PATH` file so admin toggles work without Vercel wiring.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (!process.env.EDGE_CONFIG) {
    try {
      const raw = await readFile(LOCAL_SITE_CONFIG_PATH, 'utf8');
      return normalizeSiteConfig(JSON.parse(raw));
    } catch {
      return DEFAULT_SITE_CONFIG;
    }
  }
  try {
    const raw = await get(SITE_CONFIG_KEY);
    return normalizeSiteConfig(raw);
  } catch (error) {
    console.error('[site-config] Edge Config read failed:', error);
    return DEFAULT_SITE_CONFIG;
  }
}
