'use client';

import { useState, useTransition } from 'react';
import { FITS, PRODUCT, representativeVariant } from '@/lib/constants';
import type { ProductVariant } from '@/types/product';
import {
  CHROME_KEYS,
  SECTION_KEYS,
  STOCK_KEYS,
  type ChromeKey,
  type SectionKey,
  type SiteConfig,
  type StockKey,
} from '@/lib/site-config';
import { saveSiteConfig, type SaveResult } from './actions';

// Implements ADR 03-002: Landing Page Composition — Three-Column Feed
// Shell with Simplified Purchase Surface - "Admin Console labels are
// updated to feed vocabulary"; toggle keys are unchanged so stored
// Site Config documents keep working without migration.
const SECTION_LABELS: Record<SectionKey, string> = {
  hero: 'Hero Post',
  socialProof: 'Social Proof Post',
  products: 'Product Posts',
  craftsmanship: 'Craftsmanship Post',
  faq: 'FAQ Post',
  finalCta: 'Closing CTA Post',
};

const CHROME_LABELS: Record<ChromeKey, { label: string; hint?: string }> = {
  header: {
    label: 'Header',
    hint: 'Post-checkout, auxiliary, and legal pages (the landing and purchase pages use the feed layout)',
  },
  footer: {
    label: 'Footer',
    hint: 'Post-checkout, auxiliary, and legal pages (the landing and purchase pages use the feed layout)',
  },
  mobileStickyCta: {
    label: 'Mobile Bottom Nav',
    hint: 'Bottom navigation band on small screens (landing and purchase pages)',
  },
  premiumFeaturesModal: {
    label: 'Premium Features Modal',
    hint: 'Hides the "Learn more" modal trigger in the hero post',
  },
  whatsappBubble: {
    label: 'WhatsApp Bubble',
    hint: 'Floating WhatsApp chat button, bottom-right',
  },
};

// Implements ADR 00-010: Pre-order and Stock Notification — "a Stock
// Flag **per Variant** in Site Config": one toggle per Variant in
// Product Data, labelled from the Variant's own data (its name and
// size) so a Variant entering the catalog gets its labelled toggle
// without a code change. What the flag does is variant-invariant, so
// it is explained once in the Stock section's header text rather than
// repeated per row.
function stockLabel(variant: ProductVariant): string {
  return `${variant.name} — ${variant.size} — out of stock`;
}

/**
 * The boolean-flag groups of Site Config, mapped to each group's
 * toggle-key domain. `sections` also carries the string
 * `qrcoderedirect`, so the flag keys are declared per group rather
 * than derived from the group shapes.
 */
interface FlagKeys {
  sections: SectionKey;
  chrome: ChromeKey;
  stock: StockKey;
}
type FlagGroup = keyof FlagKeys;

interface ToggleRowProps {
  /** The flag's current value. */
  checked: boolean;
  /** Flip handler for the flag. */
  onToggle: () => void;
  /** The row's display label. */
  label: string;
  /** Optional secondary description line. */
  hint?: string;
  /** The raw Site Config key, rendered as the trailing tag. */
  tag: string;
}

/**
 * One Site Config toggle row — a labelled checkbox with an optional
 * hint line and the raw key as the trailing tag. Shared by the
 * Sections, Chrome, and Stock groups so the row markup lives in one
 * place.
 *
 * @param checked - The flag's current value.
 * @param onToggle - Flip handler for the flag.
 * @param label - The row's display label.
 * @param hint - Optional secondary description line.
 * @param tag - The raw Site Config key rendered as the trailing tag.
 * @returns The toggle row element.
 */
function ToggleRow({
  checked,
  onToggle,
  label,
  hint,
  tag,
}: ToggleRowProps): React.JSX.Element {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-accent/40">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 h-5 w-5 accent-primary"
        />
        <div className="flex-1">
          <span className="block font-medium text-text-primary">{label}</span>
          {hint && (
            <span className="block text-xs text-text-secondary">{hint}</span>
          )}
        </div>
        <code className="text-xs text-text-secondary">{tag}</code>
      </label>
    </li>
  );
}

