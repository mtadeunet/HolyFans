'use client';

import { usePathname } from '@/lib/navigation';
import type { ReactNode } from 'react';

interface ChromeFrameProps {
  /** Promotion Bar mount (ADR 03-003, already gated by the
   *  `promotionBar` chrome toggle in the layout); rendered as the first
   *  element on EVERY route — shell routes included, since the bar sits
   *  above both chrome systems. */
  promotion: ReactNode;
  /** Classic site header mount (already gated by the `header` chrome
   *  toggle in the layout); rendered only off the shell routes. */
  header: ReactNode;
  /** Classic site footer mount (already gated by the `footer` chrome
   *  toggle in the layout); rendered only off the shell routes. */
  footer: ReactNode;
  /** The page body — always rendered. */
  children: ReactNode;
}

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - "the classic site header and
 * footer do not render on either [the Locale landing roots or the
 * Product Page routes] ... Every other route — the post-checkout success and
 * cancel pages, auxiliary and legal pages, and the Admin Console —
 * keeps the classic header/footer chrome, still governed by the
 * existing Site Config chrome toggles."
 *
 * Implements ADR 03-003: Promotion Bar — the bar "renders above all
 * other chrome on every route": the `promotion` mount leads the frame's
 * pinned top-chrome block and is deliberately NOT suppressed on shell
 * routes — unlike header/footer it belongs to neither chrome system.
 * The block is `sticky top-0` so the bar remains visible while the page
 * scrolls (owner requirement) while staying in normal document flow —
 * the bar's expansion still pushes the Header down rather than sliding
 * under it, and document scroll (and `window.scrollY` observers) are
 * preserved.
 *
 * The single decision point for which chrome system renders: the
 * locale-stripped `usePathname()` from `lib/navigation.ts` returns `/`
 * on each Locale landing root, `/checkout` on the purchase route, and
 * `/contact` on the Contact Page (ADR 00-014) — all Feed Shell
 * compositions, so the header/footer mounts are suppressed there. The
 * post-checkout success/cancel paths are deliberately outside the set:
 * they are PSP-return endpoints that keep the classic chrome. Global
 * mounts (CartProvider, Analytics) stay outside this frame.
 */
const SHELL_ROUTES = new Set(['/', '/checkout', '/contact']);

export default function ChromeFrame({
  promotion,
  header,
  footer,
  children,
}: ChromeFrameProps) {
  const pathname = usePathname();
  // Implements ADR 03-004: Model Profiles — the `/u/<slug>` profile
  // routes compose the Feed Shell like the landing and purchase
  // routes, so the classic header/footer is suppressed there too.
  const isShellRoute = SHELL_ROUTES.has(pathname) || pathname.startsWith('/u/');

  return (
    <div className="flex min-h-screen flex-col">
      {/* Pinned top-chrome block (owner requirement: the Promotion Bar
          stays visible at the top of the viewport while the feed
          scrolls). `sticky` keeps the whole unit in normal flow, so the
          bar's in-flow expansion still pushes the Header down exactly as
          ADR 03-003 specifies — the pair simply pins as one block instead
          of scrolling away. The Header's own `sticky top-0` becomes inert
          here (its containing block ends at its own box), so it always
          rides directly beneath the bar with no z-fight. `z-[45]` sits
          above the z-40 fixed bands (MobileTopBar, MobileBottomNav,
          Inbound Contact Surface) and below the z-50 overlay tier
          (modals), regardless of paint order. When `promotion` renders
          `null` (toggle off or no eligible campaign) the block holds only
          the Header — behavior identical to before. */}
      <div className="sticky top-0 z-[45]">
        {promotion}
        {!isShellRoute && header}
      </div>
      {children}
      {!isShellRoute && footer}
    </div>
  );
}
