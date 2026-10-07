"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Customized,
} from "recharts";
import { formatINR, formatPercent } from "@/lib/format";

export type QuadrantPoint = {
  client_id: number;
  name: string;
  href: string;
  revenue: number;
  /** MoM growth %. Points are only plotted when this is non-null. */
  delta_pct: number;
  logoUrl?: string | null;
};

// Growth axis is unbounded (an account off a tiny base can be +900%); clamp the
// plotted position into a readable window and keep the true value for the label.
const Y_MIN = -100;
const Y_MAX = 150;
const clampY = (v: number) => Math.max(Y_MIN, Math.min(Y_MAX, v));

function initials(name: string) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[w.length - 1][0]).toUpperCase();
}

const DOT_R = 13;
// Minimum distance between two dot centres: two radii, the 1.5px ring on each, and a 3px gap.
const MIN_DIST = 2 * (DOT_R + 1.5) + 3;

/**
 * Moves dots so that none overlap. Points arrive sorted by revenue (largest
 * first), and each keeps its true position when that spot is free. Otherwise it
 * takes the nearest free spot on rings around its true position, spaced half
 * a dot apart so each dot moves only as far as it must, inside the plot area.
 */
function dodge(
  pts: { cx: number; cy: number }[],
  box: { left: number; top: number; right: number; bottom: number },
): { x: number; y: number }[] {
  const placed: { x: number; y: number }[] = [];
  return pts.map((p) => {
    for (let ring = 0; ring <= 12; ring++) {
      const steps = ring === 0 ? 1 : 8 * ring;
      for (let k = 0; k < steps; k++) {
        const a = (2 * Math.PI * k) / steps - Math.PI / 2;
        const x = p.cx + ((ring * MIN_DIST) / 2) * Math.cos(a);
        const y = p.cy + ((ring * MIN_DIST) / 2) * Math.sin(a);
        if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
        if (placed.every((q) => Math.hypot(q.x - x, q.y - y) >= MIN_DIST)) {
          placed.push({ x, y });
          return { x, y };
        }
      }
    }
    placed.push({ x: p.cx, y: p.cy });
    return { x: p.cx, y: p.cy };
  });
}

type Hover = { p: QuadrantPoint; x: number; y: number } | null;

/** Draws every dot, using the scatter's computed pixel positions (passed in by
 *  recharts' <Customized>). A moved dot gets a thin line back to its true position. */
function DotLayer(props: any) {
  const { onHover } = props as { onHover: (h: Hover) => void };
  const pts: { cx: number; cy: number; payload: QuadrantPoint }[] =
    props.formattedGraphicalItems?.[0]?.props?.points ?? [];
  const o = props.offset as { left: number; top: number; width: number; height: number } | undefined;
  if (!o || pts.length === 0) return null;
  const placed = dodge(pts, { left: o.left, top: o.top, right: o.left + o.width, bottom: o.top + o.height });
  return (
    <g>
      {pts.map((pt, i) => (
        <LogoDot
          key={pt.payload.client_id}
          payload={pt.payload}
          trueX={pt.cx}
          trueY={pt.cy}
          cx={placed[i].x}
          cy={placed[i].y}
          onHover={onHover}
        />
      ))}
    </g>
  );
}