export default function AdminForm({ initial }: { initial: SiteConfig }) {
  const [config, setConfig] = useState<SiteConfig>(initial);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveResult | null>(null);

  /**
   * Flip one boolean flag inside a Site Config group. `key` is
   * constrained to the group's declared flag keys, so `sections`'s
   * string `qrcoderedirect` field can never be reached — the boolean
   * view of the group below stays honest.
   *
   * @param group - The Site Config flag group owning the key.
   * @param key - The flag key within that group.
   */
  const toggleFlag = <G extends FlagGroup>(group: G, key: FlagKeys[G]): void =>
    setConfig((prev) => {
      const flags = prev[group] as Record<FlagKeys[G], boolean>;
      return { ...prev, [group]: { ...flags, [key]: !flags[key] } };
    });

  const updateQrCodeRedirect = (value: string) =>
    setConfig((prev) => ({
      ...prev,
      sections: { ...prev.sections, qrcoderedirect: value },
    }));

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    // One pass over every flag group: each checked flag submits its
    // `<group>.<key>` entry as `'on'`. `qrcoderedirect` is not a flag —
    // it's written explicitly below. Same boolean view as `toggleFlag`.
    for (const [group, keys] of [
      ['sections', SECTION_KEYS],
      ['chrome', CHROME_KEYS],
      ['stock', STOCK_KEYS],
    ] as const) {
      const flags = config[group] as Record<string, boolean>;
      for (const key of keys) {
        if (flags[key]) formData.set(`${group}.${key}`, 'on');
      }
    }
    formData.set('sections.qrcoderedirect', config.sections.qrcoderedirect);
    setStatus(null);
    startTransition(async () => {
      const result = await saveSiteConfig(formData);
      setStatus(result);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-xl font-semibold text-text-primary">
          Sections
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          Landing feed units, rendered in feed order.
        </p>
        <ul className="space-y-2">
          {SECTION_KEYS.map((key) => (
            <ToggleRow
              key={key}
              checked={config.sections[key]}
              onToggle={() => toggleFlag('sections', key)}
              label={SECTION_LABELS[key]}
              tag={key}
            />
          ))}
        </ul>

        <div className="mt-4 rounded-lg border border-border bg-background px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text-primary">
              QR Redirect URL
            </span>
            {/* Implements ADR 00-007: Quality Tooling and CI - "tracked
                files carry no real-world identifiers". Generic placeholder;
                real destinations are operator-supplied via Site Config. */}
            <input
              type="url"
              value={config.sections.qrcoderedirect}
              onChange={(event) => updateQrCodeRedirect(event.target.value)}
              placeholder="https://example.com/your-destination"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none ring-primary/30 transition focus:border-primary focus:ring"
            />
            <span className="mt-1 block text-xs text-text-secondary">
              Used by the <code>/qrcoderedirect</code> endpoint.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-xl font-semibold text-text-primary">Chrome</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Global UI pieces; header and footer apply off the landing.
        </p>
        <ul className="space-y-2">
          {CHROME_KEYS.map((key) => (
            <ToggleRow
              key={key}
              checked={config.chrome[key]}
              onToggle={() => toggleFlag('chrome', key)}
              label={CHROME_LABELS[key].label}
              hint={CHROME_LABELS[key].hint}
              tag={key}
            />
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-xl font-semibold text-text-primary">Stock</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Per-variant stock posture — one toggle per sellable variant,
          independent of Product Data availability. On: the variant shows the
          Pre-order state with the notify-me email capture. Off: its
          Availability Flag in Product Data decides.
        </p>
        {/* Implements ADR 00-010: one Stock Flag per Variant — the rows
            enumerate every Variant of every fit in Product Data,
            grouped under a fit subheading only once the catalog
            carries more than one fit. */}
        <div className="space-y-4">
          {FITS.map((fit) => (
            <div key={fit}>
              {FITS.length > 1 && (
                <h3 className="mb-2 text-sm font-semibold text-text-secondary">
                  {representativeVariant(PRODUCT.variants[fit]).name}
                </h3>
              )}
              <ul className="space-y-2">
                {PRODUCT.variants[fit].map((variant) => (
                  <ToggleRow
                    key={variant.id}
                    checked={config.stock[variant.id]}
                    onToggle={() => toggleFlag('stock', variant.id)}
                    label={stockLabel(variant)}
                    tag={variant.id}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary px-6 py-3 shadow disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        {status?.ok === true && (
          <span className="text-sm text-green-700" role="status">
            Saved. Changes propagate within a few seconds.
          </span>
        )}
        {status && status.ok === false && (
          <span className="text-sm text-red-600" role="alert">
            {status.error}
          </span>
        )}
      </div>
    </form>
  );
}
