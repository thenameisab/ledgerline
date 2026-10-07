"use client";
import { useRouter } from "next/navigation";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { formatINR, formatPercent } from "@/lib/format";

export type PortfolioCell = {
  client_id: number;
  name: string;
  href: string;
  /** MTD revenue — drives tile area. */
  revenue: number;
  /** MoM growth %; null when the account had no prior-month revenue (new). */
  delta_pct: number | null;
  logoUrl?: string | null;
  /** A grey tile that sums several small ones; `name` is its label. */
  isOthers?: boolean;
};

// Recharts Treemap wants { name, value } leaves; we thread the rest through and
// read them back off the node props in the custom cell.
type Node = PortfolioCell & { name: string; value: number; isOthers?: boolean };

// Subtle growth tint: green when growing, red when shrinking, neutral accent
// for flat/new. Tiles carry the *-bg fill with the matching ink for text so the
// logo chip (raised bg) still reads on top.
function tint(delta_pct: number | null, isOthers?: boolean) {
  if (isOthers) return { fill: "var(--color-bg-sunken)", ink: "var(--color-ink-muted)" };
  if (delta_pct == null) return { fill: "var(--color-accent-bg)", ink: "var(--color-accent-ink)" };
  if (delta_pct >= 1) return { fill: "var(--color-success-bg)", ink: "var(--color-success-ink)" };
  if (delta_pct <= -1) return { fill: "var(--color-bad-bg)", ink: "var(--color-bad-ink)" };
  return { fill: "var(--color-accent-bg)", ink: "var(--color-accent-ink)" };
}

function CellNode(props: any) {
  const router = useRouter();
  const { x, y, width, height, depth, name, revenue, delta_pct, logoUrl, href, isOthers } =
    props as Node & { x: number; y: number; width: number; height: number; depth: number };

  // depth 0 is the synthetic root that spans the whole area — don't paint it.
  if (depth !== 1 || width <= 0 || height <= 0) return null;

  const { fill, ink } = tint(delta_pct ?? null, isOthers);
  const pad = 8;
  const logoSize = Math.min(28, width - 2 * pad, height - 28);
  const showLogo = !isOthers && !!logoUrl && width >= 60 && height >= 54;
  // Name sits below the logo (when shown); revenue 16px below the name. Gate
  // each on the tile having room so labels never clip the rounded bottom edge.
  const nameBaseline = showLogo ? pad + logoSize + 14 : pad + 12;
  const showName = width >= 78 && height >= nameBaseline + 4;
  const showRevenue = showName && height >= nameBaseline + 16 + 4;

  return (
    <g
      onClick={isOthers ? undefined : () => router.push(href)}
      style={{ cursor: isOthers ? "default" : "pointer" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={fill}
        stroke="var(--color-bg-raised)"
        strokeWidth={2}
      />
      {showLogo && (
        <>
          <rect
            x={x + pad}
            y={y + pad}
            width={logoSize}
            height={logoSize}
            rx={4}
            ry={4}
            fill="var(--color-bg-raised)"
            stroke="var(--color-border)"
            strokeWidth={1}
          />
          <image
            href={logoUrl}
            x={x + pad + 2}
            y={y + pad + 2}
            width={logoSize - 4}
            height={logoSize - 4}
            preserveAspectRatio="xMidYMid meet"
          />
        </>
      )}
      {showName && (
        <text
          x={x + pad}
          y={y + nameBaseline}
          fill={ink}
          stroke="none"
          fontSize={12}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          {name.length > Math.floor(width / 7) ? name.slice(0, Math.floor(width / 7) - 1) + "…" : name}
        </text>
      )}
      {showRevenue && (
        <text
          x={x + pad}
          y={y + nameBaseline + 16}
          fill={ink}
          stroke="none"
          fontSize={11}
          opacity={0.85}
          className="tnum"
          style={{ pointerEvents: "none" }}
        >
          {formatINR(revenue, { compact: true })}
          {delta_pct != null && !isOthers
            ? `  ${delta_pct > 0 ? "+" : ""}${Math.round(delta_pct)}%`
            : ""}
        </text>
      )}
    </g>
  );
}

function CellTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const n = payload[0].payload as Node;
  return (
    <div
      className="rounded-md text-[13px]"
      style={{
        backgroundColor: "var(--color-bg-raised)",
        border: "1px solid var(--color-border)",
        padding: "0.5rem 0.625rem",
      }}
    >
      <div className="text-ink font-medium">{n.name}</div>
      <div className="text-ink-muted tnum">{formatINR(n.revenue)}</div>
      {!n.isOthers && n.delta_pct != null && (
        <div className={n.delta_pct >= 0 ? "text-success-ink tnum" : "text-bad-ink tnum"}>
          {n.delta_pct > 0 ? "+" : ""}
          {formatPercent(n.delta_pct, 0)} vs last month
        </div>
      )}
      {!n.isOthers && n.delta_pct == null && <div className="text-ink-faint">new this month</div>}
    </div>
  );
}

export function PortfolioMap({
  cells,
  title = "Revenue concentration",
  caption = "Tile size = MTD revenue · color = vs last month",
}: {
  cells: PortfolioCell[];
  title?: string;
  caption?: string;
}) {
  const data: Node[] = cells.map((c) => ({ ...c, name: c.name, value: c.revenue }));
  const total = cells.reduce((s, c) => s + c.revenue, 0);

  return (
    <section
      className="elev-1 bg-bg-raised rounded-lg p-5 dash-enter"
      style={{ "--i": 7 } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-serif text-base text-ink" style={{ fontWeight: 600 }}>
          {title}
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: "var(--color-success-bg)" }} />
            growing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: "var(--color-bad-bg)" }} />
            shrinking
          </span>
        </div>
      </div>
      <p className="text-[11px] text-ink-faint mb-3">{caption}</p>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <Treemap
            data={data}
            dataKey="value"
            stroke="var(--color-bg-raised)"
            isAnimationActive={false}
            content={<CellNode />}
          >
            <Tooltip content={<CellTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* a11y data table. sr-only goes on a wrapper div: on the <table> itself it
          does not clip the rows, and the hidden rows added blank scroll below the page. */}
      <div className="sr-only">
        <table>
          <caption>Accounts by share of revenue</caption>
          <thead>
            <tr><th>Account</th><th>Revenue</th><th>Share</th><th>vs last month</th></tr>
          </thead>
          <tbody>
            {cells.map((c) => (
              <tr key={c.client_id}>
                <td>{c.name}</td>
                <td>{formatINR(c.revenue)}</td>
                <td>{formatPercent(total > 0 ? (c.revenue / total) * 100 : 0, 1)}</td>
                <td>{c.delta_pct == null ? "new" : formatPercent(c.delta_pct, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
