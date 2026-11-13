/**
 * Deterministic UTC rendering of a timestamp stored in the managed
 * store — shared by the Admin Console's store-backed sections (the
 * Likes section's last-like times and the Stock Notifications
 * section's consent timestamps).
 */
const storeTimestampFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/**
 * Format a stored timestamp for the operator view.
 *
 * @param iso - The stored ISO timestamp (untrusted: the record could
 *   hold a corrupt value).
 * @returns A `dd Mon yyyy, HH:mm UTC` rendering, or the raw string when
 *   it does not parse.
 */
export function formatStoreTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${storeTimestampFormatter.format(date)} UTC`;
}
