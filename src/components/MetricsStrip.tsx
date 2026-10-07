import { Sparkline } from "./Sparkline";
import { TruncateTooltip } from "./ui/TruncateTooltip";
import { RollingText } from "./ui/RollingText";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type MetricInput = {
  label: string;
  value: string;
  // Optional MoM / period delta — number is percentage (-12.5 = down 12.5%)
  delta_pct?: number | null;
  // Optional spark series
  spark?: number[];
  // Sublabel (units / window qualifier). Strings auto-tooltip on overflow.
  sublabel?: string;
};

export function MetricsStrip({ metrics }: { metrics: MetricInput[] }) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((m) => (
        <Metric key={m.label} {...m} />
      ))}
    </section>
  );
}

function Metric({ label, value, delta_pct, spark, sublabel }: MetricInput) {
  return (
    <div className="bg-bg-raised border border-border rounded-lg p-4 flex flex-col justify-between min-h-[110px]">
      <h3 className="text-[11px] uppercase tracking-wide text-ink-faint" style={{ fontWeight: 500 }}>{label}</h3>
      <div className="font-serif text-2xl text-ink tnum mt-2 leading-none" style={{ fontWeight: 600 }}>
        <RollingText text={value} options={{ direction: "up" }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 min-h-[20px]">
        {delta_pct != null && Number.isFinite(delta_pct) ? <DeltaPill pct={delta_pct} /> : <span />}
        {spark && spark.length > 1 && (
          <Sparkline data={spark} width={52} height={18} stroke="var(--color-accent)" />
        )}
      </div>
      {sublabel && (
        <TruncateTooltip
          as="div"
          text={sublabel}
          className="text-[10px] text-ink-faint mt-1"
        />
      )}
    </div>
  );
}

function DeltaPill({ pct }: { pct: number }) {
  const Icon = pct > 0.5 ? TrendingUp : pct < -0.5 ? TrendingDown : Minus;
  const tone =
    pct > 0.5
      ? "text-ok-ink"
      : pct < -0.5
      ? "text-bad-ink"
      : "text-ink-faint";
  const sign = pct > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-mono tnum ${tone}`}>
      <Icon size={11} strokeWidth={1.5} />
      {sign}
      {pct.toFixed(0)}%
    </span>
  );
}
