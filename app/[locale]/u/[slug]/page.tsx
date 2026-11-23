import { notFound } from 'next/navigation';
import FeedShell from '@/components/feed/feed-shell';
import ProfileHeader from '@/components/feed/profile-header';
import ProfilePostCard from '@/components/feed/profile-post-card';
import { getManagedStore } from '@/lib/managed-store';
import type { ModelProfile } from '@/lib/profiles';
import { readProfile } from '@/lib/profiles-server';
import { isPurchaseSurfaceEnabled } from '@/lib/purchase-surface';
import { getSiteConfig } from '@/lib/site-config-server';

/**
 * Implements ADR 00-002: Rendering and Hosting Model — profile records
 * are request-time reads of the filesystem (the profile folder) plus
 * the managed store (the `profile:<slug>` overlay): the lookup happens
 * per request so the operator's enable/disable and edits take effect
 * without a rebuild, matching the rest of the Locale tree's
 * request-time rendering posture.
 */
export const dynamic = 'force-dynamic';

interface ProfilePageProps {
  /** Next 16 dynamic params — a Promise resolved at request time. */
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Implements ADR 03-004: Model Profiles — the `/u/<slug>` profile
 * route. An enabled profile whose `id` matches the slug renders inside
 * the Feed Shell — the same three-column chrome the landing and
 * purchase routes compose, with `returnToFeed` so Nav Rail entries
 * bounce back to the landing's feed units within the same Locale
 * (the checkout route's posture). An unknown slug, a disabled
 * profile, or an unconfigured/failing store renders the not-found
 * boundary — unpublished profiles are unreachable, never a stub page.
 *
 * The Feed Surface carries the `ProfileHeader` followed by the
 * profile's VISIBLE posts in alphabetical filename order (the folder
 * order — a post IS its image file), each rendered through the shared
 * `ProfilePostCard` adapter (profile author header, effective
 * caption and alt text, authored base likes). Hidden posts
 * (`visible: false`) render nowhere.
 */
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { slug } = await params;
  const { chrome, stock } = await getSiteConfig();

  // Implements ADR 03-004: the profile exists iff its
  // `public/images/profiles/<slug>/` folder does — the folder is also
  // the post set — and its `profile:<slug>` document is an optional
  // sparse overlay — fail-closed like every store consumer (ADR
  // 00-002): a missing folder, an unconfigured store, or a failed
  // read resolves to `null` and the route 404s below.
  let profile: ModelProfile | null = null;
  const store = getManagedStore();
  if (store !== null) {
    try {
      profile = await readProfile(store, slug);
    } catch (error) {
      console.error('[profiles] store read failed:', error);
    }
  }
  if (profile === null || !profile.enabled || profile.id !== slug) {
    notFound();
  }

  const purchaseSurfaceEnabled = isPurchaseSurfaceEnabled();

  // The render view hides `visible: false` posts — their files stay
  // in the folder for the operator but the posts never reach the
  // visitor (the header's post count follows the same view).
  const visibleProfile: ModelProfile = {
    ...profile,
    posts: profile.posts.filter((post) => post.visible),
  };

  return (
    <FeedShell
      chrome={chrome}
      purchaseSurfaceEnabled={purchaseSurfaceEnabled}
      stockFlags={stock}
      returnToFeed
    >
      <ProfileHeader profile={visibleProfile} />
      {visibleProfile.posts.map((post) => (
        <ProfilePostCard
          key={post.id}
          profile={visibleProfile}
          post={post}
          purchaseSurfaceEnabled={purchaseSurfaceEnabled}
        />
      ))}
    </FeedShell>
  );
}
