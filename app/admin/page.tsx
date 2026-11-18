import type { Redis } from '@upstash/redis';
import { getSiteConfig } from '@/lib/site-config-server';
import { basePostAggregates, readPostAggregates } from '@/lib/likes-server';
import { getManagedStore } from '@/lib/managed-store';
import {
  baseVariantStockNotifications,
  readVariantStockNotifications,
} from '@/lib/stock-notification-server';
import AdminForm from './admin-form';
import { AdminTabPanel, AdminTabs } from './admin-tabs';
import LikesSection from './likes-section';
import StockNotificationsSection from './stock-notifications-section';
import type { StoreStatus } from './types';

export const dynamic = 'force-dynamic';

/**
 * The Admin Console's store-section read pattern, shared by the Likes
 * and Stock Notifications sections: an unconfigured store reports
 * `'unconfigured'` with the section's authored base, a successful read
 * `'connected'`, and a failing read `'error'` — the store's health and
 * any failure surfaced explicitly, never silently (ADR 00-002).
 *
 * @param store - The shared managed-store client, or `null` when
 *   unconfigured.
 * @param read - The section's live read over the store.
 * @param base - The section's degraded base data.
 * @param logLabel - The store name used in the server log prefix.
 * @returns The section's status, optional error detail, and the data
 *   to render.
 */
async function readStoreSection<T>(
  store: Redis | null,
  read: (store: Redis) => Promise<T>,
  base: () => T,
  logLabel: string
): Promise<{
  status: StoreStatus;
  statusDetail?: string;
  data: T;
}> {
  if (store === null) {
    return { status: 'unconfigured', data: base() };
  }
  try {
    return { status: 'connected', data: await read(store) };
  } catch (error) {
    console.error(`[admin] ${logLabel} read failed:`, error);
    return {
      status: 'error',
      statusDetail:
        error instanceof Error ? error.message : 'Unknown read error',
      data: base(),
    };
  }
}

export default async function AdminPage() {
  const config = await getSiteConfig();
  const store = getManagedStore();

  // Implements ADR 00-002: Rendering and Hosting Model - the Admin
  // Console's "request-time read of the like store's aggregate state —
  // per-post totals, per-post last-like timestamps, and store health —
  // aggregates only, never Like Token membership (ADR 00-008)". An
  // unconfigured or failing store surfaces as an explicit status and
  // falls back to authored base counts — visible, never silent.
  const likes = await readStoreSection(
    store,
    readPostAggregates,
    basePostAggregates,
    'like-store'
  );

  // Implements ADR 00-010: Pre-order and Stock Notification — "the list
  // is an operator-held record the operator can export and clear": the
  // Admin Console's request-time read of the Stock Notification List,
  // per Variant, over the same shared managed store — the export half
  // of the ADR 00-008 deletion path. The same surfacing posture as the
  // Likes view: an unconfigured or failing store reports an explicit
  // status and renders the section empty rather than silently.
  const notifications = await readStoreSection(
    store,
    readVariantStockNotifications,
    baseVariantStockNotifications,
    'stock-notification'
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-text-primary">
          HolyFans Admin
        </h1>
        <p className="mt-2 text-text-secondary">
          Edit the live site&apos;s config — sections, chrome, stock flags,
          shipping, promotion campaigns, and email templates — and review
          per-post likes and the stock-notification lists. Config changes are
          persisted to Vercel Edge Config.
        </p>
      </header>
      {/* The console's five tabs: the form owns the three write-path
          panels (Layout, Promotions, Email); the read/operate sections
          get their own panels as siblings. */}
      <AdminTabs>
        <AdminForm initial={config} />
        <AdminTabPanel id="social">
          <LikesSection
            status={likes.status}
            statusDetail={likes.statusDetail}
            aggregates={likes.data}
          />
        </AdminTabPanel>
        <AdminTabPanel id="customers">
          <StockNotificationsSection
            status={notifications.status}
            statusDetail={notifications.statusDetail}
            lists={notifications.data}
          />
        </AdminTabPanel>
      </AdminTabs>
    </main>
  );
}
