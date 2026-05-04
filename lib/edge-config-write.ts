import { SITE_CONFIG_KEY, type SiteConfig } from './site-config';

/**
 * Write an Edge Config item via Vercel's REST API.
 *
 * Required env vars:
 *  - VERCEL_EDGE_CONFIG_ID : the bare id (ecfg_xxx), not the full connection string.
 *  - VERCEL_API_TOKEN      : personal/team token with Edge Config write scope.
 *  - VERCEL_TEAM_ID        : required only when the Edge Config lives under a team.
 */
export async function writeSiteConfig(config: SiteConfig): Promise<void> {
  const configId = process.env.VERCEL_EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!configId) throw new Error('VERCEL_EDGE_CONFIG_ID is not set');
  if (!token) throw new Error('VERCEL_API_TOKEN is not set');

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
