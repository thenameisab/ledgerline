// Read and act on recorded alerts (/alerts, the Review badge, Settings → Alerts).
// The alerts cron (lib/alerts/run.ts) is the only writer of new alerts.
//
// Views:
//   attention     open, not acknowledged, not snoozed (or the snooze has ended)
//   snoozed       open, not acknowledged, snoozed until a later date
//   acknowledged  open and acknowledged: a tracked condition someone has seen
//                 that has not recovered yet
//   closed        closed in the last 60 days: recovered, acknowledged (once-only
//                 events close when acknowledged) or expired

import getSql from "../db";
import { todayIST, shiftISO } from "./periods";
import {
  ALERT_CONFIG_KEY,
  ALERT_RULES,
  DEFAULT_THRESHOLDS,
  defaultAlertConfig,
  loadAlertConfig,
  thresholdError,
  type AlertConfig,
  type AlertGroup,
  type AlertRule,
  type AlertSeverity,
} from "../alerts/config";

export type AlertView = "attention" | "snoozed" | "acknowledged" | "closed";

export type AlertRow = {
  id: number;
  rule: AlertRule;
  severity: AlertSeverity;
  status: "open" | "closed";
  data_date: string;
  title: string;
  body: string | null;
  client_id: number | null;
  account_name: string | null;
  account_slug: string | null;
  account_has_logo: boolean;
  api_code: string | null;
  vendor: string | null;
  opened_at: string;
  closed_at: string | null;
  closed_data_date: string | null;
  close_reason: "recovered" | "acknowledged" | "expired" | null;
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  snoozed_until: string | null;
  snoozed_by_name: string | null;
};

const CLOSED_DAYS = 60;

function viewCond(sql: any, view: AlertView, today: string) {
  switch (view) {
    case "attention":
      return sql`a.status = 'open' AND a.acknowledged_at IS NULL AND (a.snoozed_until IS NULL OR a.snoozed_until <= ${today})`;
    case "snoozed":
      return sql`a.status = 'open' AND a.acknowledged_at IS NULL AND a.snoozed_until > ${today}`;
    case "acknowledged":
      return sql`a.status = 'open' AND a.acknowledged_at IS NOT NULL`;
    case "closed":
      return sql`a.status = 'closed' AND a.closed_at >= NOW() - make_interval(days => ${CLOSED_DAYS}::int)`;
  }
}

const rulesIn = (group: AlertGroup) =>
  (Object.keys(ALERT_RULES) as AlertRule[]).filter((r) => ALERT_RULES[r].group === group);

export async function listAlerts(opts: {
  view: AlertView;
  severity?: AlertSeverity;
  group?: AlertGroup;
  /** One alert by id, whatever its view (notification deep links). */
  id?: number;
  limit?: number;
}): Promise<AlertRow[]> {
  const sql = getSql();
  const today = todayIST();
  const where = opts.id != null ? sql`a.id = ${opts.id}` : viewCond(sql, opts.view, today);
  const sev = opts.severity && opts.id == null ? sql`AND a.severity = ${opts.severity}` : sql``;
  const grp = opts.group && opts.id == null ? sql`AND a.rule = ANY(${rulesIn(opts.group) as string[]})` : sql``;
  const order =
    opts.view === "attention"
      ? sql`ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                     a.data_date DESC, a.opened_at DESC`
      : opts.view === "closed"
        ? sql`ORDER BY a.closed_at DESC`
        : sql`ORDER BY a.opened_at DESC`;
  const rows = await sql`
    SELECT a.id, a.rule, a.severity, a.status, a.data_date::text AS data_date, a.title, a.body,
           a.client_id, c.display_name AS account_name, c.slug AS account_slug,
           (c.logo_data_url IS NOT NULL) AS account_has_logo,
           a.api_code, a.vendor, a.opened_at::text AS opened_at, a.closed_at::text AS closed_at,
           a.closed_data_date::text AS closed_data_date, a.close_reason,
           a.acknowledged_at::text AS acknowledged_at,
           COALESCE(ua.display_name, ua.email) AS acknowledged_by_name,
           a.snoozed_until::text AS snoozed_until,
           COALESCE(us.display_name, us.email) AS snoozed_by_name
    FROM alerts a
    LEFT JOIN clients c ON c.id = a.client_id
    LEFT JOIN users ua ON ua.id = a.acknowledged_by
    LEFT JOIN users us ON us.id = a.snoozed_by
    WHERE ${where} ${sev} ${grp}
    ${order}
    LIMIT ${opts.limit ?? 200}`;
  return rows.map((r: any) => ({
    ...r,
    id: Number(r.id),
    client_id: r.client_id == null ? null : Number(r.client_id),
    account_has_logo: Boolean(r.account_has_logo),
  })) as AlertRow[];
}

