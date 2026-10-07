"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, CornerUpLeft } from "lucide-react";
import { monthLabel, type DateRange } from "@/lib/repos/periods";
import { writePeriodCookie, clearPeriodCookie } from "@/lib/period-cookie";

// Shown only during the first days of a month, when the dashboard opens on the
// previous full month because the current one has almost no data yet. Makes
// that choice visible (so an empty current month never reads as "broken") and
// lets the user flip to the live month and back with one click.
export function PeriodBanner({
  viewingCurrent,
  currentRange,
}: {
  viewingCurrent: boolean;
  currentRange: DateRange;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (range: DateRange | null) => {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (range) {
      sp.set("from", range.from);
      sp.set("to", range.to);
      writePeriodCookie(range.from, range.to);
    } else {
      // Clearing returns every page to the default window (the previous month).
      sp.delete("from");
      sp.delete("to");
      clearPeriodCookie();
    }
    router.replace(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, {
      scroll: false,
    });
  };

  const currentLabel = monthLabel(currentRange.from);

  return (
    <div className="glow-pill">
      <div className="glow-pill-inner">
        {viewingCurrent ? (
          <>
            <span className="glow-pill-dot" aria-hidden />
            <span className="text-ink">
              Viewing{" "}
              <strong className="font-medium">{currentLabel}</strong> — month
              just started, data is still filling in.
            </span>
            <button
              type="button"
              onClick={() => go(null)}
              className="glow-pill-action"
            >
              <CornerUpLeft size={12} strokeWidth={1.75} />
              Back to last month
            </button>
          </>
        ) : (
          <>
            <span className="glow-pill-dot" aria-hidden />
            <span className="text-ink">
              Showing <strong className="font-medium">last month</strong> —{" "}
              {currentLabel} has just started and has little data yet.
            </span>
            <button
              type="button"
              onClick={() => go(currentRange)}
              className="glow-pill-action"
            >
              View {currentLabel}
              <ArrowRight size={12} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
