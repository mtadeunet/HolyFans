'use client';

import { usePathname } from '@/lib/navigation';
import type { ReactNode } from 'react';

interface ChromeFrameProps {
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
 * The single decision point for which chrome system renders: the
 * locale-stripped `usePathname()` from `lib/navigation.ts` returns `/`
 * on each Locale landing root and `/checkout` on the purchase route —
 * both Feed Shell compositions, so the header/footer mounts are
 * suppressed there. The post-checkout success/cancel paths are
 * deliberately outside the set: they are PSP-return endpoints that keep
 * the classic chrome. Global mounts (CartProvider, Inbound Contact
 * Surface, Analytics) stay outside this frame.
 */
const SHELL_ROUTES = new Set(['/', '/checkout']);

export default function ChromeFrame({
  header,
  footer,
  children,
}: ChromeFrameProps) {
  const pathname = usePathname();
  const isShellRoute = SHELL_ROUTES.has(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      {!isShellRoute && header}
      {children}
      {!isShellRoute && footer}
    </div>
  );
}
