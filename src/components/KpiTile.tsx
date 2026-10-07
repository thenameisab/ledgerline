import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { RollingText } from "./ui/RollingText";

export function KpiTile({
  label,
  value,
  sublabel,
  size = "md",
  emphasis = false,
  icon,
  deltaPct,
  deltaSuffix,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  emphasis?: boolean;
  icon?: React.ReactNode;
  /** Period-over-period delta percentage. -12 = down 12 %. */
  deltaPct?: number | null;
  /** Tail text on the delta chip — e.g. "vs Apr". Defaults to "vs prior". */
  deltaSuffix?: string;
}) {
  const valueClass =
    size === "xl"
      ? "text-6xl"
      : size === "lg"
      ? "text-4xl"
      : size === "md"
      ? "text-3xl"
      : "text-2xl";

  return (
    <div className={`elev-1 bg-bg-raised rounded-lg px-5 py-4 ${emphasis ? "border-l-0" : ""}`}>
      <h2 className="flex items-center gap-2 text-sm text-ink-muted" style={{ fontWeight: 400 }}>
        {icon}
        <span>{label}</span>
      </h2>
      <div className={`font-serif ${valueClass} text-ink leading-tight mt-1 tnum`}>
        {typeof value === "string" ? (
          <RollingText text={value} options={{ direction: "up" }} />
        ) : (
          value
        )}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1.5 min-h-[18px]">
        {sublabel && <div className="text-xs text-ink-faint min-w-0 truncate">{sublabel}</div>}
        {deltaPct != null && Number.isFinite(deltaPct) ? (
          <DeltaChip pct={deltaPct} suffix={deltaSuffix ?? "vs prior"} />
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function DeltaChip({ pct, suffix }: { pct: number; suffix: string }) {
  const Icon = pct > 0.5 ? TrendingUp : pct < -0.5 ? TrendingDown : Minus;
  const tone =
    pct > 0.5
      ? "text-success-ink bg-success-bg"
      : pct < -0.5
      ? "text-bad-ink bg-bad-bg"
      : "text-ink-faint bg-bg-sunken";
  const sign = pct > 0 ? "+" : "";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono tnum rounded px-1.5 py-0.5 shrink-0 ${tone}`}
      title={`${sign}${pct.toFixed(1)}% ${suffix}`}
    >
      <Icon size={10} strokeWidth={1.75} />
      {sign}
      {pct.toFixed(0)}%
    </span>
  );
}
