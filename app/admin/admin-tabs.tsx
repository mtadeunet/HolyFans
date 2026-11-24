'use client';

import {
  createContext,
  useContext,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/**
 * Implements ADR 00-005: Internationalization — "the Admin Console is
 * likewise outside localization": the tab vocabulary below is hardcoded
 * English, the operator-facing convention of this surface.
 *
 * Implements ADR 03-001: Design System and Visual Identity — the tab
 * strip is styled purely through Design Tokens, and the bright blue
 * `primary` token carries "active and highlighted states": the active
 * tab wears the `primary` underline while inactive tabs rest on the
 * `border`/`text-secondary` pairing of the section cards.
 */

/** The Admin Console's tab identifiers — one per console area. */
export type TabId =
  | 'layout'
  | 'profiles'
  | 'promotions'
  | 'email'
  | 'social'
  | 'customers'
  | 'orders';

interface AdminTab {
  /** The tab's stable id, shared by the tab button and its panel. */
  id: TabId;
  /** The tab's operator-facing label. */
  label: string;
}

/**
 * The console's tabs in strip order: the Site Config write-path tabs —
 * Layout, Promotions, Email, which together carry the Site Config
 * form — with the Profiles managed-store editor between them, then
 * the read/operate tabs (Social: post likes; Customers: the
 * stock-notification lists; Orders: the Order Ledger).
 */
export const ADMIN_TABS: readonly AdminTab[] = [
  { id: 'layout', label: 'Layout' },
  // Implements ADR 03-004: Model Profiles — the Profiles tab sits right
  // after Layout; it edits the managed store's profile records through
  // its own section, outside the Site Config form.
  { id: 'profiles', label: 'Profiles' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'email', label: 'Email' },
  { id: 'social', label: 'Social' },
  { id: 'customers', label: 'Customers' },
  // Implements ADR 00-015: Transactional Notifications — the Orders
  // tab reads and edits the managed store's Order Ledger records
  // through its own section, outside the Site Config form.
  { id: 'orders', label: 'Orders' },
];

/** The console's default tab — it opens on the form's Layout panel. */
const DEFAULT_TAB: TabId = 'layout';

/**
 * The active tab, provided by `AdminTabs` to every descendant:
 * `AdminTabPanel` reads it to hide or show itself and `AdminForm`
 * reads it to gate the submit row.
 */
const AdminTabContext = createContext<TabId>(DEFAULT_TAB);

/**
 * Read the Admin Console's active tab.
 *
 * @returns The active `TabId` — `'layout'` outside an `AdminTabs`
 *   wrapper, matching the strip's default.
 */
export function useAdminTab(): TabId {
  return useContext(AdminTabContext);
}

/** The DOM id of a tab's button — the panel's `aria-labelledby`. */
const tabDomId = (tab: TabId): string => `admin-tab-${tab}`;
/** The DOM id of a tab's panel — the tab's `aria-controls`. */
const panelDomId = (tab: TabId): string => `admin-panel-${tab}`;

interface AdminTabsProps {
  /** The console's content: the Site Config form plus the read/operate
   *  sections, each inside an `AdminTabPanel`. */
  children: ReactNode;
}

/**
 * The Admin Console's tab strip — owns the active-tab state and
 * renders one button per `ADMIN_TABS` entry. Follows the ARIA tabs
 * pattern: a `tablist` of `tab` buttons with a roving tabindex, and
 * Arrow / Home / End keys moving focus and selecting in one step —
 * automatic activation, since every panel is already mounted and
 * switching is instant.
 *
 * @param props - The console's panels.
 * @returns The tab strip, the provider, and the panels.
 */
export function AdminTabs({ children }: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);

  /**
   * ARIA tablist keyboard support: ArrowRight/ArrowLeft cycle through
   * the strip (wrapping at both ends), Home/End jump to the first/last
   * tab. Focus follows the selection so a keyboard operator never has
   * to tab through inactive buttons.
   *
   * @param event - The keydown on the tablist.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = ADMIN_TABS.findIndex((tab) => tab.id === activeTab);
    let next = index;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % ADMIN_TABS.length;
    } else if (event.key === 'ArrowLeft') {
      next = (index - 1 + ADMIN_TABS.length) % ADMIN_TABS.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = ADMIN_TABS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const tab = ADMIN_TABS[next];
    setActiveTab(tab.id);
    document.getElementById(tabDomId(tab.id))?.focus();
  };

  return (
    <AdminTabContext.Provider value={activeTab}>
      <div
        role="tablist"
        aria-label="Admin console"
        onKeyDown={onKeyDown}
        className="mb-8 flex flex-wrap border-b border-border"
      >
        {ADMIN_TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabDomId(tab.id)}
              aria-selected={active}
              aria-controls={panelDomId(tab.id)}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 ${
                active
                  ? 'border-primary text-text-primary'
                  : 'border-transparent text-text-secondary hover:border-accent/40 hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {children}
    </AdminTabContext.Provider>
  );
}

interface AdminTabPanelProps {
  /** The tab this panel belongs to. */
  id: TabId;
  /** The panel's content — kept mounted while the tab is inactive. */
  children: ReactNode;
}

/**
 * One tab's panel. Inactive panels stay mounted under the `hidden`
 * attribute rather than unmounting: the Site Config form holds its
 * edits in React state, so a tab switch must never tear the tree down.
 *
 * @param props - The owning tab id and the panel's content.
 * @returns The `tabpanel` element, hidden unless its tab is active.
 */
export function AdminTabPanel({ id, children }: AdminTabPanelProps) {
  const activeTab = useAdminTab();
  return (
    <div
      role="tabpanel"
      id={panelDomId(id)}
      aria-labelledby={tabDomId(id)}
      hidden={activeTab !== id}
      className="space-y-8"
    >
      {children}
    </div>
  );
}
