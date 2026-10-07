/**
 * Usage alert emails. Pure functions: subject + HTML + plain text, no sending.
 *
 *   buildDailyAlertEmail     the alerts opened for one usage date, for the
 *                            groups one recipient is on, sorted critical → info.
 *   buildCriticalAlertEmail  one critical alert, sent when it opens.
 *
 * Same table layout, inline styles and palette as roundup-email.ts. Many email
 * clients strip SVG and data: URIs, so the emails use tables and text only.
 */

import {
  ALERT_GROUPS,
  ALERT_RULES,
  type AlertGroup,
  type AlertRule,
  type AlertSeverity,
} from "../alerts/config";
import { formatDate, formatDateLong, formatDateTime } from "../format";
import { EMAIL_COLORS as C, EMAIL_FONT as FONT, esc } from "./roundup-email";

export type AlertEmailItem = {
  /** null for a sample alert that is not saved (tests and previews only). */
  id: number | null;
  rule: AlertRule;
  severity: AlertSeverity;
  dataDate: string;
  title: string;
  body: string | null;
  accountName: string | null;
  apiCode: string | null;
  vendor: string | null;
  /** When the instant email for this alert was sent. Only critical alerts have one. */
  emailedAt: string | null;
};

type Built = { subject: string; html: string; text: string };

const SEVERITY_ORDER: AlertSeverity[] = ["critical", "high", "medium", "info"];

const SEVERITY_STYLE: Record<AlertSeverity, { label: string; fg: string; bg: string }> = {
  critical: { label: "Critical", fg: C.bad, bg: C.badBg },
  high: { label: "High", fg: "#9a5b0a", bg: "#fdf0dc" },
  medium: { label: "Medium", fg: C.muted, bg: C.track },
  info: { label: "Info", fg: "#1d5f8a", bg: "#e6f0f7" },
};

const groupLabel = (g: AlertGroup) => ALERT_GROUPS.find((x) => x.id === g)?.label ?? g;
const alertUrl = (appUrl: string, a: AlertEmailItem) => (a.id != null ? `${appUrl}/alerts?id=${a.id}` : `${appUrl}/alerts`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Sorts critical → info, then by group order, then by id. */
export function sortAlerts(alerts: AlertEmailItem[]): AlertEmailItem[] {
  const groupIdx = (a: AlertEmailItem) => ALERT_GROUPS.findIndex((g) => g.id === ALERT_RULES[a.rule].group);
  return [...alerts].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      groupIdx(a) - groupIdx(b) ||
      (a.id ?? 0) - (b.id ?? 0)
  );
}

function pill(sev: AlertSeverity): string {
  const s = SEVERITY_STYLE[sev];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background-color:${s.bg};font-family:${FONT};font-size:11px;font-weight:600;color:${s.fg};">${s.label}</span>`;
}

/** "B1 · Failures · Acme · KY1002" */
function metaLine(a: AlertEmailItem): string {
  return [a.rule, groupLabel(ALERT_RULES[a.rule].group), a.accountName, a.apiCode, a.vendor].filter(Boolean).join(" · ");
}

function button(href: string, label: string, primary = true): string {
  const bg = primary ? C.accent : C.card;
  const fg = primary ? "#ffffff" : C.accent;
  const border = primary ? C.accent : C.border;
  return `<td style="border-radius:8px;background-color:${bg};border:1px solid ${border};">
    <a href="${href}" target="_blank" style="display:inline-block;padding:10px 20px;font-family:${FONT};font-size:14px;font-weight:500;color:${fg};text-decoration:none;border-radius:8px;">${esc(label)}</a>
  </td>`;
}

