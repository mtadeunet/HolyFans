import type { Redis } from '@upstash/redis';
import { getSiteConfig } from '@/lib/site-config-server';
import { basePostAggregates, readPostAggregates } from '@/lib/likes-server';
import { getManagedStore } from '@/lib/managed-store';
import { readOrders } from '@/lib/orders-server';
import { allProfilePosts, type ProfilePost } from '@/lib/profiles';
import {
  deriveProfilePosts,
  listProfileFolders,
  listProfileImages,
  readProfiles,
} from '@/lib/profiles-server';
import {
  baseVariantStockNotifications,
  readVariantStockNotifications,
} from '@/lib/stock-notification-server';
import AdminForm from './admin-form';
import { AdminTabPanel, AdminTabs } from './admin-tabs';
import LikesSection from './likes-section';
import OrdersSection from './orders-section';
import ProfilesSection from './profiles-section';
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

/**
 * Implements ADR 03-004: Model Profiles — the Profiles tab's avatar
 * select is picker-only (no upload path) and per-model: each
 * profile's picker enumerates `public/images/profiles/<slug>/`, the
 * folder name matching the profile slug. This builds the
 * slug-to-paths map it indexes — the same sorted image listing the
 * server-side avatar fallback applies (`listProfileImages`), so the
 * picker and the fallback can never disagree on what the folder
 * offers. Files outside `public/images/profiles/` belong to no model
 * and are ignored. Fail-soft like every filesystem read in the
 * feature: an unreadable folder simply contributes no options.
 *
 * @param folders - The profile slugs the filesystem defines
 *   (`listProfileFolders` output).
 * @returns A map from each profile folder slug to its sorted
 *   `/images/profiles/<slug>/<file>` image paths.
 */
async function listAvailableImages(
  folders: readonly string[]
): Promise<Record<string, string[]>> {
  return Object.fromEntries(
    await Promise.all(
      folders.map(
        async (slug) => [slug, await listProfileImages(slug)] as const
      )
    )
  );
}

/**
 * Implements ADR 03-004: Model Profiles — the derived baseline posts
 * (files + sidecar captions, no overlay applied) of the folders the
 * profiles read did NOT materialize, the fallback the Profiles tab's
 * drafts use for a folder whose stored overlay is unreadable — and
 * the same derivation `saveProfile` diffs submissions against. Pure
 * filesystem reads: no store involved, fail-soft per folder like the
 * rest of the feature.
 *
 * @param folders - The slugs needing fallback drafts — folders with no
 *   materialized profile (a corrupt document, or a read while the
 *   store was unconfigured); folders whose merged profile already
 *   enumerates the same derived posts are never re-derived.
 * @returns A map from each given folder slug to its derived posts in
 *   filename order.
 */
async function listBaselinePosts(
  folders: readonly string[]
): Promise<Record<string, ProfilePost[]>> {
  return Object.fromEntries(
    await Promise.all(
      folders.map(
        async (slug) => [slug, await deriveProfilePosts(slug)] as const
      )
    )
  );
}

export default async function AdminPage() {
  const config = await getSiteConfig();
  const store = getManagedStore();

  // Implements ADR 03-004: Model Profiles — the profile set IS the
  // filesystem: the `public/images/profiles/<slug>/` folders enumerate
  // the models the tab's selector offers and feed the avatar picker's
  // image map. The per-folder `profile:<slug>` overlay documents live
  // in the managed store, merged onto the folders' derived posts at
  // read and surfaced through the same store-section pattern as Likes
  // and Stock Notifications: an unconfigured store reports
  // 'unconfigured' with an empty list, a failing read 'error' —
  // explicit, never silent. The single folder enumeration is passed
  // through — the read does not re-list the profiles root the pickers
  // already read.
  const folders = await listProfileFolders();
  const [availableImages, profiles] = await Promise.all([
    listAvailableImages(folders),
    readStoreSection(
      store,
      (client) => readProfiles(client, { folders }),
      () => [],
      'profiles'
    ),
  ]);

  // Implements ADR 03-004: each folder's derived baseline posts feed
  // the tab's fallback drafts — computed only for folders the profiles
  // read did not materialize (a corrupt document, or any folder while
  // the store is unconfigured): a folder whose merged profile already
  // enumerates the same derived posts is never derived twice.
  const baselinePosts = await listBaselinePosts(
    folders.filter(
      (slug) => !profiles.data.some((profile) => profile.id === slug)
    )
  );

  // Implements ADR 03-004: Model Profiles — the folders' derived
  // profile posts join the aggregate like view after the authored
  // FEED_POSTS entries, listed by their deterministic `pp-` ids
  // as-is, from the same store+filesystem read the Profiles tab
  // renders.
  const profilePosts = allProfilePosts(profiles.data);

  // Implements ADR 00-002: Rendering and Hosting Model - the Admin
  // Console's "request-time read of the like store's aggregate state —
  // per-post totals, per-post last-like timestamps, and store health —
  // aggregates only, never Like Token membership (ADR 00-008)". An
  // unconfigured or failing store surfaces as an explicit status and
  // falls back to authored base counts — visible, never silent.
  const likes = await readStoreSection(
    store,
    (client) => readPostAggregates(client, profilePosts),
    () => basePostAggregates(profilePosts),
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

  // Implements ADR 00-015: Transactional Notifications — the Orders
  // tab's request-time read of the Order Ledger, newest-first through
  // the `orders` index — "the fulfillment/audit copy" the manual
  // Fulfillment ships against. The same surfacing posture as the
  // Likes view: an unconfigured or failing store reports an explicit
  // status and renders the section empty rather than silently.
  const orders = await readStoreSection(store, readOrders, () => [], 'orders');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-text-primary">
          HolyFans Admin
        </h1>
        <p className="mt-2 text-text-secondary">
          Edit the live site&apos;s config — sections, chrome, stock flags,
          shipping, promotion campaigns, and email templates — manage model
          profiles, review per-post likes and the stock-notification lists, and
          work the order ledger&apos;s fulfillment detail. Config changes are
          persisted to Vercel Edge Config; profiles, notifications, and orders
          live in the managed store.
        </p>
      </header>
      {/* The console's seven tabs: the form owns the three Site Config
          write-path panels (Layout, Promotions, Email); Profiles,
          Social, Customers, and Orders are managed-store sections
          rendered as sibling panels. */}
      <AdminTabs>
        <AdminForm initial={config} />
        <AdminTabPanel id="profiles">
          <ProfilesSection
            status={profiles.status}
            statusDetail={profiles.statusDetail}
            folders={folders}
            profiles={profiles.data}
            baselinePosts={baselinePosts}
            availableImages={availableImages}
          />
        </AdminTabPanel>
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
        <AdminTabPanel id="orders">
          <OrdersSection
            status={orders.status}
            statusDetail={orders.statusDetail}
            orders={orders.data}
          />
        </AdminTabPanel>
      </AdminTabs>
    </main>
  );
}
