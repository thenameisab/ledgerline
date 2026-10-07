"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber, formatPercent } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";

export type HitBreakdown = {
  successful: number;
  successful_no_data: number;
  failed: number;
  in_progress: number;
};

const SEGMENTS = [
  { key: "successful",        label: "Successful",      color: "var(--color-viz-2)" },
  { key: "successful_no_data", label: "No data",        color: "var(--color-viz-7)" },
  { key: "failed",            label: "Failed",          color: "var(--color-viz-8)" },
  { key: "in_progress",       label: "In progress",     color: "var(--color-viz-3)" },
] as const;

function buildData(b: HitBreakdown) {
  return SEGMENTS.map((s) => ({ ...s, value: b[s.key] })).filter((s) => s.value > 0);
}

export function ApiStatusChart({
  breakdown,
  size = "md",
}: {
  breakdown: HitBreakdown;
  size?: "sm" | "md";
}) {
  const total = breakdown.successful + breakdown.successful_no_data + breakdown.failed + breakdown.in_progress;
  const data = buildData(breakdown);
  const height = size === "sm" ? 100 : 140;
  const innerRadius = size === "sm" ? 24 : 36;
  const outerRadius = size === "sm" ? 40 : 58;

  if (total === 0) {
    return (
      <div className={`flex items-center justify-center ${size === "sm" ? "h-[100px]" : "h-[140px]"} text-ink-faint text-xs`}>
        No hits in this period
      </div>
    );
  }

  const successRate = total > 0
    ? ((breakdown.successful + breakdown.successful_no_data) / total) * 100
    : 0;

  return (
    <div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              // A single full-circle segment collapses to nothing when
              // paddingAngle > 0 (recharts renders a 360°-gap arc as empty), so
              // drop the gap when there's only one category.
              paddingAngle={data.length > 1 ? 2 : 0}
              isAnimationActive={!prefersReducedMotion()}
              animationDuration={900}
              animationEasing="ease-out"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.375rem",
                fontSize: "0.75rem",
                color: "var(--color-ink)",
              }}
              formatter={(value: number, _name: string, props: any) => [
                `${formatNumber(value)} (${formatPercent((value / total) * 100, 1)})`,
                props.payload.label,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
        {SEGMENTS.filter((s) => breakdown[s.key] > 0).map((s) => (
          <div key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: s.color }}
            />
            <span>{s.label}</span>
            <span className="font-mono text-ink-faint tnum">
              {formatPercent((breakdown[s.key] / total) * 100, 0)}
            </span>
          </div>
        ))}
      </div>

      {/* a11y data table. sr-only goes on a wrapper div: on the <table> itself it
          does not clip the rows, and the hidden rows added blank scroll below the page. */}
      <div className="sr-only">
        <table>
          <caption>API call status breakdown</caption>
          <thead>
            <tr><th>Status</th><th>Hits</th><th>Share</th></tr>
          </thead>
          <tbody>
            {SEGMENTS.map((s) => (
              <tr key={s.key}>
                <td>{s.label}</td>
                <td>{formatNumber(breakdown[s.key])}</td>
                <td>{formatPercent((breakdown[s.key] / total) * 100, 1)}</td>
              </tr>
            ))}
            <tr><td>Total</td><td>{formatNumber(total)}</td><td>100%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
