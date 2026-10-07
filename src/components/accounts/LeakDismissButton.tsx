"use client";

import { useTransition } from "react";
import { Check, RotateCcw, Loader2 } from "lucide-react";
import { RollingText, SUCCESS_ROLL } from "@/components/ui/RollingText";
import { dismissHistoricalLeak, restoreHistoricalLeak } from "@/app/accounts/[slug]/leak-actions";

// Inline acknowledge/undo for a historical leak. Server action revalidates the
// page, so the row re-renders into its new state on completion.
export function LeakDismissButton({
  accountId,
  apiCode,
  slug,
  dismissed,
}: {
  accountId: number;
  apiCode: string;
  slug: string;
  dismissed: boolean;
}) {
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      if (dismissed) await restoreHistoricalLeak(accountId, apiCode, slug);
      else await dismissHistoricalLeak(accountId, apiCode, slug);
    });

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-mono text-ink-muted hover:text-ink rounded px-1 py-0.5 hover:bg-bg-sunken transition-colors duration-fast disabled:opacity-50"
    >
      {pending ? (
        <Loader2 size={10} strokeWidth={1.75} className="animate-spin" />
      ) : dismissed ? (
        <RotateCcw size={10} strokeWidth={1.75} />
      ) : (
        <Check size={10} strokeWidth={1.75} />
      )}
      <RollingText
        text={dismissed ? "Restore" : "Mark fixed"}
        options={{
          direction: "up",
          // Fixing a leak is the success beat — flash a green-biased spectrum.
          // Restoring is an undo, so it rolls without the flash.
          color: dismissed ? SUCCESS_ROLL : undefined,
        }}
      />
    </button>
  );
}
