'use client';

import { useRef, useState, useTransition } from 'react';
import {
  FITS,
  PRODUCT,
  SITE_CONFIG,
  VARIANTS,
  representativeVariant,
} from '@/lib/constants';
import type { ProductVariant } from '@/types/product';
import {
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_SHARED_COPY,
  EMAIL_MULTI_LINE_MAX,
  EMAIL_SEND_KINDS,
  EMAIL_SEND_TAGS,
  EMAIL_SHARED_TAGS,
  EMAIL_SINGLE_LINE_MAX,
  captureAckEmail,
  restockEmail,
  thankYouEmail,
  type EmailCopyField,
  type EmailOverrides,
  type EmailSendKind,
  type EmailSharedTextField,
  type EmailTemplate,
  type EmailTemplateKey,
} from '@/lib/email-templates';
import type { Locale } from '@/lib/i18n';
import {
  CHROME_KEYS,
  SECTION_KEYS,
  STOCK_KEYS,
  type ChromeKey,
  type SectionKey,
  type SiteConfig,
  type StockKey,
} from '@/lib/site-config';
import {
  PROMOTION_SURFACES,
  PROMOTION_THEMES,
  PROMOTION_TYPES,
  PROMOTION_VISITORS,
  type PromotionCampaign,
  type PromotionConditions,
  type PromotionCopy,
  type PromotionSurface,
  type PromotionTheme,
  type PromotionType,
  type PromotionVisitor,
} from '@/lib/promotions';
import { saveSiteConfig, type SaveResult } from './actions';
import { AdminTabPanel, useAdminTab, type TabId } from './admin-tabs';
import { fieldLabelClass, inputClass } from './styles';

/**
 * The tabs carrying this form's Site Config panels — the submit row is
 * rendered only while one of them is active; the Profiles, Social and
 * Customers tabs own their own sections and never write through this
 * form.
 */
const FORM_TABS: readonly TabId[] = ['layout', 'promotions', 'email'];

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
  // Implements ADR 03-003: Promotion Bar — "operator-toggleable through
  // Site Config and the Admin Console like other global chrome".
  promotionBar: {
    label: 'Promotion Bar',
    hint: 'Editorial promo bar at the very top of every page',
  },
};

/**
 * Implements ADR 03-003: Promotion Bar — the Promotion Campaign editor
 * vocabulary and helpers. Campaign fields map one-to-one onto the
 * `PromotionCampaign` schema normalized by `normalizeCampaigns`; the
 * form serializes the whole list into `promotion.campaigns` on submit
 * and the server action normalizes it back.
 */
const PROMO_COPY_FIELDS: readonly (keyof PromotionCopy)[] = [
  'label',
  'headline',
  'description',
  'ctaLabel',
];
const PROMO_COPY_FIELD_LABELS: Record<keyof PromotionCopy, string> = {
  label: 'Hook',
  headline: 'Headline',
  description: 'Description',
  ctaLabel: 'CTA label',
};

/**
 * Implements ADR 00-013: Email Delivery Channel — the Email Templates
 * section's per-template labels and hints. The `shared` header/footer
 * is common to every customer-facing send; only the three
 * customer-facing sends are otherwise editable — the consent-purpose
 * line and the purchase CTA stay code-owned and never appear here.
 */
const EMAIL_TEMPLATE_LABELS: Record<
  EmailTemplateKey,
  { title: string; hint: string }
> = {
  shared: {
    title: 'Shared header & footer',
    hint: 'Branding common to every customer-facing email — the store logo is the default header image.',
  },
  thankYou: {
    title: 'Thank-You Email',
    hint: 'Sent to the customer after a paid order, in the checkout session’s language.',
  },
  captureAck: {
    title: 'Capture Acknowledgment',
    hint: 'Confirms a notify-me signup in the submission’s language.',
  },
  restock: {
    title: 'Restock Notification',
    hint: 'Sent when a flagged variant is notified back in stock, in the consent record’s language.',
  },
};

/** Admin-facing label for each editable email copy field. */
const EMAIL_FIELD_LABELS: Record<EmailCopyField, string> = {
  subject: 'Subject',
  heading: 'Heading',
  body: 'Body',
};

