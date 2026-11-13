'use client';

import { useState, useTransition } from 'react';
import { clearStockNotificationList, type SaveResult } from './actions';

interface ClearListButtonProps {
  /** The Variant whose Stock Notification List this button purges. */
  variantId: string;
}

/**
 * Implements ADR 00-010: Pre-order and Stock Notification — the purge
 * half of the "operator export-and-clear path": the Stock Notification
 * List is "an operator-held record the operator can export and clear".
 *
 * The per-Variant clear control on the Admin Console's Stock
 * Notifications section. Confirms before the destructive purge, then
 * reports the server action's outcome inline — failures surface as an
 * inline alert, never silently.
 *
 * @param props - The target Variant id.
 * @returns The clear-list button plus its outcome line.
 */
export default function ClearListButton({ variantId }: ClearListButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<SaveResult | null>(null);

  const onClick = () => {
    if (
      !window.confirm(
        `Delete every captured email for ${variantId}? This cannot be undone.`
      )
    ) {
      return;
    }
    setStatus(null);
    startTransition(async () => {
      setStatus(await clearStockNotificationList(variantId));
    });
  };

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-lg border border-red-300 bg-surface px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
      >
        {isPending ? 'Clearing…' : 'Clear list'}
      </button>
      {status?.ok === true && (
        <span className="text-xs text-green-700" role="status">
          List cleared.
        </span>
      )}
      {status && status.ok === false && (
        <span className="text-xs text-red-600" role="alert">
          {status.error}
        </span>
      )}
    </span>
  );
}
