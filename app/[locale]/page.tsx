import FeedPosts from '@/components/feed/feed-posts';
import FeedShell from '@/components/feed/feed-shell';
import { getManagedStore } from '@/lib/managed-store';
import type { ModelProfile } from '@/lib/profiles';
import { readProfiles } from '@/lib/profiles-server';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import { getSiteConfig } from '@/lib/site-config-server';

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "The Locale landing roots
 * and the purchase route are composed as a Feed Shell — a three-column
 * layout consisting of a Nav Rail (left), a Feed Surface (center), and
 * a Suggestions Rail (right)."
 *
 * The Locale landing root: renders the Feed Shell with the authored
 * Post Card scroll as the Feed Surface's occupant, the Site Config
 * section/chrome toggles, the filesystem Model Profiles merged with
 * their managed-store overlays (ADR 03-004), and the
 * server-evaluated, fail-closed purchase-surface gate threaded
 * through.
 */
export default async function HomePage() {
  const { sections, chrome, stock } = await getSiteConfig();
  const purchaseSurfaceEnabled = isPurchaseSurfaceEnabled();

  // Implements ADR 03-004: Model Profiles — the profile set is the
  // filesystem (`public/images/profiles/<slug>/` folders — the post
  // set too, one post per non-`profile*` image file) overlaid with
  // the managed store's `profile:<slug>` sparse documents, read at
  // request time so the operator's edits take effect without a
  // rebuild. Fail-closed like every store consumer (ADR 00-002): an
  // unconfigured store or a failed read renders no profile posts —
  // the landing is never a crash. `FeedPosts` owns the enabled
  // filter — an unpublished profile's posts render nowhere, matching
  // the profile route's not-found posture.
  let profiles: ModelProfile[] = [];
  const store = getManagedStore();
  if (store !== null) {
    try {
      profiles = await readProfiles(store);
    } catch (error) {
      console.error('[profiles] store read failed:', error);
    }
  }

  return (
    <FeedShell
      chrome={chrome}
      purchaseSurfaceEnabled={purchaseSurfaceEnabled}
      stockFlags={stock}
    >
      <FeedPosts
        sections={sections}
        chrome={chrome}
        purchaseSurfaceEnabled={purchaseSurfaceEnabled}
        profiles={profiles}
      />
    </FeedShell>
  );
}
