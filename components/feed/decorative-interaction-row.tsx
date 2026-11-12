'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface DecorativeInteractionRowProps {
  /** Authored decorative like count from `FEED_POSTS`. */
  likes: number;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "Social-style affordances
 * (like, comment, bookmark glyphs and a like count) are presentational
 * only. Any state is ephemeral and client-local — an Island per
 * ADR 00-001 — never persisted, never transmitted, never attributed to
 * real people, and invisible to analytics."
 *
 * The Post Card's Decorative Interaction Row. The like glyph toggles a
 * local `useState` (count ±1 for this mount only — a reload resets it);
 * comment and bookmark are inert decorative marks inside an
 * `aria-hidden` group so they read as content, not controls. Nothing is
 * persisted, sent anywhere, or measured (ADR 00-002, ADR 00-008).
 */
export default function DecorativeInteractionRow({
  likes,
}: DecorativeInteractionRowProps) {
  const t = useTranslations('feed.post');
  const [liked, setLiked] = useState(false);
  const count = likes + (liked ? 1 : 0);

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={() => setLiked((prev) => !prev)}
        aria-pressed={liked}
        aria-label={t('like_aria')}
        className={`flex items-center justify-center transition-colors ${
          liked ? 'text-primary' : 'text-text-secondary hover:text-primary'
        }`}
      >
        <svg
          className="h-6 w-6"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={liked ? 0 : 2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </button>
      <span className="text-sm font-medium text-text-secondary">
        {t('likes', { count })}
      </span>

      {/* Inert decorative marks: `aria-hidden` keeps them out of the
          accessibility tree so they can never be mistaken for working
          controls (ADR 03-002). */}
      <span
        aria-hidden="true"
        className="ml-auto flex items-center gap-4 text-text-secondary/60"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4-.849L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      </span>
    </div>
  );
}
