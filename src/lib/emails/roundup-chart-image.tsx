/**
 * Server-rendered PNGs of the Ledgerline "Revenue concentration" (logo treemap)
 * and "Growth quadrant" (revenue × growth scatter) visuals, for embedding in
 * the roundup email as <img> (email can't run Recharts; many email clients strip SVG).
 *
 * Rendered with next/og (Satori) — no headless browser. Layout mirrors the
 * dashboard components in components/dashboard/{PortfolioMap,GrowthQuadrant}.
 * Rendered at 2× the email display size for crispness on retina.
 */
import * as React from "react";
import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import type { RoundupData } from "../roundup";
import { squarify, scatterLayout, type TreemapCell } from "../roundup-charts";
import { formatMoney } from "../format";
import type { ChartType } from "../roundup-image";

// Ledgerline palette → hex (Satori has no CSS custom properties).
const P = {
  card: "#ffffff",
  ink: "#050505",
  muted: "#292f32",
  faint: "#616d75",
  border: "#dee1e3",
  sunken: "#eff0f1",
  accent: "#1364f1",
  accentBg: "#e9f1fe",
  accentInk: "#0e54cd",
  goodBg: "#e5f5ed",
  goodInk: "#008f47",
  badBg: "#fbeae8",
  badInk: "#d01e11",
};

// Display size (email) → render at 2×.
const W = 500;
const H_CONC = 300;
const H_QUAD = 300;
const S = 2;

function tint(delta: number | null, isOthers: boolean) {
  if (isOthers) return { fill: P.sunken, ink: P.muted };
  if (delta == null) return { fill: P.accentBg, ink: P.accentInk };
  if (delta >= 1) return { fill: P.goodBg, ink: P.goodInk };
  if (delta <= -1) return { fill: P.badBg, ink: P.badInk };
  return { fill: P.accentBg, ink: P.accentInk };
}

