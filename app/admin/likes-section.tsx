import Image from 'next/image';
import { FEED_POSTS } from '@/lib/feed-posts';
import type { PostLikesAggregate } from '@/lib/likes-server';
import { formatStoreTimestamp } from './format-timestamp';
import type { StoreStatus } from './types';

/**
 * Implements ADR 00-002: Rendering and Hosting Model - the Admin
 * Console's "request-time read of the like store's aggregate state —
 * per-post totals, per-post last-like timestamps, and store health —
 * aggregates only, never Like Token membership (ADR 00-008)".
 *
 * The Admin Console's Likes section: a compact card per Post Card with
 * its live like total and the timestamp of its most recently recorded
 * like event, plus a banner reporting the like store's health. Every
 * figure shown is an aggregate — no Like Token or per-visitor datum
 * ever reaches this surface (ADR 00-008).
 */

interface LikesSectionProps {
  /** Store health: connected, unconfigured, or a failed read. */
  status: StoreStatus;
  /** The store's error message when `status` is `'error'`. */
  statusDetail?: string;
  /** One aggregate per Post Card, in feed order; falls back to
   *  authored base counts with no timestamps when the store is down. */
  aggregates: PostLikesAggregate[];
}

/**
 * The Likes section body — a presentational server component; the page
 * supplies the store read's outcome as props.
 *
 * @param props - Store status plus the per-post aggregates.
 * @returns The Likes section markup.
 */
export default function LikesSection({
  status,
  statusDetail,
  aggregates,
}: LikesSectionProps) {
  const aggregateByPost = new Map(
    aggregates.map((aggregate) => [aggregate.postId, aggregate])
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-1 text-xl font-semibold text-text-primary">Likes</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Per-post totals and last-like times from the managed store.
      </p>

      {/* Store health banner — connected, unconfigured, or a failed
          read, with the error surfaced rather than silent. */}
      {status === 'connected' && (
        <p className="mb-4 text-sm text-green-700" role="status">
          Like store: connected.
        </p>
      )}
      {status === 'unconfigured' && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          Like store: not configured — showing authored base counts only.
        </p>
      )}
      {status === 'error' && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          Like store: read failed
          {statusDetail ? ` — ${statusDetail}` : ''}. Showing authored base
          counts only.
        </p>
      )}

      <ul className="space-y-2">
        {FEED_POSTS.map((post) => {
          const aggregate = aggregateByPost.get(post.id);
          return (
            <li
              key={post.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3"
            >
              {/* Post thumbnail — rendered only when the post carries
                  an in-repo image master; image-less posts get no
                  stand-in tile (ADR 03-002's Imagery rule). */}
              {post.media && (
                <Image
                  src={post.media.src}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <code className="block truncate text-sm font-medium text-text-primary">
                  {post.id}
                </code>
                <span className="block text-xs text-text-secondary">
                  Last like:{' '}
                  {aggregate?.lastLikeAt
                    ? formatStoreTimestamp(aggregate.lastLikeAt)
                    : '—'}
                </span>
              </div>
              <span className="text-sm font-semibold text-text-primary">
                {aggregate?.count ?? post.likes} likes
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
