import FeedPosts from '@/components/feed/feed-posts';
import FeedShell from '@/components/feed/feed-shell';
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
 * section/chrome toggles, and the server-evaluated, fail-closed
 * purchase-surface gate threaded through.
 */
export default async function HomePage() {
  const { sections, chrome } = await getSiteConfig();
  const purchaseSurfaceEnabled = isPurchaseSurfaceEnabled();

  return (
    <FeedShell chrome={chrome} purchaseSurfaceEnabled={purchaseSurfaceEnabled}>
      <FeedPosts
        sections={sections}
        chrome={chrome}
        purchaseSurfaceEnabled={purchaseSurfaceEnabled}
      />
    </FeedShell>
  );
}
