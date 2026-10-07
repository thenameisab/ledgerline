import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { formatINR } from "@/lib/format";

export type MoverRow = {
  key: string;
  name: string;
  href: string;
  /** Rupee change vs the day-scaled prior month. */
  delta: number;
  /** Percent change; null when the account had no prior-month revenue (new). */
  delta_pct: number | null;
  current: number;
};

// Accounts whose revenue moved most against last month (prior month scaled to
// the elapsed days so a partial month compares fairly). Complements the
// top-list: size tells you who matters, movement tells you who changed.
export function Movers({ rows }: { rows: MoverRow[] }) {
  return (
    <section
      className="elev-1 bg-bg-raised rounded-lg p-5 dash-enter"
      style={{ "--i": 6 } as React.CSSProperties}
    >
      <h2 className="font-serif text-base text-ink mb-3" style={{ fontWeight: 600 }}>
        Biggest movers
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted py-4">
          Not enough history to compare with last month.
        </p>
      ) : (
        <ol className="flex flex-col gap-[10px]">
          {rows.map((r) => {
            const up = r.delta >= 0;
            return (
              <li key={r.key}>
                <Link
                  href={r.href}
                  className="group lift-row flex items-baseline justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                >
                  <div className="min-w-0 flex items-baseline gap-2">
                    {up ? (
                      <ArrowUpRight size={13} strokeWidth={2} className="shrink-0 self-center text-success" aria-hidden />
                    ) : (
                      <ArrowDownRight size={13} strokeWidth={2} className="shrink-0 self-center text-bad" aria-hidden />
                    )}
                    <TruncateTooltip
                      as="span"
                      text={r.name}
                      className="text-[13px] text-ink group-hover:text-accent-ink transition-colors duration-fast ease-expo"
                    />
                  </div>
                  <span className="shrink-0 text-[13px] font-mono tnum">
                    <span className={up ? "text-success-ink" : "text-bad-ink"}>
                      {up ? "+" : "−"}
                      {formatINR(Math.abs(r.delta), { compact: true })}
                    </span>
                    <span className="text-ink-faint ml-1.5 text-[11px]">
                      {r.delta_pct == null
                        ? "new"
                        : `${r.delta_pct > 0 ? "+" : ""}${Math.round(r.delta_pct)}%`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-[11px] text-ink-faint mt-3">
        vs last month, scaled to elapsed days
      </p>
    </section>
  );
}
