"use client";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Row = { date: string; revenue: number; margin: number; vendor_cost: number; hits: number };

export function RevenueChart({ data, height = 200 }: { data: Row[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 2" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) =>
              new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
            }
            stroke="var(--color-ink-faint)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--color-ink-faint)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-bg-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              padding: "0.75rem",
              color: "var(--color-ink)",
            }}
            formatter={(value: any, name: string) => {
              const labels: Record<string, string> = { revenue: "Revenue", margin: "Margin", vendor_cost: "Vendor cost" };
              return [`₹${Math.round(value).toLocaleString("en-IN")}`, labels[name] ?? name];
            }}
            labelFormatter={(d) =>
              new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
            }
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-viz-1)"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="margin"
            stroke="var(--color-viz-2)"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
