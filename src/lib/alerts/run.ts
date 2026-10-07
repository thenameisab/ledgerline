// Runs the alert rules: a dry evaluation over a date range (backtest and
// preview), and the persisted run the cron calls.
//
// When a date is evaluated: only after its usage has synced, and after the 7
// days before it have synced too, because the drop and stop rules read the day
// before and the same weekday a week back. Dates are evaluated once and in
// order; a date that syncs more than 2 days late is not evaluated (F1 has
// already reported it).
//
// Once-only events stay open until someone acknowledges them or until they
// are ONCE_EXPIRY_DAYS usage dates old. Each evaluated date sends one bell
// notification to admins and editors, and each critical alert sends its own.
//
// Alert emails are sent by lib/alerts/email.ts, which the cron route calls
// with this run's summary. This file does not import the email transport, so
// the backtest script can import it outside Next.

import getSql from "../db";
import { formatDate } from "../format";
import { shiftISO, yesterdayIST } from "../repos/periods";
import { ONCE_EXPIRY_DAYS, ONCE_RULES, loadAlertConfig, type AlertConfig } from "./config";
import { loadAlertData, windowStart } from "./data";
import { evaluateDay, type AlertDraft, type AlertState, type DayResult } from "./rules";
import { notifyNewAlerts } from "./notify";

/** Dates evaluated per run: yesterday and the 2 days before it. */
const PENDING_WINDOW = 3;
/** Days before a date that must have synced before the date is evaluated. */
const REQUIRED_HISTORY = 7;

/** Evaluates [from, to] in order from an empty state. Writes nothing. */
export async function evaluateRange(
  from: string,
  to: string,
  cfg?: AlertConfig
): Promise<DayResult[]> {
  const sql = getSql();
  const config = cfg ?? (await loadAlertConfig(sql));
  const data = await loadAlertData(sql, windowStart(from), to);
  const state: AlertState = { open: new Set(), seen: new Set() };
  const coverage = new Map<string, Set<number>>();
  const out: DayResult[] = [];
  for (let i = data.index.get(from)!; i < data.dates.length; i++) out.push(evaluateDay(data, i, config, state, coverage));
  return out;
}

async function coveredDates(from: string, to: string): Promise<Set<string>> {
  const sql = getSql();
  const rows = await sql`
    SELECT DISTINCT target_date::text AS d FROM sync_runs
    WHERE target_date BETWEEN ${from} AND ${to} AND status = 'success' AND COALESCE(rows_inserted, 0) > 0`;
  return new Set(rows.map((r: any) => r.d as string));
}

export type RunSummary = {
  /** `ids` are the alerts this run opened for the date, for the alert emails. */
  evaluated: { date: string; opened: number; closed: number; suppressed: Record<string, number>; ids: number[] }[];
  waiting: string[];
  syncMissing: string | null;
  /** The F1 alert this run opened, if any. */
  f1Id: number | null;
};

/**
 * Evaluates every pending date and records the results. `final` is the last run
 * of the day: if yesterday has still not synced, it raises F1.
 */
export async function runPendingAlerts(opts: { trigger: string; final?: boolean }): Promise<RunSummary> {
  const sql = getSql();
  const yday = yesterdayIST();
  const [{ last }] = await sql`SELECT MAX(data_date)::text AS last FROM alert_runs WHERE status = 'success'`;
  const covered = await coveredDates(shiftISO(yday, -(PENDING_WINDOW - 1 + REQUIRED_HISTORY)), yday);

  const pending: string[] = [];
  const waiting: string[] = [];
  for (let k = PENDING_WINDOW - 1; k >= 0; k--) {
    const d = shiftISO(yday, -k);
    if (last && d <= last) continue;
    let ready = true;
    for (let j = 0; j <= REQUIRED_HISTORY; j++) if (!covered.has(shiftISO(d, -j))) ready = false;
    // Keep date order: once one date waits, every later date waits with it.
    if (!ready || waiting.length) waiting.push(d);
    else pending.push(d);
  }

  const summary: RunSummary = { evaluated: [], waiting, syncMissing: null, f1Id: null };

  if (pending.length) {
    const cfg = await loadAlertConfig(sql);
    const data = await loadAlertData(sql, windowStart(pending[0]), pending[pending.length - 1]);
    const openRows = await sql`SELECT dedupe_key FROM alerts WHERE status = 'open'`;
    const seenRows = await sql`SELECT DISTINCT dedupe_key FROM alerts WHERE rule = ANY(${ONCE_RULES as string[]})`;
    const state: AlertState = {
      open: new Set(openRows.map((r: any) => r.dedupe_key as string)),
      seen: new Set(seenRows.map((r: any) => r.dedupe_key as string)),
    };
    const coverage = new Map<string, Set<number>>();

    for (const d of pending) {
      const claimed = await sql`
        INSERT INTO alert_runs (data_date, status, trigger) VALUES (${d}, 'running', ${opts.trigger})
        ON CONFLICT (data_date) DO UPDATE
          SET status = 'running', trigger = EXCLUDED.trigger, started_at = NOW(), finished_at = NULL, error = NULL
          WHERE alert_runs.status = 'error'
             OR (alert_runs.status = 'running' AND alert_runs.started_at < NOW() - INTERVAL '15 minutes')
        RETURNING data_date`;
      if (!claimed.length) break; // another run has this date
      try {
        const res = evaluateDay(data, data.index.get(d)!, cfg, state, coverage);
        const ids = await persistDay(res, opts.trigger);
        await notifyNewAlerts(d, res.opened.map((a, n) => ({ ...a, id: ids[n] ?? null })));
        summary.evaluated.push({
          date: d,
          opened: res.opened.length,
          closed: res.closed.length,
          suppressed: res.suppressed,
          ids: ids.filter((id): id is number => id != null),
        });
      } catch (e: any) {
        await sql`UPDATE alert_runs SET status = 'error', error = ${String(e?.message ?? e)}, finished_at = NOW() WHERE data_date = ${d}`;
        throw e;
      }
    }
  }

  await sql`
    UPDATE alerts SET status = 'closed', closed_at = NOW(), close_reason = 'expired'
    WHERE status = 'open' AND rule = ANY(${ONCE_RULES as string[]})
      AND data_date <= ${shiftISO(yday, -ONCE_EXPIRY_DAYS)}`;

  if (opts.final && !covered.has(yday)) {
    summary.syncMissing = yday;
    const f1 = await syncMissingDraft(yday);
    const id = await insertOnce(f1);
    if (id != null) await notifyNewAlerts(yday, [{ ...f1, id }]);
    summary.f1Id = id;
  }
  return summary;
}

