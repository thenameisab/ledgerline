import { formatINR } from "@/lib/format";
import { CircleCheck, TrendingUp } from "lucide-react";

// Answers "is the month on track?". When the period still has days left, it
// projects month-end from the current run-rate and shows it against the prior
// month benchmark. When the data already covers the whole period, projection
// would be dishonest — it switches to a "complete" readout of the final figure
// vs the benchmark instead.
export function MonthPace({
  revenue,
  benchmark,
  elapsed,
  total,
}: {
  revenue: number;
  /** Prior-period revenue, the bar to beat. */
  benchmark: number;
  elapsed: number;
  total: number;
}) {
  const complete = elapsed >= total || elapsed <= 0;
  const projected = complete ? revenue : (revenue / elapsed) * total;
  const hasBenchmark = benchmark > 0;
  const ceiling = Math.max(projected, benchmark, 1);
  const fillPct = Math.min(100, (revenue / ceiling) * 100);
  const benchPct = Math.min(100, (benchmark / ceiling) * 100);
  const ahead = projected >= benchmark;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[6px]">
        <span className="text-xs uppercase tracking-widest text-ink-muted">
          {complete ? "Month complete" : "Projected month-end"}
        </span>
        <span className="text-sm font-mono tnum text-accent-ink">
          {formatINR(projected, { compact: true })}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-bg-sunken overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-accent rounded-full bar-grow"
          style={{ width: `${fillPct}%` }}
        />
        {hasBenchmark && (
          <div
            className="absolute -top-[2px] -bottom-[2px] w-0 border-l-2 border-dashed border-ink-faint"
            style={{ left: `${benchPct}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-[6px] text-[11px] text-ink-faint font-mono">
        <span className="inline-flex items-center gap-1">
          {hasBenchmark && ahead ? (
            <TrendingUp size={11} strokeWidth={1.5} className="text-ok-ink" />
          ) : null}
          {complete ? `${total} days` : `${elapsed} of ${total} days with data`}
        </span>
        {hasBenchmark ? (
          <span className="inline-flex items-center gap-1">
            {complete && ahead && <CircleCheck size={11} strokeWidth={1.5} className="text-ok-ink" />}
            benchmark {formatINR(benchmark, { compact: true })}
          </span>
        ) : (
          <span className="text-ink-faint">no prior-month data</span>
        )}
      </div>
    </div>
  );
}
