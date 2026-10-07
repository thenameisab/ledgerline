/**
 * Revenue roundup email (daily / weekly / monthly). Pure function — subject +
 * HTML + plaintext, no sending. Same table-based layout and hex palette as
 * invite-email.ts; every style is inline (email clients strip <style>), charts
 * are table-cell bars (no images to block), and account logos come from
 * logo.dev's public CDN (many email clients strip data: URIs, so the stored base64 logos
 * are unusable here).
 */

import type {
  RoundupData,
  RoundupAccount,
  RoundupMover,
  ConcentrationSegment,
  QuadrantAccount,
} from "../roundup";
import type { RoundupKind } from "../repos/settings";
import { formatMoney, formatNumber, formatPrice } from "../format";

// The design tokens as literal hex. Email clients have no CSS custom
// properties, so this is a hand-kept mirror of src/styles/design-tokens.css —
// move it whenever the tokens move. Light-only: an email is a light artifact,
// and the dark-mode pairs never apply here.
export const EMAIL_COLORS = {
  bg: "#f7f7f7",
  card: "#ffffff",
  ink: "#050505",
  muted: "#292f32",
  faint: "#616d75",
  border: "#dee1e3",
  track: "#eff0f1",
  accent: "#1364f1",
  good: "#008f47",
  goodBg: "#e5f5ed",
  bad: "#d01e11",
  badBg: "#fbeae8",
};

// Segment colors for the concentration bar. Azure-led, stepping down the ramp,
// then handing off to the emerald from the AI accent family before ending in a
// grey track for the pooled "others" slice.
const SEG_COLORS = ["#1364f1", "#3b7ff5", "#75aaff", "#a9c8fb", "#01c071", "#d9dee0"];

export const EMAIL_FONT = `-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

// Local short names — the shared exports above are reused by product-update-email.ts.
const C = EMAIL_COLORS;
const FONT = EMAIL_FONT;

const KIND_TITLE: Record<RoundupKind, string> = {
  daily: "Daily roundup",
  weekly: "Weekly roundup",
  monthly: "Monthly roundup",
};

// ── Small pieces ─────────────────────────────────────────────────────────────

export function deltaChip(pct: number | null, compareLabel: string): string {
  if (pct === null) {
    return `<span style="font-family:${FONT};font-size:12px;color:${C.faint};">no comparable data for ${esc(compareLabel)}</span>`;
  }
  const up = pct >= 0;
  const color = up ? C.good : C.bad;
  const bgc = up ? C.goodBg : C.badBg;
  const arrow = up ? "&#9650;" : "&#9660;"; // ▲ ▼
  const val = `${Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:${bgc};font-family:${FONT};font-size:12px;font-weight:600;color:${color};">${arrow}&nbsp;${val}&nbsp;<span style="font-weight:400;color:${color};">vs ${esc(compareLabel)}</span></span>`;
}

export function smallDelta(pct: number | null): string {
  if (pct === null) return `<span style="color:${C.faint};font-size:11px;">new</span>`;
  const up = pct >= 0;
  const arrow = up ? "&#9650;" : "&#9660;";
  const val = `${Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`;
  return `<span style="color:${up ? C.good : C.bad};font-size:11px;font-weight:600;white-space:nowrap;">${arrow}&nbsp;${val}</span>`;
}

/** logo.dev img or a colored-initials block — 28px square, both render in common email clients. */
function accountMark(c: RoundupAccount): string {
  const token = process.env.LOGODEV_PUBLISHABLE_KEY;
  if (c.domain && token) {
    const src = `https://img.logo.dev/${encodeURIComponent(c.domain)}?token=${token}&size=56&format=png`;
    return `<img src="${src}" width="28" height="28" alt="" style="display:block;border-radius:6px;border:1px solid ${C.border};" />`;
  }
  const initials = c.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return `<div style="width:28px;height:28px;border-radius:6px;background-color:${C.track};border:1px solid ${C.border};text-align:center;font-family:${FONT};font-size:11px;font-weight:600;color:${C.muted};line-height:28px;">${esc(initials)}</div>`;
}

