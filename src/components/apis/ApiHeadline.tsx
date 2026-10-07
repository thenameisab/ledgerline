import { Activity, Users, CircleDollarSign, ArrowLeftRight } from "lucide-react";
import { formatINR, formatNumber } from "@/lib/format";
import { DeltaPill, Stat } from "@/components/dashboard/Headline";
import { MarginBullet } from "@/components/dashboard/MarginBullet";
import { CostConfidence } from "@/components/vendor/CostConfidence";
import { isLowConfidence, type CostConfidence as Confidence } from "@/lib/vendor-confidence";

// Per-API hero in the flagship language: serif landmark + accent rail, MoM
// delta, briefing prose, share-of-org bar and the margin bullet. Price spread
// is a first-class stat — the PRD's canonical insight is the same API priced
// 0.35–1.85 across customers.
export function ApiHeadline({
  revenue,
  momDelta,
  briefing,
  orgRevenue,
  marginPct,
  hits,
  accounts,
  avgPrice,
  spread,
  confidence,
  costFixHref,
}: {
  revenue: number;
  momDelta: number | null;
  briefing: string;
  orgRevenue: number;
  marginPct: number | null;
  hits: number;
  accounts: number;
  avgPrice: number;
  spread: { min: number; max: number } | null;
  /** Share of this API's hits whose vendor rate is known. Null for viewers who never see cost. */
  confidence?: Confidence | null;
  /** Rate card this API's cost is fixed on — its vendor's, when the API has one. */
  costFixHref?: string;
}) {
  const orgShare = orgRevenue > 0 ? Math.min(100, (revenue / orgRevenue) * 100) : 0;

  return (
    <section className="elev-1 bg-bg-raised rounded-lg p-6 dash-enter" style={{ "--i": 0 } as React.CSSProperties}>
      <div className="flex flex-wrap gap-x-10 gap-y-6 items-start">
        <div className="min-w-[260px] flex-1">
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
          <p className="text-sm text-ink-muted mt-3 max-w-xl leading-normal">{briefing}</p>
        </div>

        <div className="min-w-[240px] w-[280px] flex flex-col gap-4 pt-1">
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
          </div>
          {marginPct != null && (
            <div>
              <MarginBullet pct={marginPct} muted={isLowConfidence(confidence)} />
              {confidence && (
                <CostConfidence confidence={confidence} fixHref={costFixHref} className="mt-2" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mt-6 pt-5 border-t border-border">
        <Stat icon={<Activity size={12} strokeWidth={1.5} />} label="Hits" value={formatNumber(hits)} />
        <Stat icon={<Users size={12} strokeWidth={1.5} />} label="Accounts" value={String(accounts)} />
        <Stat
          icon={<CircleDollarSign size={12} strokeWidth={1.5} />}
          label="Avg ₹/hit"
          value={avgPrice > 0 ? `₹${avgPrice.toFixed(2)}` : "—"}
        />
        <Stat
          icon={<ArrowLeftRight size={12} strokeWidth={1.5} />}
          label="Price spread"
          value={
            spread && spread.min > 0
              ? `${(spread.max / spread.min).toFixed(1)}× · ₹${spread.min.toFixed(2)}–₹${spread.max.toFixed(2)}`
              : "—"
          }
        />
      </div>
    </section>
  );
}
