'use client';

import { useState, useTransition } from 'react';
import { sendRestockNotifications, type NotifyResult } from './actions';

interface NotifyListButtonProps {
  /** The Variant whose Stock Notification List this button emails. */
  variantId: string;
  /** The list's current size — carried into the confirm dialog. */
  count: number;
}

/**
 * Implements ADR 00-015: Transactional Notifications — the
 * "operator-triggered Restock Notification send ... a per-Variant
 * notify action in the Stock Notifications view" — "a real-world
 * promise that must be a deliberate operator act, not a side effect
 * of a toggle" (ADR 00-015, alternative rejected): the send only
 * fires from this explicit, confirmed action.
 *
 * The per-Variant notify control on the Admin Console's Stock
 * Notifications section. Confirms the send-and-clear, then reports
 * the action's sent/failed counts inline — failures surface as an
 * inline alert, never silently, and failed sends keep their entries
 * for retry.
 *
 * @param props - The target Variant id and its list size.
 * @returns The notify button plus its outcome line.
 */
export default function NotifyListButton({
  variantId,
  count,
}: NotifyListButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<NotifyResult | null>(null);

  const onClick = () => {
    if (
      !window.confirm(
        `Send the restock notification to ${count} email${count === 1 ? '' : 's'} for ${variantId}? Sent addresses are cleared from the list.`
      )
    ) {
      return;
    }
    setStatus(null);
    startTransition(async () => {
      setStatus(await sendRestockNotifications(variantId));
    });
  };

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-lg border border-accent bg-surface px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
      >
        {isPending ? 'Sending…' : 'Notify list'}
      </button>
      {status?.ok === true && (
        <span className="text-xs text-green-700" role="status">
          Sent {status.sent}
          {status.failed > 0 && ` · ${status.failed} failed (kept for retry)`}
          .
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
