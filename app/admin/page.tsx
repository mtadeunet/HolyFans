import { getSiteConfig } from '@/lib/site-config-server';
import {
  basePostAggregates,
  getLikesStore,
  readPostAggregates,
  type PostLikesAggregate,
} from '@/lib/likes-server';
import AdminForm from './admin-form';
import LikesSection, { type LikesStoreStatus } from './likes-section';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const config = await getSiteConfig();

  // Implements ADR 00-002: Rendering and Hosting Model - the Admin
  // Console's "request-time read of the like store's aggregate state —
  // per-post totals, per-post last-like timestamps, and store health —
  // aggregates only, never Like Token membership (ADR 00-008)". An
  // unconfigured or failing store surfaces as an explicit status and
  // falls back to authored base counts — visible, never silent.
  const store = getLikesStore();
  let status: LikesStoreStatus;
  let statusDetail: string | undefined;
  let aggregates: PostLikesAggregate[];
  if (store === null) {
    status = 'unconfigured';
    aggregates = basePostAggregates();
  } else {
    try {
      aggregates = await readPostAggregates(store);
      status = 'connected';
    } catch (error) {
      console.error('[admin] like-store read failed:', error);
      status = 'error';
      statusDetail =
        error instanceof Error ? error.message : 'Unknown read error';
      aggregates = basePostAggregates();
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-text-primary">
          HolyFans Admin
        </h1>
        <p className="mt-2 text-text-secondary">
          Toggle which sections and chrome elements appear on the live site.
          Changes are persisted to Vercel Edge Config.
        </p>
      </header>
      <div className="space-y-8">
        <AdminForm initial={config} />
        <LikesSection
          status={status}
          statusDetail={statusDetail}
          aggregates={aggregates}
        />
      </div>
    </main>
  );
}
