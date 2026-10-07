"use client";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Row = { date: string; hits: number };

// Daily hit volume — the quantity behind the revenue chart. Revenue can hold
// steady while volume shifts (price mix, outcome mix); this makes that visible.
export function VolumeCard({ data }: { data: Row[] }) {
  const fmtDay = (d: string) => {
    const dt = new Date(d);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]}`;
  };
  const fmtHits = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : String(v);

  return (
    <section
      className="elev-1 bg-bg-raised rounded-lg p-5 dash-enter"
      style={{ "--i": 7 } as React.CSSProperties}
    >
      <h2 className="font-serif text-base text-ink mb-3" style={{ fontWeight: 600 }}>
        Daily usage volume
      </h2>
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
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
              width={42}
              tickFormatter={fmtHits}
            />
            <Tooltip
              cursor={{ fill: "var(--color-bg-sunken)" }}
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
              formatter={(value: any) => [
                `${Math.round(value).toLocaleString("en-IN")} hits`,
                "Volume",
              ]}
              labelFormatter={fmtDay}
            />
            <Bar
              dataKey="hits"
              fill="var(--color-viz-1)"
              fillOpacity={0.7}
              radius={[2, 2, 0, 0]}
              isAnimationActive={true}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