function logoSrc(domain: string | null, size: number): string | null {
  const token = process.env.LOGODEV_PUBLISHABLE_KEY;
  if (!domain || !token) return null;
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${token}&size=${size}&format=png`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

let fontCache: { name: string; data: Buffer; weight: 400 | 600; style: "normal" }[] | null = null;
async function loadFonts() {
  if (fontCache) return fontCache;
  const dir = path.join(process.cwd(), "public", "fonts");
  const [reg, semi] = await Promise.all([
    readFile(path.join(dir, "InterTight-Regular.ttf")),
    readFile(path.join(dir, "InterTight-Semibold.ttf")),
  ]);
  fontCache = [
    { name: "Inter", data: reg, weight: 400, style: "normal" },
    { name: "Inter", data: semi, weight: 600, style: "normal" },
  ];
  return fontCache;
}

// ── Treemap ──────────────────────────────────────────────────────────────────

function treemapCells(data: RoundupData): TreemapCell[] {
  const cells: TreemapCell[] = data.quadrant.points.map((p) => ({
    name: p.name,
    revenue: p.revenue,
    deltaPct: p.deltaPct,
    domain: p.domain,
    isOthers: false,
  }));
  const shown = cells.reduce((s, c) => s + c.revenue, 0);
  const others = Math.max(0, data.revenue - shown);
  if (others > 0) {
    cells.push({ name: "Other accounts", revenue: others, deltaPct: null, domain: null, isOthers: true });
  }
  return cells.sort((a, b) => b.revenue - a.revenue);
}

function ConcentrationImage({ data }: { data: RoundupData }) {
  const headerH = 34 * S;
  const rects = squarify(treemapCells(data), W * S, H_CONC * S - headerH);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: W * S,
        height: H_CONC * S,
        backgroundColor: P.card,
        fontFamily: "Inter",
        padding: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: headerH, paddingLeft: 4 }}>
        <div style={{ display: "flex", fontSize: 15 * S, fontWeight: 600, color: P.ink }}>Revenue concentration</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 * S, fontSize: 10 * S, color: P.muted }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3 * S }}>
            <div style={{ display: "flex", width: 8 * S, height: 8 * S, borderRadius: 2 * S, backgroundColor: P.goodBg }} />
            <div style={{ display: "flex" }}>growing</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 * S }}>
            <div style={{ display: "flex", width: 8 * S, height: 8 * S, borderRadius: 2 * S, backgroundColor: P.badBg }} />
            <div style={{ display: "flex" }}>shrinking</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", width: W * S, height: H_CONC * S - headerH }}>
        {rects.map((r, i) => {
          const { fill, ink } = tint(r.deltaPct, r.isOthers);
          const pad = 6 * S;
          const inset = 2;
          const logoSize = Math.min(26 * S, r.w - 2 * pad, r.h - 26 * S);
          const showLogo = !r.isOthers && r.w >= 60 * S && r.h >= 54 * S && logoSize > 10 * S;
          const showName = r.w >= 78 * S && r.h >= 40 * S;
          const showRev = showName && r.h >= 58 * S;
          const src = showLogo ? logoSrc(r.domain, Math.round(logoSize)) : null;
          const maxChars = Math.floor(r.w / (7 * S));
          const nm = r.name.length > maxChars ? r.name.slice(0, Math.max(1, maxChars - 1)) + "…" : r.name;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                position: "absolute",
                left: r.x + inset,
                top: r.y + inset,
                width: Math.max(0, r.w - 2 * inset),
                height: Math.max(0, r.h - 2 * inset),
                backgroundColor: fill,
                borderRadius: 6 * S,
                padding: pad,
                overflow: "hidden",
              }}
            >
              {showLogo &&
                (src ? (
                  <img
                    src={src}
                    width={logoSize}
                    height={logoSize}
                    style={{ borderRadius: 4 * S, backgroundColor: P.card, border: `1px solid ${P.border}` }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: logoSize,
                      height: logoSize,
                      borderRadius: 4 * S,
                      backgroundColor: P.card,
                      border: `1px solid ${P.border}`,
                      fontSize: logoSize * 0.4,
                      fontWeight: 600,
                      color: P.muted,
                    }}
                  >
                    {initials(r.name)}
                  </div>
                ))}
              {showName && (
                <div style={{ display: "flex", marginTop: showLogo ? 6 * S : 0, fontSize: 11 * S, fontWeight: 600, color: ink }}>
                  {nm}
                </div>
              )}
              {showRev && (
                <div style={{ display: "flex", marginTop: 2 * S, fontSize: 10 * S, color: ink, opacity: 0.85 }}>
                  {formatMoney(r.revenue, { compact: true })}
                  {r.deltaPct != null && !r.isOthers ? `  ${r.deltaPct > 0 ? "+" : ""}${Math.round(r.deltaPct)}%` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Growth quadrant scatter ───────────────────────────────────────────────────

function QuadrantImage({ data }: { data: RoundupData }) {
  const headerH = 40 * S;
  const plotH = H_QUAD * S - headerH;
  const layout = scatterLayout(
    data.quadrant.points.map((p) => ({ name: p.name, revenue: p.revenue, deltaPct: p.deltaPct, domain: p.domain })),
    data.quadrant.median,
    W * S,
    plotH
  );
  const { plot } = layout;
  const dot = 26 * S;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: W * S, height: H_QUAD * S, backgroundColor: P.card, fontFamily: "Inter" }}>
      <div style={{ display: "flex", flexDirection: "column", height: headerH, paddingLeft: 4 }}>
        <div style={{ display: "flex", fontSize: 15 * S, fontWeight: 600, color: P.ink }}>Growth quadrant</div>
        <div style={{ display: "flex", fontSize: 10 * S, color: P.faint, marginTop: 2 * S }}>
          Revenue (→) vs growth (↑) · bottom-right = large accounts losing ground
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", width: W * S, height: plotH }}>
        {/* at-risk shade: right of median, below 0% */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: layout.medianX,
            top: layout.zeroY,
            width: Math.max(0, plot.left + plot.w - layout.medianX),
            height: Math.max(0, plot.top + plot.h - layout.zeroY),
            backgroundColor: P.badBg,
            opacity: 0.5,
          }}
        />
        {/* y gridlines + labels */}
        {layout.yTicks.map((t, i) => (
          <div key={`y${i}`} style={{ display: "flex", position: "absolute", left: plot.left, top: t.y, width: plot.w, height: 1, backgroundColor: t.label === 0 ? P.border : "#eff0f1" }} />
        ))}
        {layout.yTicks.map((t, i) => (
          <div key={`yl${i}`} style={{ display: "flex", position: "absolute", left: 0, top: t.y - 6 * S, width: plot.left - 6 * S, justifyContent: "flex-end", fontSize: 8 * S, color: P.faint }}>
            {`${t.label > 0 ? "+" : ""}${t.label}%`}
          </div>
        ))}
        {/* median divide (dashed approximated by a thin line) */}
        <div style={{ display: "flex", position: "absolute", left: layout.medianX, top: plot.top, width: 1, height: plot.h, backgroundColor: P.border }} />
        {/* x tick labels */}
        {layout.xTicks.map((t, i) => (
          <div key={`xl${i}`} style={{ display: "flex", position: "absolute", left: t.x - 20 * S, top: plot.top + plot.h + 4 * S, width: 40 * S, justifyContent: "center", fontSize: 9 * S, color: P.faint }}>
            {formatMoney(t.label, { compact: true })}
          </div>
        ))}
        {/* points */}
        {layout.points.map((p, i) => {
          const up = (p.deltaPct ?? 0) >= 0;
          const ring = up ? P.goodInk : P.badInk;
          const src = logoSrc(p.domain, dot);
          return (
            <div
              key={`p${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "absolute",
                left: p.cx - dot / 2,
                top: p.cy - dot / 2,
                width: dot,
                height: dot,
                borderRadius: dot,
                backgroundColor: P.card,
                border: `${1.5 * S}px solid ${ring}`,
                overflow: "hidden",
              }}
            >
              {src ? (
                <img src={src} width={dot - 4 * S} height={dot - 4 * S} style={{ borderRadius: dot }} />
              ) : (
                <div style={{ display: "flex", fontSize: 9 * S, fontWeight: 600, color: P.muted }}>{initials(p.name)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export async function renderChartImage(type: ChartType, data: RoundupData): Promise<ImageResponse> {
  const fonts = await loadFonts();
  const width = W * S;
  const height = (type === "concentration" ? H_CONC : H_QUAD) * S;
  const element = type === "concentration" ? <ConcentrationImage data={data} /> : <QuadrantImage data={data} />;
  return new ImageResponse(element, { width, height, fonts });
}
