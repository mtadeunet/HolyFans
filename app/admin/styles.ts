/**
 * Shared Tailwind class compositions for the Admin Console's form
 * controls — one source for the input/select and field-label styling
 * the Site Config form, Profiles section, and Orders section share,
 * so the console's fields read as one design system.
 */

/** The text-input/select chrome: bordered surface field with the
 *  primary-color focus ring. */
export const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none ring-primary/30 transition focus:border-primary focus:ring';

/** The small caption-style label sitting above a field. */
export const fieldLabelClass =
  'mb-1 block text-xs font-medium text-text-secondary';
