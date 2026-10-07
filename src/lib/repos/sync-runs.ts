// Read side of the Metabase sync run log: /admin/sync history, the cron's
// gap self-heal, and the dashboard freshness line. Writes happen in
// lib/usage-sync.ts, the only writer.

import getSql from "../db";

// Daily usage data starts here; nothing before this is a real gap. Shared by
// the cron self-heal and the admin gap banner so the two can never disagree.
// Portfolio build: the seed generates usage from the 1st of the month two
// months back, so the epoch is computed to match — the demo stays evergreen
// (no "missing days" wall as real time moves past a fixed date).
export const SYNC_EPOCH = (() => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const d = new Date(today + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - 2, 1);
  return d.toISOString().slice(0, 10);
})();

export type SyncRun = {
  id: number;
  trigger: "cron" | "manual" | "backfill";
  target_date: string;
  status: "running" | "success" | "error";
  rows_fetched: number | null;
  rows_inserted: number | null;
  rows_deleted: number | null;
  unmapped_clients: number | null;
  unmapped_apis: number | null;
  total_hits: number | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export async function listSyncRuns(limit = 60): Promise<SyncRun[]> {
  const sql = getSql();
  return sql`
    SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ${limit}
  ` as unknown as Promise<SyncRun[]>;
}

export async function latestSuccessfulRun(): Promise<SyncRun | null> {
  const sql = getSql();
  const [row] = await sql`
    SELECT * FROM sync_runs WHERE status = 'success'
    ORDER BY target_date DESC, finished_at DESC LIMIT 1`;
  return (row as unknown as SyncRun) ?? null;
}

/**
 * Dates in [from, to] not yet covered by a real sync — the cron re-pulls these.
 *
 * "Covered" means a successful run that ACTUALLY LANDED DATA (rows_inserted > 0),
 * not merely a run that returned HTTP 200. Metabase routinely answers a
 * single-date query with only the "ALL CLIENTS TOTAL" checksum row while that
 * day's usage is still settling upstream — that pull succeeds but inserts zero
 * rows. Keying "covered" off status alone would treat such an empty pull as
 * done, so the date would never be re-pulled once it left the trailing resync
 * window. Requiring rows_inserted > 0 makes an empty day stay on the heal list until data actually arrives, then
 * self-stops. A day with zero traffic across every account is not expected;
 * if one occurs, re-pulling it costs a single query.
 */
export async function missingSyncDates(opts: {
  from: string;
  to: string;
  cap: number;
}): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT d::date::text AS date
    FROM generate_series(${opts.from}::date, ${opts.to}::date, '1 day') AS d
    WHERE NOT EXISTS (
      SELECT 1 FROM sync_runs r
      WHERE r.target_date = d::date AND r.status = 'success'
        AND COALESCE(r.rows_inserted, 0) > 0
    )
    ORDER BY d
    LIMIT ${opts.cap}`;
  return rows.map((r: any) => r.date as string);
}

/**
 * Whether a single date has landed data — same "covered" definition as
 * missingSyncDates (a successful run with rows_inserted > 0). The daily roundup
 * gates on this: no point emailing a revenue digest for a day whose usage never
 * synced.
 */
/** The most recent sync run for a date (any status), or null if never attempted. */
export async function latestRunForDate(date: string): Promise<SyncRun | null> {
  const sql = getSql();
  const [row] = await sql`
    SELECT * FROM sync_runs WHERE target_date = ${date}::date
    ORDER BY started_at DESC LIMIT 1`;
  return (row as unknown as SyncRun) ?? null;
}

export async function isDateCovered(date: string): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql`
    SELECT 1 AS ok FROM sync_runs r
    WHERE r.target_date = ${date}::date AND r.status = 'success'
      AND COALESCE(r.rows_inserted, 0) > 0
    LIMIT 1`;
  return !!row;
}

/**
 * All uncovered dates from SYNC_EPOCH through `to` (inclusive) — the gap set the
 * admin banner flags. Same definition of "covered" as missingSyncDates; no cap,
 * because the point is to show the operator the true, complete gap.
 */
export async function usageGapDates(to: string): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT d::date::text AS date
    FROM generate_series(${SYNC_EPOCH}::date, ${to}::date, '1 day') AS d
    WHERE NOT EXISTS (
      SELECT 1 FROM sync_runs r
      WHERE r.target_date = d::date AND r.status = 'success'
        AND COALESCE(r.rows_inserted, 0) > 0
    )
    ORDER BY d`;
  return rows.map((r: any) => r.date as string);
}
