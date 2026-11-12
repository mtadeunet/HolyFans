import type { ReactNode } from 'react';
import WhatsAppGlyph from '@/components/ui/whatsapp-glyph';
import { Link } from '@/lib/navigation';
import { whatsappChatUrl } from '@/lib/whatsapp';

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - the Nav Rail holds "a
 * store-adapted list of icon-and-label navigation entries ... Entries
 * are store-purpose only — landing sections, the purchase surface, and
 * the contact channel through the Inbound Contact Surface's deep-link
 * mechanism (ADR 00-009). Social-platform concepts (profiles, messages,
 * notifications) are not carried over."
 *
 * Shared definition and rendering of the shell's navigation entries so
 * the desktop Nav Rail and the mobile bottom navigation band present the
 * identical set — one source, two renderings.
 */

/** One shell navigation entry. */
export interface FeedNavEntry {
  /** Message key under `feed.nav` resolving the localized label. */
  key: 'home' | 'shop' | 'faq' | 'contact' | 'cart';
  /** In-feed anchor (`#…`), the checkout path, or an external deep link. */
  href: string;
  /** `true` for the external WhatsApp deep link (opens in a new tab). */
  external?: boolean;
  /** `true` marks an internal locale-routed path (the purchase surface,
   *  or a `/{locale}#<anchor>` return link on the purchase route),
   *  rendered through the localized `Link` rather than a raw anchor. */
  internal?: boolean;
  /** `true` marks the entry as purchase-surface gated — filtered out by
   *  `buildFeedNavEntries` while the gate is closed. */
  gated?: boolean;
  /** `true` marks the entry as the visually prominent purchase item on
   *  the mobile bottom navigation band. */
  prominent?: boolean;
  /** e2e anchor carried on the rendered element (`nav-cart`). */
  testId?: string;
  /** Icon glyph shared by both renderings. */
  icon: ReactNode;
}

/**
 * Build the shell's navigation entries.
 *
 * Resolves the Inbound Contact Surface's click-to-chat deep link
 * (ADR 00-009) from `NEXT_PUBLIC_WHATSAPP_NUMBER` — the Contact entry
 * fails closed (absent) when the Store Messaging Number is unconfigured.
 * The cart entry is filtered by the fail-closed purchase-surface gate
 * (ADR 00-004 / plan M0): absent entirely while
 * `PURCHASE_SURFACE_ENABLED` is not `'true'`.
 *
 * @param prefilledMessage - Localized text preloaded into the visitor's
 *   chat composer (`whatsapp.prefilled_message`).
 * @param purchaseSurfaceEnabled - Server-evaluated gate; `false` removes
 *   the cart entry so no `/checkout` anchor renders.
 * @param returnToFeed - `true` on the purchase route: in-feed anchor
 *   entries become `/{locale}#<anchor>` Links back to the landing's feed
 *   units (ADR 03-002) instead of same-page anchors.
 * @returns The ordered, fully gated navigation entries.
 */
export function buildFeedNavEntries(
  prefilledMessage: string,
  purchaseSurfaceEnabled: boolean,
  returnToFeed = false
): FeedNavEntry[] {
  const contactUrl = whatsappChatUrl(
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '',
    prefilledMessage
  );

  // On the purchase route, same-page anchors have no target — entries
  // that point at landing feed units resolve to `/{locale}#<anchor>`
  // through the localized Link (Locale prefix preserved, ADR 00-005).
  const feedHref = (anchor: string): Pick<FeedNavEntry, 'href' | 'internal'> =>
    returnToFeed
      ? { href: `/#${anchor}`, internal: true }
      : { href: `#${anchor}` };

  const entries: FeedNavEntry[] = [
    {
      key: 'home',
      ...feedHref('feed'),
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      key: 'shop',
      ...feedHref('products'),
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
    },
    {
      key: 'faq',
      ...feedHref('post-faq'),
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  // Inbound Contact Surface (ADR 00-009): the vendor's click-to-chat
  // deep link, fail-closed — absent entirely when the Store Messaging
  // Number is unconfigured.
  if (contactUrl) {
    entries.push({
      key: 'contact',
      href: contactUrl,
      external: true,
      icon: <WhatsAppGlyph className="h-6 w-6" />,
    });
  }

  // Purchase surface (ADR 00-004 / plan M0 gate): the prominent item on
  // the mobile bottom band; filtered out below while the gate is closed.
  entries.push({
    key: 'cart',
    href: '/checkout',
    gated: true,
    internal: true,
    prominent: true,
    testId: 'nav-cart',
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  });

  return entries.filter((entry) => !entry.gated || purchaseSurfaceEnabled);
}

interface FeedNavLinkProps {
  /** The navigation entry to render. */
  entry: FeedNavEntry;
  /** The resolved localized label (`feed.nav.<key>`). */
  label: string;
  /** Layout classes owned by the caller (rail row vs. bottom-band item). */
  className: string;
  /** The icon + label content; the rail and band style it differently. */
  children: ReactNode;
}

/**
 * Implements ADR 03-002 - the shared rendering of a shell navigation
 * entry: external deep links open in a new tab with `noopener
 * noreferrer`, the gated purchase entry routes through the localized
 * `Link` (Locale prefix preserved, ADR 00-005), and in-feed anchors use
 * a plain anchor. `data-testid` and `aria-label` are driven by the
 * entry, so the Nav Rail and the mobile bottom band can't drift apart.
 */
export function FeedNavLink({
  entry,
  label,
  className,
  children,
}: FeedNavLinkProps) {
  if (entry.external) {
    return (
      <a
        href={entry.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={className}
      >
        {children}
      </a>
    );
  }
  if (entry.internal) {
    return (
      <Link
        href={entry.href}
        data-testid={entry.testId}
        aria-label={label}
        className={className}
      >
        {children}
      </Link>
    );
  }
  return (
    <a href={entry.href} aria-label={label} className={className}>
      {children}
    </a>
  );
}