function LogoDot({
  payload,
  cx,
  cy,
  trueX,
  trueY,
  onHover,
}: {
  payload: QuadrantPoint;
  cx: number;
  cy: number;
  trueX: number;
  trueY: number;
  onHover: (h: Hover) => void;
}) {
  const router = useRouter();
  const r = DOT_R;
  const clip = `qd-clip-${payload.client_id}`;
  const up = payload.delta_pct >= 0;
  const ring = up ? "var(--color-success)" : "var(--color-bad)";
  const moved = Math.hypot(cx - trueX, cy - trueY) > 0.5;

  return (
    <g
      onClick={() => router.push(payload.href)}
      onMouseEnter={() => onHover({ p: payload, x: cx, y: cy })}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: "pointer" }}
      aria-label={`${payload.name}, ${formatINR(payload.revenue, { compact: true })}, ${formatPercent(payload.delta_pct, 0)}`}
    >
      {moved && (
        <>
          <line x1={trueX} y1={trueY} x2={cx} y2={cy} stroke={ring} strokeWidth={1} strokeOpacity={0.6} />
          <circle cx={trueX} cy={trueY} r={2} fill={ring} />
        </>
      )}
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r + 1.5} fill="var(--color-bg-raised)" stroke={ring} strokeWidth={1.5} />
      {payload.logoUrl ? (
        <image
          href={payload.logoUrl}
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          clipPath={`url(#${clip})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="var(--color-ink-muted)" fontWeight={600}>
          {initials(payload.name)}
        </text>
      )}
    </g>
  );
}

function PointTooltip({ p }: { p: QuadrantPoint }) {
  return (
    <div
      className="rounded-md text-[13px]"
      style={{
        backgroundColor: "var(--color-bg-raised)",
        border: "1px solid var(--color-border)",
        padding: "0.5rem 0.625rem",
      }}
    >
      <div className="text-ink font-medium">{p.name}</div>
      <div className="text-ink-muted tnum">{formatINR(p.revenue)}</div>
      <div className={p.delta_pct >= 0 ? "text-success-ink tnum" : "text-bad-ink tnum"}>
        {p.delta_pct > 0 ? "+" : ""}
        {formatPercent(p.delta_pct, 0)} vs last month
      </div>
    </div>
  );
}

/** Scatter shape that draws nothing: DotLayer draws the dots after collision handling. */
function NoDot() {
  return <g />;
}

export function GrowthQuadrant({ points }: { points: QuadrantPoint[] }) {
  const [hover, setHover] = useState<Hover>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Open the hover card on the side of the dot with more room.
  const flip = hover != null && hover.x > (boxRef.current?.clientWidth ?? 0) / 2;
  const data = points.map((p) => ({ ...p, x: p.revenue, y: clampY(p.delta_pct) }));
  // Vertical divide: median revenue separates the "whales" from the long tail.
  const revs = points.map((p) => p.revenue).sort((a, b) => a - b);
  const median = revs.length ? revs[Math.floor(revs.length / 2)] : 0;
  // Pad the log domain so points at the revenue extremes sit inside the plot
  // area — otherwise the dot radius spills past the edge and clips the logo.
  const minRev = revs[0] ?? 1;
  const maxRev = revs[revs.length - 1] ?? 1;
  const xDomain: [number, number] = [minRev / 1.8, maxRev * 1.8];
  // Log-scale ticks at powers of ten, so the scale reads as ₹1K, ₹10K, ₹1L, …
  const xTicks: number[] = [];
  for (let t = 10 ** Math.ceil(Math.log10(Math.max(xDomain[0], 1))); t <= xDomain[1]; t *= 10) xTicks.push(t);

  return (
    <section
      className="elev-1 bg-bg-raised rounded-lg p-5 dash-enter"
      style={{ "--i": 8 } as React.CSSProperties}
    >
      <h2 className="font-serif text-base text-ink mb-1" style={{ fontWeight: 600 }}>
        Growth quadrant
      </h2>
      <p className="text-[11px] text-ink-faint mb-3">
        Revenue (→, log scale) vs growth on last month (↑, capped at +150%) · bottom-right = large accounts losing ground
      </p>
      <div ref={boxRef} className="relative" style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
            {/* Shade the at-risk corner: big revenue (≥ median), shrinking (< 0%). */}
            <ReferenceArea x1={median} y2={0} fill="var(--color-bad-bg)" fillOpacity={0.4} />
            <XAxis
              type="number"
              dataKey="x"
              scale="log"
              domain={xDomain}
              ticks={xTicks.length >= 2 ? xTicks : undefined}
              allowDataOverflow
              stroke="var(--color-ink-faint)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatINR(v, { compact: true })}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[Y_MIN, Y_MAX]}
              ticks={[-100, -50, 0, 50, 100, 150]}
              stroke="var(--color-ink-faint)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={48}
              // Growth above +150% is drawn on the top edge, so the top tick reads "≥".
              tickFormatter={(v) => (v === Y_MAX ? `≥+${v}%` : `${v > 0 ? "+" : ""}${v}%`)}
            />
            <ZAxis range={[1, 1]} />
            <ReferenceLine y={0} stroke="var(--color-border)" strokeWidth={1} />
            <ReferenceLine x={median} stroke="var(--color-border)" strokeDasharray="2 3" />
            <Scatter data={data} shape={<NoDot />} isAnimationActive={false} />
            <Customized component={<DotLayer onHover={setHover} />} />
          </ScatterChart>
        </ResponsiveContainer>
        {hover && (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: flip ? undefined : hover.x + DOT_R + 6,
              right: flip ? (boxRef.current?.clientWidth ?? 0) - hover.x + DOT_R + 6 : undefined,
              top: hover.y - DOT_R,
            }}
          >
            <PointTooltip p={hover.p} />
          </div>
        )}
      </div>

      {/* a11y data table. sr-only goes on a wrapper div: on the <table> itself it
          does not clip the rows, and the hidden rows added blank scroll below the page. */}
      <div className="sr-only">
        <table>
          <caption>Accounts by revenue and month-over-month growth</caption>
          <thead>
            <tr><th>Account</th><th>Revenue</th><th>Growth vs last month</th></tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.client_id}>
                <td>{p.name}</td>
                <td>{formatINR(p.revenue)}</td>
                <td>{formatPercent(p.delta_pct, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