export async function alertViewCounts(): Promise<Record<AlertView, number>> {
  const sql = getSql();
  const today = todayIST();
  const [r] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE ${viewCond(sql, "attention", today)}) AS attention,
      COUNT(*) FILTER (WHERE ${viewCond(sql, "snoozed", today)}) AS snoozed,
      COUNT(*) FILTER (WHERE ${viewCond(sql, "acknowledged", today)}) AS acknowledged,
      COUNT(*) FILTER (WHERE ${viewCond(sql, "closed", today)}) AS closed
    FROM alerts a`;
  return {
    attention: Number(r.attention),
    snoozed: Number(r.snoozed),
    acknowledged: Number(r.acknowledged),
    closed: Number(r.closed),
  };
}

/**
 * Alert counts in one view by severity and rule, with no filters applied. The
 * page derives the severity and group filter counts from these rows.
 */
export async function alertFacetCounts(view: AlertView): Promise<{ severity: AlertSeverity; rule: AlertRule; n: number }[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT a.severity, a.rule, COUNT(*) AS n FROM alerts a
    WHERE ${viewCond(sql, view, todayIST())}
    GROUP BY a.severity, a.rule`;
  return rows.map((r: any) => ({ severity: r.severity, rule: r.rule, n: Number(r.n) }));
}

/** The Review badge: alerts that need attention. */
export async function alertAttentionCount(): Promise<number> {
  const sql = getSql();
  const [r] = await sql`SELECT COUNT(*) AS n FROM alerts a WHERE ${viewCond(sql, "attention", todayIST())}`;
  return Number(r.n);
}

/**
 * Acknowledge an open alert. A once-only event closes (nothing else will close
 * it). A tracked condition stays open until the metric recovers, but leaves
 * "Needs attention".
 */
export async function acknowledgeAlert(id: number, userId: number): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql`SELECT rule FROM alerts WHERE id = ${id} AND status = 'open'`;
  if (!row) return false;
  const once = ALERT_RULES[row.rule as AlertRule]?.kind === "once";
  await sql`
    UPDATE alerts
    SET acknowledged_at = NOW(), acknowledged_by = ${userId},
        status = ${once ? "closed" : "open"},
        closed_at = ${once ? sql`NOW()` : sql`closed_at`},
        close_reason = ${once ? "acknowledged" : null}
    WHERE id = ${id} AND status = 'open'`;
  return true;
}

/** Acknowledge several alerts, such as every alert on one account. Returns how many changed. */
export async function acknowledgeAlerts(ids: number[], userId: number): Promise<number> {
  let n = 0;
  for (const id of ids) if (await acknowledgeAlert(id, userId)) n++;
  return n;
}

export const SNOOZE_DAYS = [1, 3, 7] as const;

export async function snoozeAlert(id: number, userId: number, days: number): Promise<boolean> {
  if (!SNOOZE_DAYS.includes(days as (typeof SNOOZE_DAYS)[number])) return false;
  const sql = getSql();
  const until = shiftISO(todayIST(), days);
  const res = await sql`
    UPDATE alerts SET snoozed_until = ${until}, snoozed_by = ${userId}
    WHERE id = ${id} AND status = 'open' AND acknowledged_at IS NULL`;
  return res.count > 0;
}

/**
 * Move an alert back to "Needs attention": clears a snooze or an
 * acknowledgement. A once-only event closed by acknowledging it reopens.
 */