function shell(subject: string, headerRight: string, inner: string, footer: string): string {
  return `<!DOCTYPE html>
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
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td>
                  <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;color:${C.ink};letter-spacing:-0.01em;">Ledgerline<span style="color:${C.accent};">.</span></div>
                </td>
                <td style="text-align:right;font-family:${FONT};font-size:12px;color:${C.faint};">${esc(headerRight)}</td>
              </tr></table>
            </td>
          </tr>
          ${inner}
          <tr>
            <td style="padding:22px 32px 28px 32px;">
              <div style="border-top:1px solid ${C.border};padding-top:14px;font-family:${FONT};font-size:11px;color:${C.faint};line-height:1.5;">
                ${footer}
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

// ── Daily email ──────────────────────────────────────────────────────────────

function dailyRow(a: AlertEmailItem, appUrl: string): string {
  const sent = a.emailedAt
    ? `<div style="margin-top:4px;font-family:${FONT};font-size:11px;color:${C.bad};">Already emailed on its own at ${esc(formatDateTime(a.emailedAt))}</div>`
    : "";
  return `<tr><td style="padding:12px 0;border-top:1px solid ${C.border};">
    <div>${pill(a.severity)}</div>
    <div style="margin-top:6px;font-family:${FONT};font-size:14px;font-weight:600;line-height:1.4;">
      <a href="${alertUrl(appUrl, a)}" target="_blank" style="color:${C.ink};text-decoration:none;">${esc(a.title)}</a>
    </div>
    ${a.body ? `<div style="margin-top:3px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(a.body)}</div>` : ""}
    <div style="margin-top:4px;font-family:${FONT};font-size:11px;color:${C.faint};">${esc(metaLine(a))} · <a href="${alertUrl(appUrl, a)}" target="_blank" style="color:${C.accent};text-decoration:none;">Open alert</a></div>
    ${sent}
  </td></tr>`;
}

/**
 * The daily email for one recipient. `alerts` holds only the alerts for the
 * groups in `groups`; the caller does not send an email when it is empty.
 */
export function buildDailyAlertEmail(input: {
  date: string;
  alerts: AlertEmailItem[];
  groups: AlertGroup[];
  appUrl: string;
  test?: boolean;
}): Built {
  const { date, groups, appUrl } = input;
  const alerts = sortAlerts(input.alerts);
  const counts = SEVERITY_ORDER.map((s) => [s, alerts.filter((a) => a.severity === s).length] as const).filter(([, n]) => n > 0);
  const countText = counts.map(([s, n]) => `${n} ${s}`).join(", ");
  const nCritical = alerts.filter((a) => a.severity === "critical").length;

  const subject =
    `${input.test ? "[Test] " : ""}Ledgerline alerts for ${formatDate(date)}: ${plural(alerts.length, "new alert")}` +
    (nCritical ? `, ${nCritical} critical` : "");
  const groupNames = groups.map(groupLabel).join(", ");
  const footer =
    `Ledgerline. You receive this email because you are on the alert list for: ${esc(groupNames)}. ` +
    `Admins change the lists in Settings → Alerts.` +
    (input.test ? ` This is a test sent from Settings → Alerts.` : "");

  const inner = `
    <tr>
      <td style="padding:22px 32px 0 32px;">
        <div style="font-family:${FONT};font-size:13px;color:${C.muted};">Usage date ${esc(formatDateLong(date))}</div>
        <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:28px;font-weight:600;color:${C.ink};letter-spacing:-0.01em;margin-top:4px;">${esc(plural(alerts.length, "new alert"))}</div>
        <div style="margin-top:6px;font-family:${FONT};font-size:13px;color:${C.muted};">${esc(countText)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${alerts.map((a) => dailyRow(a, appUrl)).join("")}</table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>${button(`${appUrl}/alerts`, "Open all alerts")}</tr></table>
      </td>
    </tr>`;

  const text = [
    `Ledgerline alerts for ${formatDateLong(date)}: ${plural(alerts.length, "new alert")} (${countText})`,
    ``,
    ...alerts.flatMap((a) => [
      `[${SEVERITY_STYLE[a.severity].label}] ${a.title}`,
      ...(a.body ? [`  ${a.body}`] : []),
      `  ${metaLine(a)}`,
      ...(a.emailedAt ? [`  Already emailed on its own at ${formatDateTime(a.emailedAt)}`] : []),
      `  ${alertUrl(appUrl, a)}`,
      ``,
    ]),
    `All alerts: ${appUrl}/alerts`,
    ``,
    `You receive this email because you are on the alert list for: ${groupNames}.`,
  ].join("\n");

  return { subject, html: shell(subject, "Daily alerts", inner, footer), text };
}

// ── Instant critical email ───────────────────────────────────────────────────

export function buildCriticalAlertEmail(input: { alert: AlertEmailItem; appUrl: string; test?: boolean }): Built {
  const { alert: a, appUrl } = input;
  const group = ALERT_RULES[a.rule].group;
  const subject = `${input.test ? "[Test] " : ""}Critical Ledgerline alert: ${a.title}`;
  // F1 means the sync did not load, so the sync page is where to act.
  const syncLink = a.rule === "F1" ? button(`${appUrl}/admin/sync`, "Open Usage sync", false) : "";

  const inner = `
    <tr>
      <td style="padding:22px 32px 0 32px;">
        <div>${pill("critical")}</div>
        <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;font-weight:600;color:${C.ink};letter-spacing:-0.01em;line-height:1.3;margin-top:10px;">${esc(a.title)}</div>
        ${a.body ? `<p style="margin:10px 0 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.muted};">${esc(a.body)}</p>` : ""}
        <div style="margin-top:10px;font-family:${FONT};font-size:12px;color:${C.faint};">${esc(metaLine(a))} · usage date ${esc(formatDateLong(a.dataDate))}</div>
        <div style="margin-top:4px;font-family:${FONT};font-size:12px;color:${C.faint};">${esc(ALERT_RULES[a.rule].desc)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          ${button(alertUrl(appUrl, a), "Open alert")}
          ${syncLink ? `<td width="8"></td>${syncLink}` : ""}
        </tr></table>
      </td>
    </tr>`;

  const footer =
    `Ledgerline. Critical alerts are emailed when they open, to the alert list for ${esc(groupLabel(group))}. ` +
    `The daily alert email lists this alert again and marks it as already emailed.` +
    (input.test ? ` This is a test sent from Settings → Alerts.` : "");

  const text = [
    `Critical Ledgerline alert: ${a.title}`,
    ``,
    ...(a.body ? [a.body, ``] : []),
    `${metaLine(a)} · usage date ${formatDateLong(a.dataDate)}`,
    ``,
    `Open the alert: ${alertUrl(appUrl, a)}`,
    ...(a.rule === "F1" ? [`Usage sync: ${appUrl}/admin/sync`] : []),
    ``,
    `You receive this email because you are on the alert list for ${groupLabel(group)}.`,
  ].join("\n");

  return { subject, html: shell(subject, "Critical alert", inner, footer), text };
}
