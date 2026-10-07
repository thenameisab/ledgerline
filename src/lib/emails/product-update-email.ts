/**
 * Weekly product update email (API usage). Pure functions: subject + HTML +
 * plaintext, no sending. Same table-based layout, inline styles and palette as
 * roundup-email.ts; charts are table-cell bars so nothing is blocked by image
 * proxies.
 */

import type {
  ProductUpdate,
  UsageUpdate,
  Delta,
} from "../product-update";
import { formatNumber } from "../format";
import {
  EMAIL_COLORS as C,
  EMAIL_FONT as FONT,
  deltaChip,
  smallDelta,
  smallDeltaPoints,
  markAt,
  esc,
} from "./roundup-email";

// ── Shared pieces ────────────────────────────────────────────────────────────

const sectionTitle = (label: string) =>
  `<div style="font-family:${FONT};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};padding:22px 0 8px 0;">${label}</div>`;

const kpiCell = (label: string, value: string, sub = "") => `
  <td width="25%" valign="top" style="padding:10px 12px;border:1px solid ${C.border};border-radius:8px;background-color:${C.bg};">
    <div style="font-family:${FONT};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};">${label}</div>
    <div style="font-family:${FONT};font-size:16px;font-weight:600;color:${C.ink};margin-top:2px;">${value}</div>
    ${sub ? `<div style="margin-top:2px;">${sub}</div>` : ""}
  </td>`;

const muted = (s: string) => `<p style="margin:0;font-family:${FONT};font-size:12px;color:${C.faint};">${s}</p>`;

/** Horizontal bars: one row per bucket, width % of the max. */
function hbars(rows: { label: string; value: number; right?: string }[], color = C.accent): string {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows
    .map((r) => {
      const w = Math.max(1, Math.round((r.value / max) * 100));
      return `<tr>
        <td style="padding:2px 8px 2px 0;font-family:${FONT};font-size:11px;color:${C.faint};white-space:nowrap;text-align:right;width:84px;">${esc(r.label)}</td>
        <td style="padding:2px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="${w}%" style="background-color:${color};border-radius:3px;font-size:1px;line-height:12px;height:12px;">&nbsp;</td>
            <td style="font-size:1px;line-height:12px;">&nbsp;</td>
          </tr></table>
        </td>
        <td style="padding:2px 0 2px 8px;font-family:${FONT};font-size:11px;color:${C.ink};white-space:nowrap;text-align:right;width:90px;">${r.right ?? formatNumber(r.value)}</td>
      </tr>`;
    })
    .join("")}</table>`;
}

/** Stacked share bar with a legend. */
function stackedBar(segments: { name: string; value: number; color: string }[]): string {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return muted("No traffic");
  const cells = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const w = Math.max(1.5, (s.value / total) * 100);
      return `<td width="${w.toFixed(1)}%" style="background-color:${s.color};font-size:1px;line-height:14px;height:14px;">&nbsp;</td>`;
    })
    .join("");
  const legend = segments
    .filter((s) => s.value > 0)
    .map(
      (s) => `<td style="padding:8px 14px 0 0;font-family:${FONT};font-size:11px;color:${C.muted};white-space:nowrap;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background-color:${s.color};vertical-align:middle;margin-right:5px;"></span>${esc(s.name)} <span style="color:${C.ink};font-weight:600;">${((s.value / total) * 100).toFixed(0)}%</span> <span style="color:${C.faint};">· ${formatNumber(s.value)}</span>
      </td>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:4px;overflow:hidden;"><tr>${cells}</tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>${legend}</tr></table>`;
}

function chip(text: string, tone: "good" | "bad" | "neutral"): string {
  const color = tone === "good" ? C.good : tone === "bad" ? C.bad : C.muted;
  const bgc = tone === "good" ? C.goodBg : tone === "bad" ? C.badBg : C.track;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:${bgc};font-family:${FONT};font-size:12px;font-weight:600;color:${color};">${text}</span>`;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function pctText(d: Delta): string {
  if (d.pct === null) return "";
  return ` (${d.pct >= 0 ? "+" : ""}${d.pct.toFixed(1)}% vs prior week)`;
}

