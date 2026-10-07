"use client";

import { useTransition } from "react";
import { Check, RotateCcw, Loader2 } from "lucide-react";
import { chromatic } from "slot-text";
import { RollingText } from "@/components/ui/RollingText";
import { dismissReconDelta, restoreReconDelta } from "@/app/vendors/reconciliation/actions";

/**
 * Accept or un-accept one month's delta. Mirrors LeakDismissButton: the server
 * action revalidates the page, so the row re-renders into its new state rather
 * than holding optimistic local state.
 *
 * The verb is "Accept", not "Mark fixed". A reconciliation delta is rarely
 * fixed by anyone — it is explained (internal test traffic, a stitched API the
 * vendor bills as its parts) and then agreed to for that month.
 */
export function ReconDismissButton({
  vendor,
  apiCode,
  rawApiName,
  periodFrom,
  dismissed,
}: {
  vendor: string;
  apiCode: string | null;
  rawApiName: string | null;
  periodFrom: string;
  dismissed: boolean;
}) {
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const args = { vendor, apiCode, rawApiName, periodFrom };
      if (dismissed) await restoreReconDelta(args);
      else await dismissReconDelta(args);
    });

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title={
        dismissed
          ? "Return this delta to the open list for this month"
          : "Agree this month's delta is explained. Only this month — next month is asked again."
      }
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-mono text-ink-muted hover:text-ink rounded px-1 py-0.5 hover:bg-bg-sunken transition-colors duration-fast disabled:opacity-50"
    >
      {pending ? (
        <Loader2 size={10} strokeWidth={1.75} className="animate-spin" />
      ) : dismissed ? (
        <RotateCcw size={10} strokeWidth={1.75} />
      ) : (
        <Check size={10} strokeWidth={1.75} />
      )}
      <RollingText
        text={dismissed ? "Reopen" : "Accept"}
        options={{
          direction: "up",
          color: dismissed ? undefined : chromatic({ from: 140 }),
        }}
      />
    </button>
  );
}
