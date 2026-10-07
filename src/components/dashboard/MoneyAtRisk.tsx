import Link from "next/link";
import {
  CircleDollarSign,
  Unlink,
  TrendingDown,
  ChevronRight,
  CircleCheck,
  ArrowRight,
} from "lucide-react";
import { formatINR, formatNumber } from "@/lib/format";
import { RollingText } from "@/components/ui/RollingText";
import type { RiskSummary, RiskItem } from "@/lib/repos/types";

const META: Record<
  RiskItem["kind"],
  { title: string; tone: "bad" | "warn"; icon: typeof CircleDollarSign; desc: (it: RiskItem) => string }
> = {
  revenue_leak: {
    title: "Revenue leak · unpriced billable pairs",
    tone: "bad",
    icon: CircleDollarSign,
    desc: (it) => `${formatNumber(it.count)} (account, API) pairs took traffic with no price set`,
  },
  silent_loss: {
    title: "Silent loss · unmapped log names",
    tone: "warn",
    icon: Unlink,
    desc: (it) =>
      `${formatNumber(it.count)} account + ${formatNumber(it.count2 ?? 0)} API names excluded from revenue`,
  },
  margin_watch: {
    title: "Margin watch · selling below cost",
    tone: "warn",
    icon: TrendingDown,
    desc: (it) => `${formatNumber(it.count)} pairs where vendor cost exceeds the charged price`,
  },
};

export function MoneyAtRisk({ summary }: { summary: RiskSummary }) {
  const live = summary.items.filter((it) => it.count > 0 || it.amount > 0);

  if (live.length === 0) {
    return (
      <section className="elev-1 bg-bg-raised rounded-lg p-5 dash-enter" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="flex items-center gap-[10px] text-ok-ink">
          <CircleCheck size={18} strokeWidth={1.5} />
          <h2 className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
            No money at risk
          </h2>
        </div>
        <p className="text-sm text-ink-muted mt-1">
          Every billable pair is priced, all log names resolve, and no pair is sold below cost.
        </p>
      </section>
    );
  }

  return (
    <section className="elev-1 bg-bg-raised rounded-lg p-5 dash-enter" style={{ "--i": 2 } as React.CSSProperties}>
      <div className="flex items-baseline justify-between mb-[14px]">
        <div className="flex items-baseline gap-[10px] min-w-0">
          <h2 className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
            Money at risk
          </h2>
          <span className="text-sm font-mono tnum text-bad-ink risk-pulse">
            {summary.estimated ? "~" : ""}
            <RollingText
              text={formatINR(summary.total, { compact: true })}
              options={{ direction: "up" }}
              colorOnChange="rise-bad"
              signValue={summary.total}
            /> this month
          </span>
        </div>
        <Link
          href="/admin/aliases"
          className="text-xs text-accent-ink hover:text-accent inline-flex items-center gap-1 transition-colors duration-fast ease-expo shrink-0"
        >
          Triage <ArrowRight size={12} strokeWidth={1.5} />
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {live.map((it, idx) => {
          const m = META[it.kind];
          const Icon = m.icon;
          const tintBg = m.tone === "bad" ? "bg-bad-bg hover:bg-bad-bg-hover" : "bg-warn-bg hover:bg-warn-bg-hover";
          const ink = m.tone === "bad" ? "text-bad-ink" : "text-warn-ink";
          const signed = it.kind === "margin_watch" ? `−${formatINR(it.amount, { compact: true })}` : formatINR(it.amount, { compact: true });
          return (
            <li key={it.kind} className="risk-enter" style={{ "--i": idx } as React.CSSProperties}>
              <Link
                href={it.href}
                className={`group lift-row flex items-center gap-3 px-[14px] py-3 rounded-md transition-colors duration-fast ease-expo ${tintBg} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
              >
                <Icon size={18} strokeWidth={1.5} className={`shrink-0 ${ink}`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${ink} truncate`} style={{ fontWeight: 500 }} title={m.title}>
                    {m.title}
                  </div>
                  <div className="text-xs text-ink-muted truncate">{m.desc(it)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-mono tnum ${ink}`}>
                    {it.estimated && it.amount > 0 ? <span className="text-[10px] text-ink-faint mr-[2px]">est</span> : null}
                    {signed}
                  </div>
                  <div className="text-[10px] text-ink-faint font-mono">{formatNumber(it.hits)} hits</div>
                </div>
                <ChevronRight
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 text-ink-faint group-hover:translate-x-[2px] transition-transform duration-fast ease-expo"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      {summary.estimated && (
        <p className="text-[11px] text-ink-faint mt-3 leading-relaxed">
          Leak and silent-loss figures are estimated at the org average of{" "}
          {formatINR(summary.rate, { precision: 2 })}/hit — unpriced and unmapped traffic has no
          booked price. Margin-watch is an actual booked loss.
        </p>
      )}
    </section>
  );
}