/** Horizontal bar chart: one row per bucket, width % of the max. Pure tables. */
function barChart(series: { label: string; revenue: number }[]): string {
  const max = Math.max(...series.map((s) => s.revenue), 1);
  const rows = series
    .map((s) => {
      const pct = Math.max(1.5, (s.revenue / max) * 100);
      return `
        <tr>
          <td style="padding:2px 8px 2px 0;font-family:${FONT};font-size:11px;color:${C.faint};white-space:nowrap;text-align:right;width:64px;">${esc(s.label)}</td>
          <td style="padding:2px 0;width:100%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="${pct.toFixed(1)}%" style="background-color:${C.accent};border-radius:3px;font-size:1px;line-height:8px;height:8px;">&nbsp;</td>
              <td style="font-size:1px;line-height:8px;">&nbsp;</td>
            </tr></table>
          </td>
          <td style="padding:2px 0 2px 8px;font-family:${FONT};font-size:11px;color:${C.muted};white-space:nowrap;text-align:right;width:70px;">${formatMoney(s.revenue, { compact: true })}</td>
        </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function moversColumn(title: string, movers: RoundupMover[], positive: boolean): string {
  if (movers.length === 0) {
    return `<p style="margin:0;font-family:${FONT};font-size:12px;color:${C.faint};">None</p>`;
  }
  return movers
    .map(
      (m) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:3px 0;font-family:${FONT};font-size:12px;color:${C.ink};">${esc(m.name)}</td>
        <td style="padding:3px 0;font-family:${FONT};font-size:12px;font-weight:600;color:${positive ? C.good : C.bad};text-align:right;white-space:nowrap;">${positive ? "+" : "−"}${formatMoney(Math.abs(m.delta), { compact: true })}</td>
      </tr></table>`
    )
    .join("");
}

/** Percentage-point delta chip (for rates), e.g. "▲ 1.2pp". */
export function smallDeltaPoints(pct: number, prev: number | null): string {
  if (prev === null) return "";
  const diff = pct - prev;
  if (Math.abs(diff) < 0.05) return `<span style="color:${C.faint};font-size:11px;">flat</span>`;
  const up = diff >= 0;
  const arrow = up ? "&#9650;" : "&#9660;";
  return `<span style="color:${up ? C.good : C.bad};font-size:11px;font-weight:600;white-space:nowrap;">${arrow}&nbsp;${Math.abs(diff).toFixed(1)}pp</span>`;
}

/** logo.dev mark or initials at an arbitrary square size. */
export function markAt(name: string, domain: string | null, size: number): string {
  const token = process.env.LOGODEV_PUBLISHABLE_KEY;
  const r = Math.round(size / 4);
  if (domain && token) {
    const src = `https://img.logo.dev/${encodeURIComponent(domain)}?token=${token}&size=${size * 2}&format=png`;
    return `<img src="${src}" width="${size}" height="${size}" alt="" style="display:inline-block;vertical-align:middle;border-radius:${r}px;border:1px solid ${C.border};" />`;
  }
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return `<span style="display:inline-block;vertical-align:middle;width:${size}px;height:${size}px;border-radius:${r}px;background-color:${C.track};border:1px solid ${C.border};text-align:center;font-family:${FONT};font-size:${Math.round(size * 0.4)}px;font-weight:600;color:${C.muted};line-height:${size}px;">${esc(initials)}</span>`;
}

/** Stacked horizontal share bar + legend for the top accounts. */
function concentrationBar(segments: ConcentrationSegment[], topShare: number): string {
  if (segments.length === 0) return "";
  const cells = segments
    .map((s, i) => {
      const color = s.isOthers ? SEG_COLORS[SEG_COLORS.length - 1] : SEG_COLORS[i % (SEG_COLORS.length - 1)];
      const w = Math.max(1.5, s.share);
      return `<td width="${w.toFixed(1)}%" style="background-color:${color};font-size:1px;line-height:14px;height:14px;">&nbsp;</td>`;
    })
    .join("");

  const legend = segments
    .map((s, i) => {
      const color = s.isOthers ? SEG_COLORS[SEG_COLORS.length - 1] : SEG_COLORS[i % (SEG_COLORS.length - 1)];
      return `<tr>
        <td style="padding:3px 8px 3px 0;width:12px;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background-color:${color};"></span></td>
        <td style="padding:3px 0;font-family:${FONT};font-size:12px;color:${C.ink};">${esc(s.name)}</td>
        <td style="padding:3px 8px;font-family:${FONT};font-size:12px;color:${C.muted};text-align:right;white-space:nowrap;">${s.share.toFixed(0)}%</td>
        <td style="padding:3px 0;font-family:${FONT};font-size:12px;font-weight:600;color:${C.ink};text-align:right;white-space:nowrap;">${formatMoney(s.revenue, { compact: true })}</td>
      </tr>`;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:4px;overflow:hidden;"><tr>${cells}</tr></table>
    <div style="font-family:${FONT};font-size:11px;color:${C.muted};margin:8px 0 4px 0;">Top account is <span style="font-weight:600;color:${C.ink};">${topShare.toFixed(0)}%</span> of revenue.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${legend}</table>`;
}

/** 2×2 growth quadrant as chip cells: size (→) × growth (↑). */
function quadrantGrid(points: QuadrantAccount[], median: number): string {
  if (points.length === 0) return "";
  const larger = (p: QuadrantAccount) => p.revenue >= median;
  const shrinking = (p: QuadrantAccount) => p.deltaPct !== null && p.deltaPct < 0;

  const bucket = (big: boolean, shrink: boolean) =>
    points.filter((p) => larger(p) === big && shrinking(p) === shrink);

  const chip = (p: QuadrantAccount) => {
    const d =
      p.deltaPct === null
        ? `<span style="color:${C.faint};font-size:10px;">new</span>`
        : `<span style="color:${p.deltaPct >= 0 ? C.good : C.bad};font-size:10px;font-weight:600;">${p.deltaPct >= 0 ? "&#9650;" : "&#9660;"}${Math.abs(p.deltaPct) >= 100 ? Math.round(Math.abs(p.deltaPct)) : Math.abs(p.deltaPct).toFixed(0)}%</span>`;
    return `<div style="padding:2px 0;font-family:${FONT};font-size:12px;color:${C.ink};white-space:nowrap;">${markAt(p.name, p.domain, 16)}&nbsp;${esc(p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name)}&nbsp;${d}</div>`;
  };

  const cell = (big: boolean, shrink: boolean, atRisk: boolean) => {
    const list = bucket(big, shrink);
    const inner = list.length ? list.map(chip).join("") : `<div style="font-family:${FONT};font-size:11px;color:${C.faint};">—</div>`;
    return `<td width="50%" valign="top" style="padding:8px 10px;border:1px solid ${C.border};background-color:${atRisk ? C.badBg : C.bg};vertical-align:top;">${inner}</td>`;
  };

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
      <tr>
        <td style="padding:0 0 4px 0;font-family:${FONT};font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint};">Smaller · growing</td>
        <td style="padding:0 0 4px 0;font-family:${FONT};font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint};">Larger · growing</td>
      </tr>
      <tr>${cell(false, false, false)}${cell(true, false, false)}</tr>
      <tr>
        <td style="padding:6px 0 4px 0;font-family:${FONT};font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint};">Smaller · shrinking</td>
        <td style="padding:6px 0 4px 0;font-family:${FONT};font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:${C.bad};">Larger · shrinking — at risk</td>
      </tr>
      <tr>${cell(false, true, false)}${cell(true, true, true)}</tr>
    </table>`;
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── The email ────────────────────────────────────────────────────────────────

export function buildRoundupEmail(
  data: RoundupData,
  appUrl: string,
  charts?: { concentration: string; quadrant: string } | null
): {
  subject: string;
  html: string;
  text: string;
} {
  const title = KIND_TITLE[data.kind];
  const deltaTxt =
    data.deltaPct === null
      ? ""
      : ` (${data.deltaPct >= 0 ? "▲" : "▼"}${Math.abs(data.deltaPct).toFixed(0)}% vs ${data.compareLabel})`;
  const subject = `${title} — ${formatMoney(data.revenue, { compact: true })} · ${data.periodLabel}${deltaTxt}`;

  const text = [
    `${title} · ${data.periodLabel}`,
    ``,
    `Revenue: ${formatMoney(data.revenue)}${data.deltaPct === null ? "" : ` (${data.deltaPct >= 0 ? "+" : ""}${data.deltaPct.toFixed(1)}% vs ${data.compareLabel})`}${data.prior && data.prior.deltaPct !== null ? ` (${data.prior.deltaPct >= 0 ? "+" : ""}${data.prior.deltaPct.toFixed(1)}% vs ${data.prior.label})` : ""}`,
    `Units: ${formatNumber(data.hits)} · Active accounts: ${data.activeAccounts} · Avg revenue per unit: ${formatPrice(data.avgPerHit)} · Success rate: ${data.successRate.pct.toFixed(0)}%`,
    ...(data.mtd ? [`${data.mtd.label}: ${formatMoney(data.mtd.revenue)}${data.mtd.deltaPct === null ? "" : ` (${data.mtd.deltaPct >= 0 ? "+" : ""}${data.mtd.deltaPct.toFixed(1)}%)`}`] : []),
    `Top account is ${data.concentration.topShare.toFixed(0)}% of revenue.`,
    ``,
    `Top accounts:`,
    ...data.topAccounts.map((c) => `  ${c.name} — ${formatMoney(c.revenue)}`),
    ``,
    `Open Ledgerline: ${appUrl}`,
  ].join("\n");

  const kpiCell = (label: string, value: string, sub = "") => `
    <td width="25%" valign="top" style="padding:10px 12px;border:1px solid ${C.border};border-radius:8px;background-color:${C.bg};">
      <div style="font-family:${FONT};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};">${label}</div>
      <div style="font-family:${FONT};font-size:16px;font-weight:600;color:${C.ink};margin-top:2px;">${value}</div>
      ${sub ? `<div style="margin-top:2px;">${sub}</div>` : ""}
    </td>`;

  const topAccountRows = data.topAccounts
    .map(
      (c) => `
      <tr>
        <td style="padding:6px 10px 6px 0;width:28px;">${accountMark(c)}</td>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${C.ink};">${esc(c.name)}</td>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;font-weight:600;color:${C.ink};text-align:right;white-space:nowrap;">${formatMoney(c.revenue, { compact: true })}</td>
        <td style="padding:6px 0 6px 10px;text-align:right;width:56px;font-family:${FONT};">${smallDelta(c.deltaPct)}</td>
      </tr>`
    )
    .join("");

  const sectionTitle = (label: string) =>
    `<div style="font-family:${FONT};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};padding:22px 0 8px 0;">${label}</div>`;

  // Chart image (matches the Ledgerline dashboard visual) — falls back to the pure
  // HTML table version when no signed URL is available (no CRON_SECRET / dry run).
  const chartImg = (src: string, alt: string) =>
    `<img src="${src}" alt="${esc(alt)}" width="496" style="display:block;width:100%;max-width:496px;height:auto;border:1px solid ${C.border};border-radius:8px;" />`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${C.card};border:1px solid ${C.border};border-radius:16px;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td>
                  <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;color:${C.ink};letter-spacing:-0.01em;">Ledgerline<span style="color:${C.accent};">.</span></div>
                </td>
                <td style="text-align:right;font-family:${FONT};font-size:12px;color:${C.faint};">${title}</td>
              </tr></table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:22px 32px 0 32px;">
              <div style="font-family:${FONT};font-size:13px;color:${C.muted};">${esc(data.periodLabel)}</div>
              <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:40px;font-weight:600;color:${C.ink};letter-spacing:-0.02em;margin-top:4px;">${formatMoney(data.revenue, { compact: true })}</div>
              <div style="margin-top:8px;">${deltaChip(data.deltaPct, data.compareLabel)}${
                data.prior
                  ? `&nbsp;&nbsp;${deltaChip(data.prior.deltaPct, data.prior.label)}`
                  : ""
              }</div>
            </td>
          </tr>

          <!-- KPI strip -->
          <tr>
            <td style="padding:20px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>
                ${kpiCell("Units", formatNumber(data.hits))}
                ${kpiCell("Active accounts", String(data.activeAccounts))}
                ${kpiCell("Avg $ / unit", formatPrice(data.avgPerHit))}
                ${kpiCell("Success rate", `${data.successRate.pct.toFixed(0)}%`, smallDeltaPoints(data.successRate.pct, data.successRate.prevPct))}
              </tr></table>
              ${
                data.mtd
                  ? `<div style="margin-top:10px;font-family:${FONT};font-size:12px;color:${C.muted};">
                       ${esc(data.mtd.label)}: <span style="font-weight:600;color:${C.ink};">${formatMoney(data.mtd.revenue, { compact: true })}</span>
                       &nbsp;${smallDelta(data.mtd.deltaPct)}
                     </div>`
                  : ""
              }
            </td>
          </tr>

          <!-- Revenue bars -->
          <tr>
            <td style="padding:0 32px;">
              ${sectionTitle(data.kind === "monthly" ? "Revenue by week" : "Revenue by day")}
              ${barChart(data.series)}
            </td>
          </tr>

          <!-- Revenue concentration (Ledgerline treemap image, table fallback) -->
          ${
            data.concentration.segments.length > 0
              ? `<tr><td style="padding:0 32px;">
                   <div style="padding-top:22px;">${
                     charts
                       ? chartImg(charts.concentration, "Revenue concentration treemap")
                       : `${sectionTitle("Revenue concentration")}${concentrationBar(data.concentration.segments, data.concentration.topShare)}`
                   }</div>
                 </td></tr>`
              : ""
          }

          <!-- Growth quadrant (Ledgerline scatter image, table fallback) -->
          ${
            data.quadrant.points.length > 0
              ? `<tr><td style="padding:0 32px;">
                   <div style="padding-top:22px;">${
                     charts
                       ? chartImg(charts.quadrant, "Growth quadrant scatter")
                       : `${sectionTitle(`Growth quadrant · vs ${esc(data.compareLabel)}`)}${quadrantGrid(data.quadrant.points, data.quadrant.median)}`
                   }</div>
                 </td></tr>`
              : ""
          }

          <!-- Top accounts -->
          ${
            data.topAccounts.length > 0
              ? `<tr><td style="padding:0 32px;">
                   ${sectionTitle("Top accounts")}
                   <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${topAccountRows}</table>
                 </td></tr>`
              : ""
          }

          <!-- Movers -->
          ${
            data.gainers.length + data.decliners.length > 0
              ? `<tr><td style="padding:0 32px;">
                   ${sectionTitle(`Movers vs ${esc(data.compareLabel)}`)}
                   <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                     <td width="48%" valign="top" style="padding-right:8px;">${moversColumn("Gainers", data.gainers, true)}</td>
                     <td width="4%"></td>
                     <td width="48%" valign="top" style="padding-left:8px;">${moversColumn("Decliners", data.decliners, false)}</td>
                   </tr></table>
                 </td></tr>`
              : ""
          }

          <!-- CTA + footer -->
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="border-radius:8px;background-color:${C.accent};">
                  <a href="${appUrl}" target="_blank" style="display:inline-block;padding:10px 20px;font-family:${FONT};font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:8px;">Open Ledgerline</a>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 28px 32px;">
              <div style="border-top:1px solid ${C.border};padding-top:14px;font-family:${FONT};font-size:11px;color:${C.faint};line-height:1.5;">
                Ledgerline — sent to the ${data.kind} roundup list configured in Admin → Settings.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
