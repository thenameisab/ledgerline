import { TrendingUp, TrendingDown, Truck, Users, Activity } from "lucide-react";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { ApiStatusChart } from "@/components/charts/ApiStatusChart";
import { RollingText } from "@/components/ui/RollingText";
import { MonthPace } from "./MonthPace";
import { MarginBullet } from "./MarginBullet";
import { CostConfidence } from "@/components/vendor/CostConfidence";
import { isLowConfidence, type CostConfidence as Confidence } from "@/lib/vendor-confidence";
import type { WindowKpis } from "@/lib/repos/usage";

/**
 * A month-over-month change chip. `suffix` is the tooltip; `caption`, when set,
 * shows next to the chip (use it when the comparison needs saying, e.g. a
 * part month against a full one). Changes within ±0.5% show the number with
 * no trend icon.
 */
export function DeltaPill({ pct, suffix, caption }: { pct: number | null; suffix: string; caption?: string }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const Icon = pct > 0.5 ? TrendingUp : pct < -0.5 ? TrendingDown : null;
  const tone =
    pct > 0.5 ? "text-success-ink bg-success-bg" : pct < -0.5 ? "text-bad-ink bg-bad-bg" : "text-ink-faint bg-bg-sunken";
  const sign = pct > 0 ? "+" : "";
  const pill = (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono tnum rounded-md px-2 py-1 whitespace-nowrap ${tone}`}
      title={`${sign}${pct.toFixed(1)}% ${suffix}`}
    >
      {Icon && <Icon size={12} strokeWidth={1.5} />}
      {sign}
      {pct.toFixed(1)}%
    </span>
  );
  if (!caption) return pill;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {pill}
      <span className="max-w-[180px] text-xs leading-snug text-ink-muted">{caption}</span>
    </span>
  );
}

export function Stat({
  icon,
  label,
  value,
  signValue,
  riseTone = "rise-good",
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  signValue?: number;
  riseTone?: "rise-good" | "rise-bad";
  /** Low-confidence figures drop to the muted token — same treatment as "—". */
  muted?: boolean;
}) {
  return (
    <div className="min-w-[92px]">
      <div className="flex items-center gap-[6px] text-xs text-ink-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`font-mono tnum text-lg mt-[2px] ${muted ? "text-ink-muted" : "text-ink"}`}>
        <RollingText text={value} options={{ direction: "up" }} colorOnChange={riseTone} signValue={signValue} />
      </div>
    </div>
  );
}

export function Headline({
  kpis,
  revenueDelta,
  benchmark,
  elapsed,
  total,
  briefing,
  runRateNote,
  confidence,
}: {
  kpis: WindowKpis;
  revenueDelta: number | null;
  benchmark: number;
  elapsed: number;
  total: number;
  briefing: React.ReactNode;
  /** Set when the window runs past the last billing period — revenue is live run-rate, not yet invoiced. */
  runRateNote?: string;
  /** Share of the window's hits whose vendor rate is known. Null for viewers who never see cost. */
  confidence?: Confidence | null;
}) {
  // Cost/margin are cost-gated; redacted KPIs arrive as null.
  const showCost = kpis.margin != null && kpis.vendor_cost != null && kpis.margin_pct != null;
  const lowCost = isLowConfidence(confidence);
  return (
    <section
      className="elev-1 bg-bg-raised rounded-lg p-6 dash-enter"
      style={{ "--i": 0 } as React.CSSProperties}
    >
      <div className="flex flex-wrap gap-x-10 gap-y-6 items-start">
        {/* Landmark revenue + briefing */}
        <div className="min-w-[260px] flex-1">
          <h2 className="text-xs uppercase tracking-widest text-ink-muted">MTD revenue</h2>
          <div className="flex items-end gap-3 mt-[6px]">
            <span className="inline-block">
              <span
                className="block font-hero text-6xl text-ink leading-none tnum landmark-wipe"
                style={{ fontWeight: 600 }}
              >
                <RollingText
                  text={formatMoney(kpis.revenue, { precision: 0 })}
                  options={{ direction: "up" }}
                  colorOnChange="rise-good"
                  signValue={kpis.revenue}
                />
              </span>
              {/* The rail under the page's one hero figure is the AI gradient —
                  this number is derived from every priced call underneath it,
                  and the rail is where that gets acknowledged. */}
              <span className="block h-[2px] bg-ai mt-2 landmark-rail" aria-hidden="true" />
            </span>
            <DeltaPill pct={revenueDelta} suffix="vs prior month (norm.)" />
          </div>
          {runRateNote && (
            <p className="text-xs text-ink-faint mt-2 max-w-md leading-snug">{runRateNote}</p>
          )}
          <p className="text-sm text-ink-muted mt-3 max-w-md leading-normal">{briefing}</p>
        </div>

        {/* Pace + margin bullet */}
        <div className="min-w-[240px] w-[280px] flex flex-col gap-4 pt-1">
          <MonthPace revenue={kpis.revenue} benchmark={benchmark} elapsed={elapsed} total={total} />
          {showCost && (
            <div>
              <MarginBullet pct={kpis.margin_pct!} muted={lowCost} />
              {confidence && <CostConfidence confidence={confidence} className="mt-2" />}
            </div>
          )}
        </div>
      </div>

      {/* Secondary stats + call status */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mt-6 pt-5 border-t border-border">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          {showCost && (
            <>
              <Stat
                icon={<Truck size={12} strokeWidth={1.5} />}
                label="Vendor cost"
                value={formatMoney(kpis.vendor_cost!, { compact: true })}
                signValue={kpis.vendor_cost!}
                riseTone="rise-bad"
              />
              <Stat
                icon={<TrendingUp size={12} strokeWidth={1.5} />}
                label="Margin"
                value={`${formatMoney(kpis.margin!, { compact: true })} · ${formatPercent(kpis.margin_pct!, 0)}`}
                signValue={kpis.margin!}
                muted={lowCost}
              />
            </>
          )}
          <Stat
            icon={<Users size={12} strokeWidth={1.5} />}
            label="Active accounts"
            value={formatNumber(kpis.active_accounts)}
            signValue={kpis.active_accounts}
          />
          <Stat
            icon={<Activity size={12} strokeWidth={1.5} />}
            label="Units"
            value={formatNumber(kpis.total_hits)}
            signValue={kpis.total_hits}
          />
        </div>
        <div className="min-w-[200px] max-w-[340px] flex-1 ml-auto">
          <div className="text-xs text-ink-muted mb-1">Usage outcome</div>
          <ApiStatusChart breakdown={kpis.hit_breakdown} size="sm" />
        </div>
      </div>
    </section>
  );
}
