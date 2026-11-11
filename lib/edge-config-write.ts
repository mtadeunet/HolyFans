import { writeFile } from 'fs/promises';
import { SITE_CONFIG_KEY, type SiteConfig } from './site-config';
import { LOCAL_SITE_CONFIG_PATH } from './site-config-server';

/**
 * Write an Edge Config item via Vercel's REST API.
 *
 * Required env vars:
 *  - VERCEL_EDGE_CONFIG_ID : the bare id (ecfg_xxx), not the full connection string.
 *  - VERCEL_API_TOKEN      : personal/team token with Edge Config write scope.
 *  - VERCEL_TEAM_ID        : required only when the Edge Config lives under a team.
 *
 * Local fallback: only when `EDGE_CONFIG` is unset (local dev — the read
 * path is file-backed) is the config persisted to
 * `LOCAL_SITE_CONFIG_PATH` — an untracked file that `getSiteConfig()`
 * reads back — so the admin toggles work locally without Vercel wiring.
 *
 * When `EDGE_CONFIG` IS set but `VERCEL_EDGE_CONFIG_ID` or
 * `VERCEL_API_TOKEN` is missing, the function throws naming the missing
 * vars — writing the local file there would report success while
 * `getSiteConfig()` keeps reading Edge Config, silently swallowing the
 * save.
 */
export async function writeSiteConfig(config: SiteConfig): Promise<void> {
  // The file fallback is valid only while the read path is file-backed.
  if (!process.env.EDGE_CONFIG) {
    await writeFile(
      LOCAL_SITE_CONFIG_PATH,
      JSON.stringify(config, null, 2) + '\n',
      'utf8'
    );
    return;
  }

  const configId = process.env.VERCEL_EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  // Fail closed: with EDGE_CONFIG set the write needs real credentials —
  // incomplete configuration must surface as an error, not a silent no-op.
  if (!configId || !token) {
    const missing = [
      configId ? null : 'VERCEL_EDGE_CONFIG_ID',
      token ? null : 'VERCEL_API_TOKEN',
    ].filter((name): name is string => name !== null);
    throw new Error(`Edge Config write requires ${missing.join(' and ')}`);
  }

  const url = new URL(
    `https://api.vercel.com/v1/edge-config/${configId}/items`
  );
  if (teamId) url.searchParams.set('teamId', teamId);

  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          operation: 'upsert',
          key: SITE_CONFIG_KEY,
          value: config,
        },
      ],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Edge Config write failed (${response.status}): ${text || response.statusText}`
    );
  }
}