function shell(o: {
  subject: string;
  title: string;
  periodLabel: string;
  hero: string;
  body: string;
  cta: { label: string; href: string };
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(o.subject)}</title>
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
                <td style="text-align:right;font-family:${FONT};font-size:12px;color:${C.faint};">${esc(o.title)}</td>
              </tr></table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:22px 32px 0 32px;">
              <div style="font-family:${FONT};font-size:13px;color:${C.muted};">${esc(o.periodLabel)}</div>
              ${o.hero}
            </td>
          </tr>

          <tr><td style="padding:0 32px;">${o.body}</td></tr>

          <!-- CTA + footer -->
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="border-radius:8px;background-color:${C.accent};">
                  <a href="${o.cta.href}" target="_blank" style="display:inline-block;padding:10px 20px;font-family:${FONT};font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(o.cta.label)}</a>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 28px 32px;">
              <div style="border-top:1px solid ${C.border};padding-top:14px;font-family:${FONT};font-size:11px;color:${C.faint};line-height:1.5;">
                ${o.footer}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Usage update ──────────────────────────────────────────────────────────────

const CHANNEL_COLORS = ["#1364f1", "#75aaff", "#01c071", "#d9dee0"];

export function buildUsageUpdateEmail(
  data: UsageUpdate,
  appUrl: string
): { subject: string; html: string; text: string } {
  const title = "Weekly usage update";
  const deltaTxt =
    data.hits.pct === null
      ? ""
      : ` (${data.hits.pct >= 0 ? "▲" : "▼"}${Math.abs(data.hits.pct).toFixed(0)}% vs prior week)`;
  const subject = `${title} — ${formatNumber(data.hits.value)} hits · ${data.week.label}${deltaTxt}`;

  const text = [
    `${title} · ${data.week.label}`,
    ``,
    `Hits: ${formatNumber(data.hits.value)}${pctText(data.hits)}`,
    `Success rate: ${data.successRate.pct.toFixed(1)}% · Active accounts: ${data.activeAccounts.value} · APIs used: ${data.apisUsed.value}`,
    ...(data.missingDays.length
      ? [``, `Warning: ${data.missingDays.length} day(s) in this week have no synced usage: ${data.missingDays.join(", ")}.`]
      : []),
    ``,
    `Channels:`,
    ...data.channels.map((c) => `  ${c.name} — ${formatNumber(c.hits)} (${c.share.toFixed(0)}%)`),
    ``,
    `Top APIs by volume:`,
    ...data.topApis.map((a) => `  ${a.name} — ${formatNumber(a.hits)} hits · ${a.accounts} accounts`),
    ``,
    `Top accounts by volume:`,
    ...data.topAccounts.map((c) => `  ${c.name} — ${formatNumber(c.hits)} hits`),
    ...(data.newAccounts.length ? [``, `Newly active: ${data.newAccounts.map((c) => c.name).join(", ")}`] : []),
    ...(data.quietAccounts.length ? [``, `Went quiet: ${data.quietAccounts.map((c) => c.name).join(", ")}`] : []),
    ``,
    `Data quality: ${data.dataQuality.unmappedAccounts} unmapped accounts · ${data.dataQuality.unmappedApis} unmapped APIs · ${data.dataQuality.unpricedPairs} unpriced pairs`,
    ``,
    `Open Ledgerline: ${appUrl}`,
  ].join("\n");

  const o = data.outcomes;
  const outcomeTotal = o.successful + o.successful_no_data + o.failed + o.in_progress;

  const hero = `
    <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:40px;font-weight:600;color:${C.ink};letter-spacing:-0.02em;margin-top:4px;">${formatNumber(data.hits.value)}<span style="font-family:${FONT};font-size:14px;font-weight:500;color:${C.muted};letter-spacing:0;"> &nbsp;hits</span></div>
    <div style="margin-top:8px;">${deltaChip(data.hits.pct, data.week.priorLabel)}</div>
    ${
      data.missingDays.length
        ? `<div style="margin-top:12px;padding:10px 12px;border-radius:8px;background-color:${C.badBg};font-family:${FONT};font-size:12px;color:${C.bad};line-height:1.5;">
             <strong>${data.missingDays.length} day${data.missingDays.length === 1 ? "" : "s"} not synced</strong> (${data.missingDays.map(esc).join(", ")}) — the numbers below undercount. <a href="${appUrl}/admin/sync" style="color:${C.bad};">Open Usage sync</a>.
           </div>`
        : ""
    }`;

  const apiRows = data.topApis.length
    ? data.topApis
        .map(
          (a) => `
      <tr>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${C.ink};">${esc(a.name)}<div style="font-size:11px;color:${C.faint};">${esc(a.code)} · ${a.accounts} account${a.accounts === 1 ? "" : "s"}</div></td>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;font-weight:600;color:${C.ink};text-align:right;white-space:nowrap;">${formatNumber(a.hits)}</td>
        <td style="padding:6px 0 6px 10px;text-align:right;width:56px;font-family:${FONT};">${smallDelta(a.pct)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td>${muted("No API traffic this week")}</td></tr>`;

  const accountRows = data.topAccounts.length
    ? data.topAccounts
        .map(
          (c) => `
      <tr>
        <td style="padding:6px 10px 6px 0;width:28px;">${markAt(c.name, c.domain, 28)}</td>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${C.ink};">${
          c.slug ? `<a href="${appUrl}/accounts/${encodeURIComponent(c.slug)}" style="color:${C.ink};text-decoration:none;">${esc(c.name)}</a>` : esc(c.name)
        }</td>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;font-weight:600;color:${C.ink};text-align:right;white-space:nowrap;">${formatNumber(c.hits)}</td>
        <td style="padding:6px 0 6px 10px;text-align:right;width:56px;font-family:${FONT};">${smallDelta(c.pct)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td>${muted("No account traffic this week")}</td></tr>`;

  const listCol = (rows: { name: string; n: number }[], suffix: string, tone: "good" | "bad") =>
    rows.length
      ? rows
          .map(
            (r) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="padding:3px 0;font-family:${FONT};font-size:12px;color:${C.ink};">${esc(r.name)}</td>
              <td style="padding:3px 0;font-family:${FONT};font-size:12px;font-weight:600;color:${tone === "good" ? C.good : C.bad};text-align:right;white-space:nowrap;">${formatNumber(r.n)}${suffix}</td>
            </tr></table>`
          )
          .join("")
      : muted("None");

  const dq = data.dataQuality;
  const dqTone = (n: number) => (n > 0 ? "bad" : "good");

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin-top:14px;"><tr>
      ${kpiCell("Success rate", `${data.successRate.pct.toFixed(1)}%`, smallDeltaPoints(data.successRate.pct, data.successRate.prevPct))}
      ${kpiCell("Active accounts", String(data.activeAccounts.value), smallDelta(data.activeAccounts.pct))}
      ${kpiCell("APIs used", String(data.apisUsed.value), smallDelta(data.apisUsed.pct))}
      ${kpiCell("Failed", formatNumber(o.failed), `<span style="font-family:${FONT};font-size:11px;color:${C.faint};">${outcomeTotal > 0 ? ((o.failed / outcomeTotal) * 100).toFixed(1) : "0"}% of hits</span>`)}
    </tr></table>

    ${sectionTitle("Hits by day")}
    ${hbars(data.daily.map((d) => ({ label: d.label, value: d.hits })))}

    ${sectionTitle("Outcomes")}
    ${stackedBar([
      { name: "Successful", value: o.successful, color: C.good },
      { name: "No data", value: o.successful_no_data, color: "#a9c8fb" },
      { name: "In progress", value: o.in_progress, color: "#01c071" },
      { name: "Failed", value: o.failed, color: C.bad },
    ])}

    ${sectionTitle("Channels")}
    ${stackedBar(data.channels.map((c, i) => ({ name: c.name, value: c.hits, color: CHANNEL_COLORS[i % CHANNEL_COLORS.length] })))}

    ${sectionTitle("Top APIs by volume")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${apiRows}</table>

    ${sectionTitle("Top accounts by volume")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${accountRows}</table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="48%" valign="top">
        ${sectionTitle("Newly active")}
        ${listCol(data.newAccounts.map((c) => ({ name: c.name, n: c.hits })), " hits", "good")}
      </td>
      <td width="4%"></td>
      <td width="48%" valign="top">
        ${sectionTitle("Went quiet")}
        ${listCol(data.quietAccounts.map((c) => ({ name: c.name, n: c.prevHits })), " last wk", "bad")}
      </td>
    </tr></table>

    ${sectionTitle("Data quality this week")}
    <div>
      ${chip(`${dq.unmappedAccounts} unmapped account${dq.unmappedAccounts === 1 ? "" : "s"}`, dqTone(dq.unmappedAccounts))}&nbsp;
      ${chip(`${dq.unmappedApis} unmapped API${dq.unmappedApis === 1 ? "" : "s"}`, dqTone(dq.unmappedApis))}&nbsp;
      ${chip(`${dq.unpricedPairs} unpriced pair${dq.unpricedPairs === 1 ? "" : "s"}`, dqTone(dq.unpricedPairs))}
    </div>
    <div style="margin-top:8px;font-family:${FONT};font-size:11px;color:${C.faint};">Unmapped rows are excluded from every number above until resolved in <a href="${appUrl}/admin/sku-review" style="color:${C.accent};">API review</a> and <a href="${appUrl}/admin/aliases" style="color:${C.accent};">Aliases</a>.</div>`;

  const html = shell({
    subject,
    title,
    periodLabel: data.week.label,
    hero,
    body,
    cta: { label: "Open APIs", href: `${appUrl}/apis` },
    footer: "Ledgerline — sent to the product update list configured in Admin → Settings. Usage only; revenue is in the roundups.",
  });

  return { subject, html, text };
}

export function buildProductUpdateEmail(data: ProductUpdate, appUrl: string) {
  return buildUsageUpdateEmail(data, appUrl);
}
