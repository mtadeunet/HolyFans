'use client';

import { useState, useTransition } from 'react';
import {
  CHROME_KEYS,
  SECTION_KEYS,
  type ChromeKey,
  type SectionKey,
  type SiteConfig,
} from '@/lib/site-config';
import { saveSiteConfig, type SaveResult } from './actions';

const SECTION_LABELS: Record<SectionKey, string> = {
  hero: 'Hero',
  socialProof: 'Social Proof',
  products: 'Product Gallery',
  craftsmanship: 'Craftsmanship',
  faq: 'FAQ',
  finalCta: 'Final CTA',
};

const CHROME_LABELS: Record<ChromeKey, { label: string; hint?: string }> = {
  header: { label: 'Header', hint: 'Top navigation bar' },
  footer: { label: 'Footer', hint: 'Site-wide footer' },
  mobileStickyCta: {
    label: 'Mobile Sticky CTA',
    hint: 'Bottom bar shown on small screens',
  },
  premiumFeaturesModal: {
    label: 'Premium Features Modal',
    hint: 'Hides the "Learn more" button and modal in the hero',
  },
};

export default function AdminForm({ initial }: { initial: SiteConfig }) {
  const [config, setConfig] = useState<SiteConfig>(initial);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveResult | null>(null);

  const toggleSection = (key: SectionKey) =>
    setConfig((prev) => ({
      ...prev,
      sections: { ...prev.sections, [key]: !prev.sections[key] },
    }));

  const toggleChrome = (key: ChromeKey) =>
    setConfig((prev) => ({
      ...prev,
      chrome: { ...prev.chrome, [key]: !prev.chrome[key] },
    }));

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    for (const key of SECTION_KEYS) {
      if (config.sections[key]) formData.set(`sections.${key}`, 'on');
    }
    for (const key of CHROME_KEYS) {
      if (config.chrome[key]) formData.set(`chrome.${key}`, 'on');
    }
    setStatus(null);
    startTransition(async () => {
      const result = await saveSiteConfig(formData);
      setStatus(result);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-xl font-semibold text-primary">Sections</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Homepage blocks rendered in order.
        </p>
        <ul className="space-y-2">
          {SECTION_KEYS.map((key) => (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-accent/40">
                <input
                  type="checkbox"
                  checked={config.sections[key]}
                  onChange={() => toggleSection(key)}
                  className="h-5 w-5 accent-accent"
                />
                <span className="font-medium text-primary">
                  {SECTION_LABELS[key]}
                </span>
                <code className="ml-auto text-xs text-text-secondary">
                  {key}
                </code>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-xl font-semibold text-primary">Chrome</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Global UI pieces shown on every page.
        </p>
        <ul className="space-y-2">
          {CHROME_KEYS.map((key) => (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-accent/40">
                <input
                  type="checkbox"
                  checked={config.chrome[key]}
                  onChange={() => toggleChrome(key)}
                  className="mt-0.5 h-5 w-5 accent-accent"
                />
                <div className="flex-1">
                  <span className="block font-medium text-primary">
                    {CHROME_LABELS[key].label}
                  </span>
                  {CHROME_LABELS[key].hint && (
                    <span className="block text-xs text-text-secondary">
                      {CHROME_LABELS[key].hint}
                    </span>
                  )}
                </div>
                <code className="text-xs text-text-secondary">{key}</code>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-6 py-3 font-semibold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-60"
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
