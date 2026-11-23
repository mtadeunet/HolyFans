import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { profileDisplayName, type ModelProfile } from '@/lib/profiles';

interface ProfileHeaderProps {
  /**
   * The Model Profile being presented; its display name is derived
   * from the slug (`profileDisplayName`) — never stored, never
   * localized (ADR 03-004).
   */
  profile: ModelProfile;
}

/**
 * Implements ADR 03-004: Model Profiles — the header of the `/u/<slug>`
 * profile route: a large avatar, the slug-derived display name, the
 * decorative `@<slug>` handle, and the profile's post count. Styled as
 * feed chrome — the same surface, border, and text tokens the Post
 * Card header uses.
 *
 * A server component: the `feed.profile` messages run through
 * next-intl's server-side hooks exactly like the Post Card's caption
 * lookup. The display name is derived, not stored — no sibling-Locale
 * fallback applies (post copy keeps that fallback in
 * `ProfilePostCard`).
 */
export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  const t = useTranslations('feed.profile');
  const name = profileDisplayName(profile);

  return (
    <header className="flex items-center gap-4 border-b border-border bg-surface px-4 py-6">
      {profile.avatar !== '' ? (
        <Image
          src={profile.avatar}
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 rounded-full border border-border object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="h-20 w-20 rounded-full border border-border bg-background"
        />
      )}
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-text-primary">
          {name}
        </p>
        <p className="truncate text-sm text-text-secondary">@{profile.id}</p>
        <p className="mt-1 text-sm text-text-secondary">
          {t('posts_count', { count: profile.posts.length })}
        </p>
      </div>
    </header>
  );
}
