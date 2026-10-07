import type { ActivityDay } from "@/lib/repos/types";
import { formatNumber } from "@/lib/format";

// 90-day GitHub-style activity heatmap.
// Columns are weeks (Sun → Sat); rows are weekdays. Cells tinted by hit volume
// using the design system accent color at progressive chroma.

type Props = {
  data: ActivityDay[];
  windowEnd: string; // ISO date — last day to render (rightmost column).
  windowDays?: number; // default 90
  cell?: number; // pixel size of one cell
  gap?: number;
};

export function ActivityHeatmap({
  data,
  windowEnd,
  windowDays = 90,
  cell = 12,
  gap = 3,
}: Props) {
  const dayMap = new Map<string, ActivityDay>();
  for (const d of data) dayMap.set(d.date, d);

  const end = new Date(windowEnd + "T00:00:00Z");
  const days: { date: string; hits: number; revenue: number; col: number; row: number }[] = [];

  // Build day list ending on `end`, going back `windowDays` days. We pad to the
  // start of that week (Sunday=0) so columns align.
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (windowDays - 1));
  const padStart = new Date(start);
  padStart.setUTCDate(start.getUTCDate() - start.getUTCDay()); // align to Sunday

  for (let d = new Date(padStart); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const inWindow = d >= start;
    const entry = dayMap.get(iso);
    days.push({
      date: iso,
      hits: inWindow ? entry?.hits ?? 0 : -1, // -1 marks pad cells
      revenue: entry?.revenue ?? 0,
      col: 0,
      row: 0,
    });
  }

  // Assign col (week index) + row (weekday). Col 0 is leftmost (oldest).
  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i].date + "T00:00:00Z");
    days[i].row = d.getUTCDay();
    days[i].col = Math.floor(i / 7);
  }

  // Quintile bucketing by hits among in-window non-zero days.
  const positive = days.filter((d) => d.hits > 0).map((d) => d.hits).sort((a, b) => a - b);
  const q = (p: number) =>
    positive.length === 0 ? 0 : positive[Math.min(positive.length - 1, Math.floor(positive.length * p))];
  const q1 = q(0.25);
  const q2 = q(0.5);
  const q3 = q(0.75);

  const bucket = (hits: number): 0 | 1 | 2 | 3 | 4 => {
    if (hits <= 0) return 0;
    if (hits <= q1) return 1;
    if (hits <= q2) return 2;
    if (hits <= q3) return 3;
    return 4;
  };

  const totalCols = Math.max(...days.map((d) => d.col)) + 1;
  // +32 left axis, +24 right buffer so the last month label ("May") isn't clipped.
  const width = totalCols * (cell + gap) - gap + 32 + 24;
  const height = 7 * (cell + gap) - gap + 24; // +24 month axis top

  // Month labels along the top — show when the month changes between adjacent weeks.
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let c = 0; c < totalCols; c++) {
    // First day of this column
    const firstIdx = c * 7;
    if (firstIdx >= days.length) break;
    const d = new Date(days[firstIdx].date + "T00:00:00Z");
    const m = d.getUTCMonth();
    if (m !== lastMonth) {
      // A 3-letter label is wider than one column. When the window starts late
      // in a month, the next month's label falls one column later and the two
      // overlapped ("AprMay"). Drop the earlier, partial month's label.
      const prev = monthLabels[monthLabels.length - 1];
      if (prev && c - prev.col < 2) monthLabels.pop();
      monthLabels.push({ col: c, label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) });
      lastMonth = m;
    }
  }

  const dayLabels = ["Mon", "Wed", "Fri"]; // 1, 3, 5

  const totalHits = days.filter((d) => d.hits > 0).reduce((s, d) => s + d.hits, 0);
  const activeDays = days.filter((d) => d.hits > 0).length;

  return (
    <div className="bg-bg-raised border border-border rounded-lg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
        <h2 className="font-serif text-base text-ink" style={{ fontWeight: 600 }}>
          Activity
        </h2>
        <div className="text-xs text-ink-faint font-mono">
          {formatNumber(totalHits)} hits · {activeDays}/{windowDays} active days
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Activity heatmap last 90 days">
          {/* Month labels top */}
          {monthLabels.map((m) => (
            <text
              key={`m-${m.col}`}
              x={32 + m.col * (cell + gap)}
              y={10}
              fontSize={10}
              fill="var(--color-ink-faint)"
              fontFamily="var(--font-sans)"
            >
              {m.label}
            </text>
          ))}

          {/* Day-of-week labels left */}
          {dayLabels.map((label, i) => (
            <text
              key={label}
              x={0}
              y={24 + (i * 2 + 1) * (cell + gap) + cell - 2}
              fontSize={10}
              fill="var(--color-ink-faint)"
              fontFamily="var(--font-sans)"
            >
              {label}
            </text>
          ))}

          {/* Cells. Title is a single string child — multiple text/expression
              children produce inconsistent text-node splitting between SSR and
              hydration, especially inside SVG <title>. */}
          {days.map((d) => {
            if (d.hits < 0) return null; // pad
            const b = bucket(d.hits);
            const titleText =
              `${d.date} · ${formatNumber(d.hits)} hit${d.hits === 1 ? "" : "s"}` +
              (d.revenue > 0 ? ` · ₹${formatNumber(Math.round(d.revenue))}` : "");
            return (
              <rect
                key={d.date}
                x={32 + d.col * (cell + gap)}
                y={24 + d.row * (cell + gap)}
                width={cell}
                height={cell}
                rx={2}
                ry={2}
                className={`${CELL_CLASS[b]} heat-in`}
                style={{ "--i": d.col } as React.CSSProperties}
                aria-label={`${d.date}: ${d.hits} hits`}
              >
                <title>{titleText}</title>
              </rect>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-ink-faint">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((b) => (
          <span
            key={b}
            className={`inline-block w-3 h-3 rounded-sm ${CELL_CLASS[b]}`}
            style={{ verticalAlign: "middle" }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

const CELL_CLASS: Record<number, string> = {
  0: "fill-heat-0",
  1: "fill-heat-1",
  2: "fill-heat-2",
  3: "fill-heat-3",
  4: "fill-heat-4",
};

