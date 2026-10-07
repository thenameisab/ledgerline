"use client";

// One alert row on /alerts, inside its account's block, and the block's
// "Acknowledge all" button. Actions by view:
//   Needs attention  Acknowledge, or Snooze for 1, 3 or 7 days
//   Snoozed / Acknowledged  Move back to Needs attention
//   Closed by acknowledging  Reopen

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCheck, Clock, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate, formatDatesInText, formatDateTime } from "@/lib/format";
import type { AlertSeverity, AlertKind } from "@/lib/alerts/config";
import { SEVERITY_CHIP, SEVERITY_DOT, SEVERITY_LABEL } from "./severity";
import type { AlertRow, AlertView } from "@/lib/repos/alerts";
import { acknowledgeAlertAction, acknowledgeAlertsAction, restoreAlertAction, snoozeAlertAction, type AlertActionResult } from "@/app/alerts/actions";

function SeverityChip({ severity }: { severity: AlertSeverity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-medium ${SEVERITY_CHIP[severity]}`}>
      <span className={`size-1.5 rounded-full ${SEVERITY_DOT[severity]}`} aria-hidden />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

/**
 * The title without the account name, because the account's block header
 * already shows it: "Kestrel Store is 12% ahead of last month" → "12% ahead of last month".
 */
function shortTitle(title: string, accountName: string | null): string {
  if (!accountName || !title.startsWith(accountName)) return title;
  const rest = title.slice(accountName.length).replace(/^[:\s]+/, "").replace(/^is /, "");
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : title;
}

export function AlertItem({
  alert,
  view,
  kind,
  isNew,
  expiryDays,
}: {
  alert: AlertRow;
  view: AlertView;
  kind: AlertKind;
  /** Raised by the latest daily check. */
  isNew: boolean;
  expiryDays: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  async function run(action: () => Promise<AlertActionResult>, done: string) {
    setBusy(true);
    try {
      const res = await action();
      if (res.ok) {
        toast.success(done);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(false);
      setSnoozing(false);
    }
  }

  const a = alert;
  const isOpen = a.status === "open";
  const snoozedNow = isOpen && !a.acknowledged_at && view === "snoozed";

  let state: string | null = null;
  if (isOpen && a.acknowledged_at) {
    state = `Acknowledged by ${a.acknowledged_by_name ?? "someone"} on ${formatDateTime(a.acknowledged_at)}. It closes when the metric returns to normal.`;
  } else if (snoozedNow && a.snoozed_until) {
    state = `Snoozed by ${a.snoozed_by_name ?? "someone"} until ${formatDate(a.snoozed_until)}.`;
  } else if (!isOpen && a.close_reason === "recovered") {
    state = `Closed: back to normal in the usage for ${a.closed_data_date ? formatDate(a.closed_data_date) : "a later date"}.`;
  } else if (!isOpen && a.close_reason === "acknowledged") {
    state = `Closed: acknowledged by ${a.acknowledged_by_name ?? "someone"} on ${a.acknowledged_at ? formatDateTime(a.acknowledged_at) : "—"}.`;
  } else if (!isOpen && a.close_reason === "expired") {
    state = `Closed automatically ${expiryDays} days after its usage date.`;
  }

  // A tracked condition from an earlier check that has not recovered yet.
  const ongoing = isOpen && !isNew && kind === "track";

  const hasActions =
    (view === "attention" && isOpen) ||
    ((view === "snoozed" || view === "acknowledged") && isOpen) ||
    (!isOpen && a.close_reason === "acknowledged");

  return (
    <article
      id={`alert-${a.id}`}
      className={[
        "group/row grid grid-cols-1 gap-y-2 px-4 py-3.5 transition-colors duration-fast ease-expo hover:bg-bg sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:gap-x-3",
        a.severity === "critical" && isOpen ? "shadow-[inset_3px_0_0_var(--color-bad)]" : "",
      ].join(" ")}
    >
      <div className="flex items-start">
        <SeverityChip severity={a.severity} />
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-medium text-ink break-words">
          {formatDatesInText(shortTitle(a.title, a.account_name))}
          {a.api_code && (
            <Link
              href={`/skus/${encodeURIComponent(a.api_code)}`}
              className="ms-2 align-baseline font-mono text-xs font-normal text-accent-ink hover:underline"
            >
              {a.api_code}
            </Link>
          )}
          {a.vendor && <span className="ms-2 font-mono text-xs font-normal text-ink-faint">{a.vendor}</span>}
        </h3>
        {a.body && <p className="mt-1 text-sm text-ink-muted break-words">{formatDatesInText(a.body)}</p>}
        {state && <p className="mt-2 text-xs text-ink-muted">{state}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start">
        <span
          className="inline-flex items-center gap-2 text-xs text-ink-faint whitespace-nowrap"
          title={`Usage date ${formatDate(a.data_date)}. Opened ${formatDateTime(a.opened_at)}.`}
        >
          {isNew && <span className="rounded-sm bg-accent-bg px-1.5 py-0.5 font-medium text-accent-ink">New</span>}
          {ongoing ? `Ongoing since ${formatDate(a.data_date)}` : `Usage for ${formatDate(a.data_date)}`}
        </span>
        {hasActions && (
          <div
            className={[
              "-me-2 flex flex-wrap items-center justify-end gap-1 transition-opacity duration-fast ease-expo",
              // On devices with a pointer, actions show on row hover or keyboard
              // focus, so 30 rows do not show 60 buttons. Touch screens always show them.
              snoozing || busy
                ? ""
                : "[@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100",
            ].join(" ")}
          >
            {view === "attention" && isOpen && !snoozing && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  leadingIcon={<Check strokeWidth={2} aria-hidden />}
                  title={kind === "once" ? "Closes this alert." : "Moves this alert to Acknowledged. It closes when the metric returns to normal."}
                  onClick={() => run(() => acknowledgeAlertAction(a.id), "Alert acknowledged.")}
                >
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  leadingIcon={<Clock strokeWidth={2} aria-hidden />}
                  onClick={() => setSnoozing(true)}
                >
                  Snooze
                </Button>
              </>
            )}
            {view === "attention" && snoozing && (
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Snooze for">
                <span className="pe-1 text-xs text-ink-muted">Snooze for</span>
                {[1, 3, 7].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => run(() => snoozeAlertAction(a.id, d), `Snoozed for ${d} day${d === 1 ? "" : "s"}.`)}
                  >
                    {d} day{d === 1 ? "" : "s"}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSnoozing(false)}>
                  Cancel
                </Button>
              </div>
            )}
            {(view === "snoozed" || view === "acknowledged") && isOpen && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                leadingIcon={<Undo2 strokeWidth={2} aria-hidden />}
                onClick={() => run(() => restoreAlertAction(a.id), "Moved back to Needs attention.")}
              >
                Move back to Needs attention
              </Button>
            )}
            {!isOpen && a.close_reason === "acknowledged" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                leadingIcon={<Undo2 strokeWidth={2} aria-hidden />}
                onClick={() => run(() => restoreAlertAction(a.id), "Alert reopened.")}
              >
                Reopen
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** Acknowledge every alert in one account's block. */
export function AcknowledgeAll({ ids }: { ids: number[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await acknowledgeAlertsAction(ids);
      if (res.ok) {
        toast.success(`${res.count} alert${res.count === 1 ? "" : "s"} acknowledged.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" disabled={busy} leadingIcon={<CheckCheck strokeWidth={2} aria-hidden />} onClick={onClick}>
      Acknowledge all
    </Button>
  );
}