/** The F1 alert for a usage date that has not synced, with the reason from the latest sync run. */
export async function syncMissingDraft(date: string): Promise<AlertDraft> {
  const sql = getSql();
  const [run] = await sql`
    SELECT status, error, rows_inserted FROM sync_runs WHERE target_date = ${date} ORDER BY started_at DESC LIMIT 1`;
  const reason = !run
    ? "No sync has run for that date yet."
    : run.status === "success" && Number(run.rows_inserted) > 0
      ? "The date has synced since this check." // only in samples: F1 opens only for dates with no rows
      : run.status === "error"
      ? `The latest sync failed: ${run.error ?? "no error message"}.`
      : run.status === "success"
        ? "The latest sync finished but loaded no rows. The date may not be in Metabase yet."
        : `The latest sync has status "${run.status}".`;
  return {
    rule: "F1",
    severity: "critical",
    key: `F1:${date}`,
    dataDate: date,
    clientId: null,
    apiCode: null,
    vendor: null,
    title: `Usage for ${formatDate(date)} has not synced`,
    body: `No usage data had loaded for ${formatDate(date)} by 17:20 IST. ${reason} Alerts for ${formatDate(date)} wait until it loads.`,
    metrics: {},
  };
}

/** Records one evaluated date. Returns the new alert ids, in the order of res.opened (null if skipped). */
async function persistDay(res: DayResult, trigger: string): Promise<(number | null)[]> {
  const sql = getSql();
  const ids: (number | null)[] = [];
  await sql.begin(async (tx: any) => {
    // Closes first, so a condition that closed and reopened on one date can insert.
    if (res.closed.length) {
      await tx`
        UPDATE alerts SET status = 'closed', closed_at = NOW(), closed_data_date = ${res.date}, close_reason = 'recovered'
        WHERE status = 'open' AND dedupe_key = ANY(${res.closed})`;
    }
    for (const a of res.opened) {
      const rows = await tx`
        INSERT INTO alerts (rule, severity, dedupe_key, data_date, client_id, api_code, vendor, title, body, metrics)
        VALUES (${a.rule}, ${a.severity}, ${a.key}, ${a.dataDate},
                ${a.clientId}, ${a.apiCode}, ${a.vendor}, ${a.title}, ${a.body}, ${tx.json(a.metrics)})
        ON CONFLICT (dedupe_key) WHERE status = 'open' DO NOTHING
        RETURNING id`;
      ids.push(rows.length ? Number(rows[0].id) : null);
    }
    await tx`
      UPDATE alert_runs
      SET status = 'success', trigger = ${trigger}, opened = ${res.opened.length}, closed = ${res.closed.length},
          suppressed = ${tx.json(res.suppressed)}, finished_at = NOW()
      WHERE data_date = ${res.date}`;
  });
  return ids;
}

/** Inserts a once-only alert unless its key was ever used. Returns the new id, or null. */
async function insertOnce(a: AlertDraft): Promise<number | null> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO alerts (rule, severity, dedupe_key, data_date, title, body, metrics)
    SELECT ${a.rule}, ${a.severity}, ${a.key}, ${a.dataDate}, ${a.title}, ${a.body}, ${sql.json(a.metrics)}
    WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE dedupe_key = ${a.key})
    RETURNING id`;
  return rows.length ? Number(rows[0].id) : null;
}