/** Admin-facing label for each shared header/footer field. */
const EMAIL_SHARED_FIELD_LABELS: Record<EmailSharedTextField, string> = {
  headerText: 'Header',
  footerText: 'Footer',
};

/**
 * Build a blank campaign for the "Add campaign" button — a disabled
 * editorial campaign so a half-filled row can never leak live.
 *
 * @param n - Running counter suffix for the generated id (`campaign-N`).
 */
function blankCampaign(n: number): PromotionCampaign {
  const blankCopy = (): PromotionCopy => ({
    label: '',
    headline: '',
    description: '',
    ctaLabel: '',
  });
  return {
    id: `campaign-${n}`,
    type: 'editorial',
    priority: 0,
    enabled: false,
    startDate: null,
    endDate: null,
    ctaUrl: null,
    promoCode: null,
    conditions: null,
    copy: { pt: blankCopy(), en: blankCopy() },
  };
}

/**
 * Format a campaign's ISO timestamp for a `datetime-local` input
 * (`YYYY-MM-DDTHH:mm` in local wall time); `null`/invalid → `''`.
 */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Convert a `datetime-local` input value back to an ISO timestamp;
 * empty or unparseable input becomes `null` (unbounded schedule).
 */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * The Variant's `'<name> — <size>'` display label — the same label
 * `variantLabel` in `lib/stock-notification-server.ts` produces for
 * the Restock Notification send and the Stock Notifications view
 * (ADR 00-015: "the product and Variant identified"). Mirrored
 * locally rather than imported: the `-server` module is
 * server-convention code the client bundle must not pull in.
 *
 * @param variant - A Product Data Variant.
 * @returns The `'<name> — <size>'` label.
 */
function variantDisplayLabel(variant: ProductVariant): string {
  return `${variant.name} — ${variant.size}`;
}

// Implements ADR 00-010: Pre-order and Stock Notification — "a Stock
// Flag **per Variant** in Site Config": one toggle per Variant in
// Product Data, labelled from the Variant's own data (its name and
// size) so a Variant entering the catalog gets its labelled toggle
// without a code change. What the flag does is variant-invariant, so
// it is explained once in the Stock section's header text rather than
// repeated per row.
function stockLabel(variant: ProductVariant): string {
  return `${variantDisplayLabel(variant)} — out of stock`;
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

/**
 * Implements ADR 00-013: Email Delivery Channel — the Email Templates
 * section's live preview renders through the same per-send builders
 * the send path calls (`thankYouEmail`, `captureAckEmail`,
 * `restockEmail`) and the same in-progress `emails` group the form
 * submits, so the previewed copy is exactly the copy that will send.
 * Sample inputs mirror the real callers: the solicited sends get
 * `PRODUCT.name` and the representative Variant's `'<name> — <size>'`
 * label, and the Restock Notification additionally gets the
 * `<canonical>/<locale>/checkout` product URL
 * `sendRestockNotifications` builds in `app/admin/actions.ts`; the
 * Thank-You Email gets a sample customer name and today's date.
 * Computed per render — the builders are cheap string interpolation —
 * so the preview tracks every keystroke, and blanked fields naturally
 * preview their built-in defaults.
 *
 * @param kind - The selected customer-facing send kind.
 * @param locale - The selected Language (the send's render Locale).
 * @param emails - The in-progress `emails` overrides group.
 * @returns The rendered `{subject, text, html}` template.
 */
function previewEmail(
  kind: EmailSendKind,
  locale: Locale,
  emails: EmailOverrides
): EmailTemplate {
  // The product+variant sample shared by the solicited sends — the
  // catalog's representative Variant, labelled the way the send paths
  // identify it.
  const sample = {
    productName: PRODUCT.name,
    variantLabel: variantDisplayLabel(representativeVariant(VARIANTS)),
  };
  switch (kind) {
    case 'captureAck':
      return captureAckEmail(locale, sample, emails);
    case 'restock':
      return restockEmail(
        locale,
        // The same input shape `sendRestockNotifications` builds: the
        // canonical checkout URL in the recipient's Locale.
        { ...sample, productUrl: `${SITE_CONFIG.url}/${locale}/checkout` },
        emails
      );
    default:
      return thankYouEmail(
        locale,
        { customerName: 'Maria Santos', orderDate: new Date() },
        emails
      );
  }
}

interface EmailPreviewCardProps {
  /** The selected customer-facing send kind. */
  kind: EmailSendKind;
  /** The selected Language — the send's render Locale. */
  locale: Locale;
  /** The in-progress `emails` overrides group. */
  emails: EmailOverrides;
}

/**
 * Implements ADR 00-013: Email Delivery Channel — "the operator tunes
 * wording without a deploy": the live preview sub-card of the Email
 * Templates section. The subject row shows what lands in the inbox
 * title; the builder's HTML part — a self-contained document — renders
 * verbatim in a fully sandboxed `<iframe srcDoc>` (`sandbox=""`: no
 * scripts, forms, or same-origin access ever run).
 *
 * @param kind - The selected send kind.
 * @param locale - The selected Language.
 * @param emails - The in-progress `emails` overrides group.
 * @returns The preview card element.
 */
function EmailPreviewCard({
  kind,
  locale,
  emails,
}: EmailPreviewCardProps): React.JSX.Element {
  const email = previewEmail(kind, locale, emails);
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-4">
      <h3 className="mb-1 text-sm font-semibold text-text-primary">Preview</h3>
      <p className="mb-3 text-xs text-text-secondary">
        Live preview — tags shown with sample values.
      </p>
      <div className="mb-2">
        <span className={fieldLabelClass}>Subject</span>
        <p className="text-sm text-text-primary">{email.subject}</p>
      </div>
      <iframe
        srcDoc={email.html}
        title="Email preview"
        sandbox=""
        className="w-full rounded-md border border-border bg-white"
        style={{ height: 480 }}
      />
    </div>
  );
}