export async function restoreAlert(id: number): Promise<boolean> {
  const sql = getSql();
  const res = await sql`
    UPDATE alerts
    SET acknowledged_at = NULL, acknowledged_by = NULL, snoozed_until = NULL, snoozed_by = NULL,
        status = CASE WHEN close_reason = 'acknowledged' THEN 'open' ELSE status END,
        closed_at = CASE WHEN close_reason = 'acknowledged' THEN NULL ELSE closed_at END,
        close_reason = CASE WHEN close_reason = 'acknowledged' THEN NULL ELSE close_reason END
    WHERE id = ${id} AND (status = 'open' OR close_reason = 'acknowledged')`;
  return res.count > 0;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getAlertConfig(): Promise<AlertConfig> {
  return loadAlertConfig(getSql());
}

export class AlertConfigError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

/**
 * Save rule switches and thresholds. Only values that differ from the defaults
 * are stored, so a later change to a default reaches every rule nobody tuned.
 * Returns the previous and new stored values for the audit log.
 */
export async function saveAlertConfig(
  input: { enabled: Partial<Record<string, boolean>>; thresholds: Partial<Record<string, number>> },
  actor: string
): Promise<{ before: unknown; after: unknown }> {
  const defaults = defaultAlertConfig();
  const enabled: Record<string, boolean> = {};
  for (const [r, on] of Object.entries(input.enabled)) {
    if (!(r in ALERT_RULES)) throw new AlertConfigError(r, `Unknown rule ${r}.`);
    if (typeof on !== "boolean") throw new AlertConfigError(r, "Must be on or off.");
    if (on !== defaults.enabled[r as AlertRule]) enabled[r] = on;
  }
  const thresholds: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.thresholds)) {
    if (!(k in DEFAULT_THRESHOLDS)) throw new AlertConfigError(k, `Unknown threshold ${k}.`);
    const key = k as keyof typeof DEFAULT_THRESHOLDS;
    const err = thresholdError(key, v as number);
    if (err) throw new AlertConfigError(k, err);
    if (v !== DEFAULT_THRESHOLDS[key]) thresholds[k] = v as number;
  }
  const sql = getSql();
  const [prev] = await sql`SELECT value FROM app_settings WHERE key = ${ALERT_CONFIG_KEY}`;
  const value = JSON.stringify({ enabled, thresholds });
  await sql`
    INSERT INTO app_settings (key, value, updated_by)
    VALUES (${ALERT_CONFIG_KEY}, ${value}, ${actor})
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`;
  return { before: prev ? JSON.parse(prev.value as string) : null, after: { enabled, thresholds } };
}

/** The latest usage date the engine evaluated, and when. Null before the first run. */
export async function lastAlertRun(): Promise<{ data_date: string; finished_at: string } | null> {
  const sql = getSql();
  const [r] = await sql`
    SELECT data_date::text AS data_date, finished_at::text AS finished_at FROM alert_runs
    WHERE status = 'success' ORDER BY data_date DESC LIMIT 1`;
  return r ? { data_date: r.data_date, finished_at: r.finished_at } : null;
}

/**
 * Daily hits (all outcomes) per account for the `days` days that end on `to`,
 * with 0 for days without usage. For the trend line on each account's block.
 */
export async function accountDailyHits(clientIds: number[], to: string, days = 28): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (!clientIds.length) return out;
  const from = shiftISO(to, -(days - 1));
  const dates = Array.from({ length: days }, (_, i) => shiftISO(from, i));
  const index = new Map(dates.map((d, i) => [d, i]));
  for (const c of clientIds) out.set(c, new Array(days).fill(0));
  const sql = getSql();
  const rows = await sql`
    SELECT client_id, date::text AS date,
           SUM(successful + successful_no_data + failed + in_progress) AS h
    FROM usage_daily
    WHERE client_id = ANY(${clientIds}) AND date BETWEEN ${from} AND ${to}
    GROUP BY 1, 2`;
  for (const r of rows as any[]) {
    const i = index.get(r.date);
    if (i != null) out.get(Number(r.client_id))![i] = Number(r.h);
  }
  return out;
}
