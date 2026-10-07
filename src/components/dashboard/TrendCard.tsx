"use client";
import { prefersReducedMotion } from "@/lib/motion";
import { CostConfidence } from "@/components/vendor/CostConfidence";
import type { CostConfidence as Confidence } from "@/lib/vendor-confidence";
import {
  ComposedChart,
  Area,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Row = { date: string; revenue: number; margin: number | null };

function LegendDot({ color, dash, label }: { color: string; dash?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-[6px] text-xs text-ink-muted">
      {dash ? (
        <span className="w-3 border-t-2 border-dashed" style={{ borderColor: color }} />
      ) : (
        <span className="w-[10px] h-[10px] rounded-sm" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  );
}

export function TrendCard({
  data,
  title,
  caption,
  height = 220,
  confidence,
}: {
  data: Row[];
  title: string;
  /** Shown under the chart — e.g. that per-month tiered revenue isn't on any day. */
  caption?: string;
  /** Plot height in px — bump when the card sits beside a taller rail. */
  height?: number;
  /**
   * Coverage behind the margin line. Passed where this card is the surface
   * that states margin (the account page); the dashboard states it on the
   * Headline instead and leaves this unset rather than saying it twice.
   */
  confidence?: Confidence | null;
}) {
  // Margin is cost-gated; when redacted (all null) drop the line + legend.
  const showMargin = data.some((d) => d.margin != null);
  const fmtDay = (d: string) => {
    const dt = new Date(d);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]}`;
  };

  return (
    <section
      className="elev-1 bg-bg-raised rounded-lg p-5 dash-enter"
      style={{ "--i": 4 } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-serif text-base text-ink" style={{ fontWeight: 600 }}>
          {title}
        </h2>
        <div className="flex items-center gap-5">
          <LegendDot color="var(--color-viz-1)" label="Revenue" />
          {showMargin && <LegendDot color="var(--color-ink-muted)" dash label="Margin" />}
          {showMargin && confidence && (
            <CostConfidence confidence={confidence} align="end" className="w-[150px]" />
          )}
        </div>
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDay}
              stroke="var(--color-ink-faint)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              stroke="var(--color-ink-faint)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.5rem",
                fontSize: "0.8125rem",
                padding: "0.625rem 0.75rem",
                boxShadow: "none",
              }}
              labelStyle={{ color: "var(--color-ink-muted)", marginBottom: 4 }}
              itemStyle={{ padding: 0 }}
              formatter={(value: any, name: string) => {
                const labels: Record<string, string> = { revenue: "Revenue", margin: "Margin" };
                return [`$${Math.round(value).toLocaleString("en-US")}`, labels[name] ?? name];
              }}
              labelFormatter={fmtDay}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-viz-1)"
              strokeWidth={2}
              fill="var(--color-viz-1-faint)"
              fillOpacity={0.55}
              dot={false}
              isAnimationActive={!prefersReducedMotion()}
              animationDuration={1100}
              animationEasing="ease-out"
            />
            {showMargin && (
              <Line
                type="monotone"
                dataKey="margin"
                // Dashed neutral line: at high margin it runs close to the teal
                // revenue line, and a second teal-green line was hard to tell apart.
                stroke="var(--color-ink-muted)"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                isAnimationActive={!prefersReducedMotion()}
                animationDuration={1100}
                animationEasing="ease-out"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {caption && (
        <p className="text-xs text-ink-faint mt-2 leading-snug">{caption}</p>
      )}
    </section>
  );
}
