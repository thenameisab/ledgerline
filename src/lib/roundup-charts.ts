// Pure layout math for the roundup chart images (see lib/emails/roundup-chart-image.tsx).
// Kept dependency-free so it can be unit-tested without next/og or a server.

export type TreemapCell = {
  name: string;
  revenue: number;
  deltaPct: number | null;
  domain: string | null;
  isOthers: boolean;
};

export type TreemapRect = TreemapCell & { x: number; y: number; w: number; h: number };

export type ScatterPoint = {
  name: string;
  revenue: number;
  deltaPct: number | null;
  domain: string | null;
};

export type ScatterPlot = {
  width: number;
  height: number;
  plot: { left: number; top: number; w: number; h: number };
  zeroY: number; // pixel y of 0% growth
  medianX: number; // pixel x of the median-revenue divide
  points: (ScatterPoint & { cx: number; cy: number; clampedY: number })[];
  xTicks: { x: number; label: number }[];
  yTicks: { y: number; label: number }[];
};

// ── Squarified treemap (mirrors Recharts' default tiling) ────────────────────

/**
 * Squarify a list of weighted cells into a rectangle. Cells are laid out in the
 * given order (sort desc by revenue before calling for the Ledgerline look).
 */
export function squarify(cells: TreemapCell[], W: number, H: number): TreemapRect[] {
  const total = cells.reduce((s, c) => s + Math.max(c.revenue, 0), 0);
  if (total <= 0 || cells.length === 0) return [];
  const area = W * H;
  // Scale each cell's revenue to a pixel area.
  const items = cells.map((c) => ({ cell: c, area: (Math.max(c.revenue, 0) / total) * area }));

  const out: TreemapRect[] = [];
  let x = 0,
    y = 0,
    w = W,
    h = H;
  let row: typeof items = [];
  let i = 0;

  const shortestSide = () => Math.min(w, h);
  const worst = (r: typeof items, side: number) => {
    const sum = r.reduce((s, it) => s + it.area, 0);
    const max = Math.max(...r.map((it) => it.area));
    const min = Math.min(...r.map((it) => it.area));
    const s2 = side * side;
    const sum2 = sum * sum;
    return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
  };

  const layoutRow = (r: typeof items) => {
    const sum = r.reduce((s, it) => s + it.area, 0);
    const side = shortestSide();
    if (w >= h) {
      // fill a column of width `rw` down the left, top→bottom
      const rw = sum / h;
      let yy = y;
      for (const it of r) {
        const rh = it.area / rw;
        out.push({ ...it.cell, x, y: yy, w: rw, h: rh });
        yy += rh;
      }
      x += rw;
      w -= rw;
    } else {
      // fill a row of height `rh` across the top, left→right
      const rh = sum / w;
      let xx = x;
      for (const it of r) {
        const rww = it.area / rh;
        out.push({ ...it.cell, x: xx, y, w: rww, h: rh });
        xx += rww;
      }
      y += rh;
      h -= rh;
    }
    void side;
  };

  while (i < items.length) {
    const next = items[i];
    const side = shortestSide();
    if (row.length === 0 || worst([...row, next], side) <= worst(row, side)) {
      row.push(next);
      i++;
    } else {
      layoutRow(row);
      row = [];
    }
  }
  if (row.length) layoutRow(row);
  return out;
}

// ── Scatter (revenue log-x × growth y, clamped) ──────────────────────────────

const Y_MIN = -100;
const Y_MAX = 150;

export function scatterLayout(
  points: ScatterPoint[],
  median: number,
  width: number,
  height: number
): ScatterPlot {
  const left = 56,
    top = 8,
    right = 14,
    bottom = 22;
  const plot = { left, top, w: width - left - right, h: height - top - bottom };

  const revs = points.map((p) => p.revenue).filter((v) => v > 0);
  const minRev = revs.length ? Math.min(...revs) : 1;
  const maxRev = revs.length ? Math.max(...revs) : 1;
  const lo = Math.log(minRev / 1.8);
  const hi = Math.log(maxRev * 1.8);
  const span = hi - lo || 1;
  const xOf = (v: number) => plot.left + ((Math.log(Math.max(v, 1)) - lo) / span) * plot.w;
  const yOf = (pct: number) => {
    const c = Math.max(Y_MIN, Math.min(Y_MAX, pct));
    return plot.top + (1 - (c - Y_MIN) / (Y_MAX - Y_MIN)) * plot.h;
  };

  const plotted = points.map((p) => ({
    ...p,
    clampedY: Math.max(Y_MIN, Math.min(Y_MAX, p.deltaPct ?? Y_MAX)),
    cx: xOf(p.revenue),
    cy: yOf(p.deltaPct ?? Y_MAX),
  }));

  const yTickVals = [150, 100, 50, 0, -50, -100];
  return {
    width,
    height,
    plot,
    zeroY: yOf(0),
    medianX: xOf(median),
    points: plotted,
    xTicks: [minRev, Math.sqrt(minRev * maxRev), maxRev].map((v) => ({ x: xOf(v), label: v })),
    yTicks: yTickVals.map((v) => ({ y: yOf(v), label: v })),
  };
}
