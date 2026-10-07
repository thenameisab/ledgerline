import Link from "next/link";
import { Activity, Zap, CircleDollarSign, Percent, ChevronRight } from "lucide-react";
import { formatINR, formatNumber } from "@/lib/format";
import { DeltaPill, Stat } from "@/components/dashboard/Headline";

// Per-account hero in the flagship language: serif landmark + accent rail,
// MoM delta, briefing prose. Composed as narrative | vitals — the landmark
// and briefing carry the story on the left; a divided vitals rail on the
// right holds the share-of-org meter and the secondary stats so the card
// reads as one band instead of a big-number template. The quantified leak
// row mirrors the dashboard's MoneyAtRisk — rupees first, clearly estimated.
export function AccountHeadline({
  revenue,
  momDelta,
  briefing,
  orgRevenue,
  hits,
  avgPrice,
  successRate,
  apisUsed,
  topApiLabel,
  leak,
}: {
  revenue: number;
  momDelta: number | null;
  briefing: string;
  orgRevenue: number;
  hits: number;
  avgPrice: number;
  successRate: number | null;
  apisUsed: number;
  topApiLabel?: string;
  leak: {
    /** active → no current price (urgent). historical → priced now, residual past hits. */
    kind: "active" | "historical";
    pairs: number;
    hits: number;
    /** Estimated rupees at risk; 0 when no usable rate exists. */
    amount: number;
    href: string;
    editable: boolean;
  } | null;
}) {
  const isHistorical = leak?.kind === "historical";
  const orgShare = orgRevenue > 0 ? Math.min(100, (revenue / orgRevenue) * 100) : 0;

  return (
    <section className="elev-1 bg-bg-raised rounded-lg p-6 dash-enter" style={{ "--i": 0 } as React.CSSProperties}>
      <div className="flex flex-col lg:flex-row gap-x-10 gap-y-6">
        {/* Narrative: landmark + briefing */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xs uppercase tracking-widest text-ink-muted">MTD revenue</h2>
          <div className="flex items-end gap-3 mt-[6px]">
            <span className="inline-block">
              <span
                className="block font-serif text-5xl text-ink leading-none tnum landmark-wipe"
                style={{ fontWeight: 600 }}
              >
                {formatINR(revenue, { precision: 0 })}
              </span>
              <span className="block h-px bg-accent mt-2 landmark-rail" aria-hidden="true" />
            </span>
            <DeltaPill pct={momDelta} suffix="vs prior month" />
          </div>
          <p className="text-sm text-ink-muted mt-4 max-w-[65ch] leading-normal">{briefing}</p>
        </div>

        {/* Vitals rail: share-of-org meter + secondary stats */}
        <div className="lg:w-[320px] lg:shrink-0 lg:border-l lg:border-border lg:pl-8 pt-1 flex flex-col gap-5">
          <div>
            <div className="flex items-baseline justify-between mb-[6px]">
              <span className="text-xs uppercase tracking-widest text-ink-muted">Share of org revenue</span>
              <span className="text-sm font-mono tnum text-accent-ink">
                {orgRevenue > 0 ? `${orgShare.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-bg-sunken overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full bar-grow"
                style={{ width: `${Math.max(orgShare, revenue > 0 ? 1.5 : 0)}%` }}
              />
            </div>
            <div className="mt-[6px] text-[11px] text-ink-faint font-mono">
              of {formatINR(orgRevenue, { compact: true })} org MTD
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Stat
              icon={<Activity size={12} strokeWidth={1.5} />}
              label="Hits"
              value={formatNumber(hits)}
            />
            <Stat
              icon={<CircleDollarSign size={12} strokeWidth={1.5} />}
              label="Avg ₹/hit"
              value={avgPrice > 0 ? `₹${avgPrice.toFixed(2)}` : "—"}
            />
            <Stat
              icon={<Percent size={12} strokeWidth={1.5} />}
              label="Success rate"
              value={successRate != null ? `${successRate.toFixed(0)}%` : "—"}
            />
            <Stat
              icon={<Zap size={12} strokeWidth={1.5} />}
              label={topApiLabel ? "Top API share" : "APIs used"}
              value={topApiLabel ?? String(apisUsed)}
            />
          </div>
        </div>
      </div>

      {leak && leak.pairs > 0 && (
        <div className="mt-6 risk-enter" style={{ "--i": 0 } as React.CSSProperties}>
          <Link
            href={leak.href}
            className={`group lift-row flex items-center gap-3 px-[14px] py-3 rounded-md transition-colors duration-fast ease-expo focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isHistorical ? "bg-warn-bg hover:bg-warn-bg-hover" : "bg-bad-bg hover:bg-bad-bg-hover"
            }`}
          >
            <CircleDollarSign
              size={18}
              strokeWidth={1.5}
              className={`shrink-0 ${isHistorical ? "text-warn-ink" : "text-bad-ink"}`}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className={`text-sm truncate ${isHistorical ? "text-warn-ink" : "text-bad-ink"}`} style={{ fontWeight: 500 }}>
                {isHistorical
                  ? `Historical leak · ${leak.pairs} priced pair${leak.pairs === 1 ? "" : "s"}`
                  : `Revenue leak · ${leak.pairs} unpriced pair${leak.pairs === 1 ? "" : "s"}`}
              </div>
              <div className="text-xs text-ink-muted truncate">
                {isHistorical
                  ? leak.editable
                    ? "Hits before the price took effect — backdate to capture, or mark fixed below"
                    : "Hits billed at ₹0 before the current price took effect"
                  : leak.editable
                    ? "Set unit prices for these APIs to start billing"
                    : "Contact an admin to set unit prices for these pairs"}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-sm font-mono tnum ${isHistorical ? "text-warn-ink" : "text-bad-ink"}`}>
                {leak.amount > 0 ? (
                  <>
                    <span className="text-[10px] text-ink-faint mr-[2px]">est</span>
                    {formatINR(leak.amount, { compact: true })}
                  </>
                ) : isHistorical ? (
                  "historical"
                ) : (
                  "unpriced"
                )}
              </div>
              <div className="text-[10px] text-ink-faint font-mono">{formatNumber(leak.hits)} hits</div>
            </div>
            <ChevronRight
              size={16}
              strokeWidth={1.5}
              className="shrink-0 text-ink-faint group-hover:translate-x-[2px] transition-transform duration-fast ease-expo"
              aria-hidden="true"
            />
          </Link>
        </div>
      )}
    </section>
  );
}