interface AdminFormProps {
  /** The Site Config as read on the server — the form's starting
   *  state. */
  initial: SiteConfig;
}

export default function AdminForm({ initial }: AdminFormProps) {
  const [config, setConfig] = useState<SiteConfig>(initial);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveResult | null>(null);
  const activeTab = useAdminTab();

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

  /**
   * Implements ADR 03-003: Promotion Bar — the free-shipping threshold
   * is operator-editable Site Config data. The form edits it in euros
   * (cents/100) and stores whole cents: a parseable value clamps to
   * non-negative and rounds; an unparseable keystroke (e.g. a cleared
   * field) leaves the previous value — the field is never writable
   * into a NaN state.
   *
   * @param value - The input's raw string, euros.
   */
  const updateFreeShipping = (value: string) => {
    const euros = Number.parseFloat(value);
    if (Number.isNaN(euros)) return;
    setConfig((prev) => ({
      ...prev,
      shipping: {
        freeShippingThresholdCents: Math.max(0, Math.round(euros * 100)),
      },
    }));
  };

  /**
   * Promotion Bar (ADR 03-003): campaign list editing. `patchCampaign`
   * is the single map-and-merge primitive every updater funnels
   * through; `updateConditions` collapses an emptied conditions object
   * back to `null` (the schema's "no constraints" form);
   * `addCampaign` appends a disabled blank (`campaign-N`) and
   * `removeCampaign` drops the row. `rowKeys` gives each row a stable
   * React key independent of the operator-editable `id` field.
   */
  const nextCampaignNumber = useRef(config.promotion.campaigns.length + 1);
  const [rowKeys, setRowKeys] = useState<string[]>(() =>
    config.promotion.campaigns.map((_, i) => `row-${i + 1}`)
  );
  // The Language the campaign copy fieldsets render — the section-level
  // select mirrors the Email tab's: one Locale's four copy fields at a
  // time instead of stacked pt/en fieldsets.
  const [promoLocale, setPromoLocale] = useState<Locale>('pt');

  const patchCampaign = (
    index: number,
    mutate: (campaign: PromotionCampaign) => PromotionCampaign
  ): void =>
    setConfig((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        campaigns: prev.promotion.campaigns.map((campaign, i) =>
          i === index ? mutate(campaign) : campaign
        ),
      },
    }));

  const updateCampaign = (
    index: number,
    patch: Partial<PromotionCampaign>
  ): void => patchCampaign(index, (campaign) => ({ ...campaign, ...patch }));

  const updateConditions = (
    index: number,
    patch: Partial<PromotionConditions>
  ): void =>
    patchCampaign(index, (campaign) => {
      const next: PromotionConditions = {
        ...(campaign.conditions ?? {}),
        ...patch,
      };
      // `undefined` in a patch clears the key, and an emptied
      // conditions object collapses back to `null` — the schema's
      // "no constraints" form.
      for (const key of Object.keys(next) as (keyof PromotionConditions)[]) {
        if (next[key] === undefined) delete next[key];
      }
      return {
        ...campaign,
        conditions: Object.keys(next).length > 0 ? next : null,
      };
    });

  const updateCopy = (
    index: number,
    locale: 'pt' | 'en',
    field: keyof PromotionCopy,
    value: string
  ): void =>
    patchCampaign(index, (campaign) => ({
      ...campaign,
      copy: {
        ...campaign.copy,
        [locale]: { ...campaign.copy[locale], [field]: value },
      },
    }));

  /**
   * Implements ADR 03-003: Promotion Bar — "Bar theme": the shared
   * `promotion.theme` field the "Shared bar settings" card edits; one
   * skin for the whole bar, lifted out of the per-campaign cards.
   */
  const updatePromotionTheme = (theme: PromotionTheme): void =>
    setConfig((prev) => ({
      ...prev,
      promotion: { ...prev.promotion, theme },
    }));

  const addCampaign = (): void => {
    // The counter advance is a side effect — it must happen OUTSIDE the
    // state updater, which StrictMode may invoke twice.
    const n = nextCampaignNumber.current++;
    setRowKeys((prev) => [...prev, `row-${n}`]);
    setConfig((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        campaigns: [...prev.promotion.campaigns, blankCampaign(n)],
      },
    }));
  };

  const removeCampaign = (index: number): void => {
    setRowKeys((prev) => prev.filter((_, i) => i !== index));
    setConfig((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        campaigns: prev.promotion.campaigns.filter((_, i) => i !== index),
      },
    }));
  };

  /**
   * Implements ADR 00-013: Email Delivery Channel — the customer-facing
   * sends' copy is "operator-editable Site Config data". The Email
   * Templates section renders the `shared` header/footer card
   * unconditionally and one send kind's copy card at a time —
   * `emailTemplate` picks the send kind, `emailLocale` picks the
   * Locale scoping both cards. `updateEmailCopy` /
   * `updateSharedText` write one field override; the `*Value` readers
   * render the effective value (override ?? in-repo default) so the
   * operator always sees the copy that will send. A blanked field
   * stores `''` — normalization drops it and the default applies, the
   * Promotion Campaign precedent.
   */
  const [emailTemplate, setEmailTemplate] = useState<EmailSendKind>('thankYou');
  const [emailLocale, setEmailLocale] = useState<Locale>('pt');

  const emailCopyValue = (
    kind: EmailSendKind,
    locale: Locale,
    field: EmailCopyField
  ): string =>
    config.emails[kind][locale]?.[field] ??
    DEFAULT_EMAIL_TEMPLATES[kind][locale][field];

  const updateEmailCopy = (
    kind: EmailSendKind,
    locale: Locale,
    field: EmailCopyField,
    value: string
  ): void =>
    setConfig((prev) => ({
      ...prev,
      emails: {
        ...prev.emails,
        [kind]: {
          ...prev.emails[kind],
          [locale]: {
            ...prev.emails[kind][locale],
            [field]: value,
          },
        },
      },
    }));

  /**
   * The effective shared text-field value (override ?? default).
   * Header/footer fields are multi-line — imagery composes inside
   * the same copy through `{image:path}` tags (ADR 00-013).
   */
  const sharedTextValue = (
    locale: Locale,
    field: EmailSharedTextField
  ): string =>
    config.emails.shared[locale]?.[field] ??
    DEFAULT_SHARED_COPY[locale][field] ??
    '';

  const updateSharedText = (
    locale: Locale,
    field: EmailSharedTextField,
    value: string
  ): void =>
    setConfig((prev) => ({
      ...prev,
      emails: {
        ...prev.emails,
        shared: {
          ...prev.emails.shared,
          [locale]: { ...prev.emails.shared[locale], [field]: value },
        },
      },
    }));

  /** Toggle one surface inside a campaign's `conditions.surfaces`. */
  const toggleSurface = (index: number, surface: PromotionSurface): void => {
    const current =
      config.promotion.campaigns[index].conditions?.surfaces ?? [];
    const next = current.includes(surface)
      ? current.filter((item) => item !== surface)
      : [...current, surface];
    // An empty list is stored as absent — "no constraint" — matching
    // the normalization posture (`surfaces` absent = all surfaces).
    updateConditions(index, {
      surfaces: next.length > 0 ? next : undefined,
    });
  };

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
    // Implements ADR 03-003: the threshold travels as a euros scalar
    // like `sections.qrcoderedirect`; the server action converts it
    // back to whole cents.
    formData.set(
      'shipping.freeShippingThreshold',
      String(config.shipping.freeShippingThresholdCents / 100)
    );
    // Implements ADR 03-003: Promotion Bar — the whole campaign list
    // travels as one serialized JSON field; the server action
    // re-normalizes it through `normalizeCampaigns`. The shared
    // `promotion.theme` ("Bar theme") travels as a plain scalar like
    // `shipping.freeShippingThreshold`, validated with the same
    // carry-forward posture.
    formData.set(
      'promotion.campaigns',
      JSON.stringify(config.promotion.campaigns)
    );
    formData.set('promotion.theme', config.promotion.theme);
    // Implements ADR 00-013: Email Delivery Channel — the `emails`
    // override group travels as one serialized JSON field, mirroring
    // `promotion.campaigns`; the server action re-normalizes it
    // through `normalizeEmailOverrides`.
    formData.set('emails', JSON.stringify(config.emails));
    setStatus(null);
    startTransition(async () => {
      const result = await saveSiteConfig(formData);
      setStatus(result);
    });
  };

  return (
    <form onSubmit={onSubmit}>
      {/* The Layout tab — the Site Config flag groups: Sections (with
          the QR Redirect URL), Chrome, and the per-Variant Stock
          flags. */}
      <AdminTabPanel id="layout">
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
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-text-secondary">
                Used by the <code>/qrcoderedirect</code> endpoint.
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-1 text-xl font-semibold text-text-primary">
            Chrome
          </h2>
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
          <h2 className="mb-1 text-xl font-semibold text-text-primary">
            Stock
          </h2>
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
      </AdminTabPanel>

      {/* The Promotions tab — the Site Config groups that drive the
          Promotion Bar: the free-shipping threshold and the Promotion
          Campaign list. */}
      <AdminTabPanel id="promotions">
        {/* Implements ADR 03-003: Promotion Bar — the free-shipping
          threshold is operator-editable Site Config data: the
          complimentary-rate swap at checkout and the Promotion Bar's
          `belowFreeShipping` condition both key on this value. */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-1 text-xl font-semibold text-text-primary">
            Shipping
          </h2>
          <p className="mb-4 text-sm text-text-secondary">
            Complimentary-shipping rules enforced at checkout.
          </p>
          <div className="rounded-lg border border-border bg-background px-4 py-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-text-primary">
                Free-shipping threshold (€)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={config.shipping.freeShippingThresholdCents / 100}
                onChange={(event) => updateFreeShipping(event.target.value)}
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-text-secondary">
                Carts at or above this subtotal ship free; below-threshold
                promotion campaigns key on the same value. 0 disables free
                shipping.
              </span>
            </label>
          </div>
        </section>

        {/* Implements ADR 03-003: Promotion Bar — "the Promotion Campaign
          list is operator-editable Site Config data": one bordered card
          per campaign mirroring the `PromotionCampaign` schema; the
          highest-priority eligible campaign wins on the storefront.
          One Language select scopes the campaign copy fieldsets (the
          Email tab's pattern), and the shared `promotion.theme` lives
          in its own "Shared bar settings" card above the list — "The
          Admin Console edits it as shared bar settings beside the
          campaign list." */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-1 text-xl font-semibold text-text-primary">
            Promotions
          </h2>
          <p className="mb-4 text-sm text-text-secondary">
            Campaigns for the promotion bar — the highest-priority eligible
            campaign wins; the bar hides when none applies. Dates are optional
            (empty = unbounded).
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabelClass}>Language</span>
              <select
                value={promoLocale}
                onChange={(event) =>
                  setPromoLocale(event.target.value as Locale)
                }
                className={inputClass}
              >
                <option value="pt">Português</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <div className="space-y-4">
            {/* Implements ADR 03-003: "Bar theme" — "The bar's visual
              theme is a single Site Config field — `promotion.theme` ...
              shared by every campaign": the skin belongs to the bar, not
              to whichever campaign wins, so it edits here beside the
              list rather than inside each campaign card. */}
            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <h3 className="mb-1 text-sm font-semibold text-text-primary">
                Shared bar settings
              </h3>
              <p className="mb-3 text-xs text-text-secondary">
                One visual theme for the whole promotion bar — it applies to
                whichever campaign is showing.
              </p>
              <label className="block">
                <span className={fieldLabelClass}>Theme</span>
                <select
                  value={config.promotion.theme}
                  onChange={(event) =>
                    updatePromotionTheme(event.target.value as PromotionTheme)
                  }
                  className={inputClass}
                >
                  {PROMOTION_THEMES.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {config.promotion.campaigns.map((campaign, index) => {
              const conditions = campaign.conditions ?? {};
              return (
                <div
                  key={rowKeys[index] ?? `row-${index}`}
                  className="space-y-4 rounded-lg border border-border bg-background px-4 py-4"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      <input
                        type="checkbox"
                        checked={campaign.enabled}
                        onChange={(event) =>
                          updateCampaign(index, {
                            enabled: event.target.checked,
                          })
                        }
                        className="h-5 w-5 accent-primary"
                      />
                      Enabled
                    </label>
                    <label className="block">
                      <span className={fieldLabelClass}>ID</span>
                      <input
                        type="text"
                        required
                        value={campaign.id}
                        onChange={(event) =>
                          updateCampaign(index, { id: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className={fieldLabelClass}>Type</span>
                      <select
                        value={campaign.type}
                        onChange={(event) =>
                          updateCampaign(index, {
                            type: event.target.value as PromotionType,
                          })
                        }
                        className={inputClass}
                      >
                        {PROMOTION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block w-24">
                      <span className={fieldLabelClass}>Priority</span>
                      <input
                        type="number"
                        value={campaign.priority}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          updateCampaign(index, {
                            priority: Number.isFinite(value) ? value : 0,
                          });
                        }}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeCampaign(index)}
                      className="ml-auto text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="block">
                      <span className={fieldLabelClass}>Start date</span>
                      <input
                        type="datetime-local"
                        value={isoToLocalInput(campaign.startDate)}
                        onChange={(event) =>
                          updateCampaign(index, {
                            startDate: localInputToIso(event.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className={fieldLabelClass}>End date</span>
                      <input
                        type="datetime-local"
                        value={isoToLocalInput(campaign.endDate)}
                        onChange={(event) =>
                          updateCampaign(index, {
                            endDate: localInputToIso(event.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="block min-w-40 flex-1">
                      <span className={fieldLabelClass}>CTA URL</span>
                      <input
                        type="text"
                        value={campaign.ctaUrl ?? ''}
                        onChange={(event) =>
                          updateCampaign(index, {
                            ctaUrl: event.target.value || null,
                          })
                        }
                        placeholder="/#products or /checkout"
                        className={inputClass}
                      />
                    </label>
                    <label className="block w-40">
                      <span className={fieldLabelClass}>
                        Promo code (reserved)
                      </span>
                      {/* Implements ADR 03-003: the field is schema-ready
                        but never rendered while the Hosted Checkout has
                        no promotion-code entry — stored for forward
                        compatibility only. */}
                      <input
                        type="text"
                        value={campaign.promoCode ?? ''}
                        onChange={(event) =>
                          updateCampaign(index, {
                            promoCode: event.target.value || null,
                          })
                        }
                        placeholder="Not shown yet"
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <fieldset className="rounded-md border border-border px-3 py-3">
                    <legend className="px-1 text-xs font-medium text-text-secondary">
                      Conditions
                    </legend>
                    <div className="flex flex-wrap items-end gap-4">
                      <label className="block">
                        <span className={fieldLabelClass}>Visitor</span>
                        <select
                          value={conditions.visitor ?? 'any'}
                          onChange={(event) =>
                            updateConditions(index, {
                              visitor: event.target.value as PromotionVisitor,
                            })
                          }
                          className={inputClass}
                        >
                          {PROMOTION_VISITORS.map((visitor) => (
                            <option key={visitor} value={visitor}>
                              {visitor}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <span className={fieldLabelClass}>
                          Surfaces (none checked = all)
                        </span>
                        <div className="flex gap-3">
                          {PROMOTION_SURFACES.map((surface) => (
                            <label
                              key={surface}
                              className="flex items-center gap-1 text-xs text-text-primary"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  conditions.surfaces?.includes(surface) ??
                                  false
                                }
                                onChange={() => toggleSurface(index, surface)}
                                className="h-4 w-4 accent-primary"
                              />
                              {surface}
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="block w-32">
                        <span className={fieldLabelClass}>Min cart (€)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={
                            conditions.minCartCents !== undefined
                              ? conditions.minCartCents / 100
                              : ''
                          }
                          onChange={(event) => {
                            const raw = event.target.value;
                            const euros = Number.parseFloat(raw);
                            updateConditions(index, {
                              // Stored in whole cents like the shipping
                              // threshold — euros are the operator-facing
                              // unit everywhere on this form.
                              minCartCents:
                                raw !== '' &&
                                Number.isFinite(euros) &&
                                euros >= 0
                                  ? Math.round(euros * 100)
                                  : undefined,
                            });
                          }}
                          className={inputClass}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-text-primary">
                        <input
                          type="checkbox"
                          checked={conditions.belowFreeShipping === true}
                          onChange={(event) =>
                            updateConditions(index, {
                              belowFreeShipping: event.target.checked
                                ? true
                                : undefined,
                            })
                          }
                          className="h-4 w-4 accent-primary"
                        />
                        Below free-shipping threshold
                      </label>
                    </div>
                  </fieldset>

                  {/* One Locale's copy block at a time — the
                    section-level Language select picks which of the
                    campaign's `{pt, en}` blocks these four fields edit
                    (the Email tab's single-locale pattern). */}
                  <fieldset className="rounded-md border border-border px-3 py-3">
                    <legend className="px-1 text-xs font-medium uppercase text-text-secondary">
                      {promoLocale}
                    </legend>
                    <div className="space-y-2">
                      {PROMO_COPY_FIELDS.map((field) => (
                        <label key={field} className="block">
                          <span className={fieldLabelClass}>
                            {PROMO_COPY_FIELD_LABELS[field]}
                          </span>
                          <input
                            type="text"
                            required={field === 'label' || field === 'headline'}
                            value={campaign.copy[promoLocale][field]}
                            onChange={(event) =>
                              updateCopy(
                                index,
                                promoLocale,
                                field,
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addCampaign}
            className="mt-4 rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/40"
          >
            Add campaign
          </button>
        </section>
      </AdminTabPanel>

      {/* The Email tab — the customer-facing sends' Site Config copy
          overrides. */}
      <AdminTabPanel id="email">
        {/* Implements ADR 00-013: Email Delivery Channel — "The
          customer-facing sends' copy ... is operator-editable Site
          Config data ... editable in the Admin Console: the operator
          tunes wording without a deploy ... the operator edits text,
          never markup or structure." One Language select scopes both
          cards below; the shared header/footer card always renders and
          the template card shows the selected send kind's fields.
          Fields pre-fill with the effective copy (override ?? default)
          and a blanked field falls back to the default on save. */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-1 text-xl font-semibold text-text-primary">
            Email Templates
          </h2>
          <p className="mb-4 text-sm text-text-secondary">
            Customer-facing email copy. Blank a field to use the built-in
            default; tags insert dynamic values where noted.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabelClass}>Language</span>
              <select
                value={emailLocale}
                onChange={(event) =>
                  setEmailLocale(event.target.value as Locale)
                }
                className={inputClass}
              >
                <option value="pt">Português</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <div className="space-y-4">
            {/* The shared header/footer card — the branding every
              customer-facing send wraps around its letter; always
              visible, not a template-dropdown option. */}
            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <h3 className="mb-1 text-sm font-semibold text-text-primary">
                {EMAIL_TEMPLATE_LABELS.shared.title}
              </h3>
              <p className="mb-3 text-xs text-text-secondary">
                {EMAIL_TEMPLATE_LABELS.shared.hint}
              </p>
              <div className="space-y-2">
                <label className="block">
                  <span className={fieldLabelClass}>
                    {EMAIL_SHARED_FIELD_LABELS.headerText}
                  </span>
                  <textarea
                    rows={3}
                    maxLength={EMAIL_MULTI_LINE_MAX}
                    value={sharedTextValue(emailLocale, 'headerText')}
                    onChange={(event) =>
                      updateSharedText(
                        emailLocale,
                        'headerText',
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-text-secondary">
                    {'{image:/path/to.png,size:80px}'} renders any file in
                    public/ (letters, digits, - . _ /); the size is optional —
                    px (16–600) or % (1–100), and % may render at natural size
                    in Outlook — e.g. {'{image:/logo/logo-full.png}'}.
                  </span>
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>
                    {EMAIL_SHARED_FIELD_LABELS.footerText}
                  </span>
                  <textarea
                    rows={3}
                    maxLength={EMAIL_MULTI_LINE_MAX}
                    value={sharedTextValue(emailLocale, 'footerText')}
                    onChange={(event) =>
                      updateSharedText(
                        emailLocale,
                        'footerText',
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-text-secondary">
                    {'{image:/path/to.png,size:80px}'} renders any file in
                    public/ (letters, digits, - . _ /); the size is optional —
                    px (16–600) or % (1–100), and % may render at natural size
                    in Outlook — e.g. {'{image:/logo/logo-mark.png,size:80px}'}.
                  </span>
                </label>
                <p className="text-xs text-text-secondary">
                  Tags: {EMAIL_SHARED_TAGS.map((tag) => `{${tag}}`).join(' ')}
                </p>
              </div>
            </div>

            {/* The template card — the send-kind selector plus that
              kind's subject/heading/body for the chosen Language. */}
            <div className="rounded-lg border border-border bg-background px-4 py-4">
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={fieldLabelClass}>Template</span>
                  <select
                    value={emailTemplate}
                    onChange={(event) =>
                      setEmailTemplate(event.target.value as EmailSendKind)
                    }
                    className={inputClass}
                  >
                    {EMAIL_SEND_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {EMAIL_TEMPLATE_LABELS[kind].title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mb-3 text-xs text-text-secondary">
                {EMAIL_TEMPLATE_LABELS[emailTemplate].hint}
              </p>
              <div className="space-y-2">
                <label className="block">
                  <span className={fieldLabelClass}>
                    {EMAIL_FIELD_LABELS.subject}
                  </span>
                  <input
                    type="text"
                    // The field-level cap the normalizer enforces on
                    // save — visible while typing, not a silent reload
                    // surprise.
                    maxLength={EMAIL_SINGLE_LINE_MAX}
                    value={emailCopyValue(
                      emailTemplate,
                      emailLocale,
                      'subject'
                    )}
                    onChange={(event) =>
                      updateEmailCopy(
                        emailTemplate,
                        emailLocale,
                        'subject',
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>
                    {EMAIL_FIELD_LABELS.heading}
                  </span>
                  <input
                    type="text"
                    maxLength={EMAIL_SINGLE_LINE_MAX}
                    value={emailCopyValue(
                      emailTemplate,
                      emailLocale,
                      'heading'
                    )}
                    onChange={(event) =>
                      updateEmailCopy(
                        emailTemplate,
                        emailLocale,
                        'heading',
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>
                    {EMAIL_FIELD_LABELS.body}
                  </span>
                  <textarea
                    rows={5}
                    maxLength={EMAIL_MULTI_LINE_MAX}
                    value={emailCopyValue(emailTemplate, emailLocale, 'body')}
                    onChange={(event) =>
                      updateEmailCopy(
                        emailTemplate,
                        emailLocale,
                        'body',
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-text-secondary">
                    Tags:{' '}
                    {EMAIL_SEND_TAGS[emailTemplate]
                      .map((tag) => `{${tag}}`)
                      .join(' ')}
                  </span>
                </label>
              </div>
            </div>

            {/* The preview card — the selected send rendered through
              the same builders the send path uses, so the operator sees
              exactly what will send. */}
            <EmailPreviewCard
              kind={emailTemplate}
              locale={emailLocale}
              emails={config.emails}
            />
          </div>
        </section>
      </AdminTabPanel>

      {/* The submit row belongs to the write-path tabs only — saving is
          meaningless on the Social and Customers read/operate tabs. */}
      {FORM_TABS.includes(activeTab) && (
        <div className="mt-8 flex items-center gap-4">
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
      )}
    </form>
  );
}
