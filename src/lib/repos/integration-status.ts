// Read model for the Usage Sync status page: one health row per integration
// the dashboard depends on (Metabase pull, the cron that drives it, the
// database, monthly imports, outbound email). Everything is derived from
// existing data + live checks — there is no separate status table to keep in
// sync, which means this can never itself go stale.

import getSql from "../db";
import { SYNC_EPOCH } from "./sync-runs";
import type { SyncRun } from "./sync-runs";

// A cron run older than this means the morning pull silently failed to fire.
const CRON_STALE_MS = 25 * 60 * 60 * 1000;
// A 'running' row older than this was killed mid-flight by the platform timeout.
const STALL_MS = 30 * 60 * 1000;

export type IntegrationHealth = "operational" | "degraded" | "down" | "not_configured";

export type Integration = {
  key: string;
  name: string;
  health: IntegrationHealth;
  /** One-line current state, e.g. "Up to date" or "1 day behind". */
  summary: string;
  /** ISO timestamp of the most recent activity, or null if never / N/A. */
  lastActivityAt: string | null;
  /** What lastActivityAt represents, e.g. "Last sync", "Last ping". */
  lastActivityLabel: string;
  /** Optional secondary context line. */
  detail?: string;
  /** Optional in-app link for drill-down. */
  href?: string;
};

export async function getIntegrationStatuses(): Promise<Integration[]> {
  const [db, sync] = await Promise.all([databaseStatus(), syncRunsSnapshot()]);
  return [
    db,
    metabaseStatus(sync),
    cronStatus(sync),
    await monthlyImportStatus(),
    emailStatus(),
  ];
}

// ── Database ────────────────────────────────────────────────────────────────

async function databaseStatus(): Promise<Integration> {
  const sql = getSql();
  const start = Date.now();
  try {
    await sql`SELECT 1`;
    const ms = Date.now() - start;
    // One threshold for both the chip and the text, so "Operational" never
    // sits next to "elevated latency".
    const slow = ms >= 800;
    return {
      key: "database",
      name: "Database (Postgres)",
      health: slow ? "degraded" : "operational",
      summary: slow ? "Connected, elevated latency" : "Connected",
      lastActivityAt: new Date(start).toISOString(),
      lastActivityLabel: "Last ping",
      detail: `Round-trip ${ms}ms`,
    };
  } catch (e) {
    return {
      key: "database",
      name: "Database (Postgres)",
      health: "down",
      summary: "Unreachable",
      lastActivityAt: null,
      lastActivityLabel: "Last ping",
      detail: e instanceof Error ? e.message : "Connection failed",
    };
  }
}

// ── Metabase sync (shared snapshot) ──────────────────────────────────────────

type SyncSnapshot = {
  latest: SyncRun | null;
  latestSuccess: SyncRun | null;
  latestCron: SyncRun | null;
  behindDays: number; // missing successful dates between epoch and yesterday
  yesterday: string;
};

async function syncRunsSnapshot(): Promise<SyncSnapshot> {
  const sql = getSql();
  const [latestRows, successRows, cronRows, gapRows, ydayRows] = await Promise.all([
    sql`SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1`,
    sql`SELECT * FROM sync_runs WHERE status = 'success' ORDER BY target_date DESC, finished_at DESC LIMIT 1`,
    sql`SELECT * FROM sync_runs WHERE trigger = 'cron' ORDER BY started_at DESC LIMIT 1`,
    sql`
      SELECT count(*)::int AS n
      FROM generate_series(${SYNC_EPOCH}::date, CURRENT_DATE - 1, '1 day') AS d
      WHERE NOT EXISTS (
        SELECT 1 FROM sync_runs r WHERE r.target_date = d::date AND r.status = 'success'
          AND COALESCE(r.rows_inserted, 0) > 0
      )`,
    sql`SELECT (CURRENT_DATE - 1)::text AS d`,
  ]);
  return {
    latest: (latestRows[0] as unknown as SyncRun) ?? null,
    latestSuccess: (successRows[0] as unknown as SyncRun) ?? null,
    latestCron: (cronRows[0] as unknown as SyncRun) ?? null,
    behindDays: (gapRows[0] as { n: number } | undefined)?.n ?? 0,
    yesterday: (ydayRows[0] as { d: string }).d,
  };
}

function isStalled(run: SyncRun | null): boolean {
  return (
    !!run && run.status === "running" && Date.now() - Date.parse(run.started_at) > STALL_MS
  );
}

function metabaseStatus(s: SyncSnapshot): Integration {
  const base = {
    key: "metabase",
    name: "Metabase usage sync",
    lastActivityLabel: "Last successful sync",
    lastActivityAt: s.latestSuccess?.finished_at ?? s.latestSuccess?.started_at ?? null,
    href: "/admin/sync",
  };

  if (!s.latestSuccess) {
    return { ...base, health: "down", summary: "No successful sync yet" };
  }
  if (s.latest?.status === "error" || isStalled(s.latest)) {
    return {
      ...base,
      health: "down",
      summary: isStalled(s.latest) ? "Last run stalled" : "Last run errored",
      detail: s.latest?.error ?? "Run never finished — likely a platform timeout.",
    };
  }
  const dataThrough = s.latestSuccess.target_date;
  if (s.behindDays > 0) {
    return {
      ...base,
      health: "degraded",
      summary: `${s.behindDays} ${s.behindDays === 1 ? "day" : "days"} behind`,
      detail: `Data through ${dataThrough}; cron will self-heal the gaps.`,
    };
  }
  return {
    ...base,
    health: "operational",
    summary: "Up to date",
    detail: `Data through ${dataThrough}`,
  };
}

function cronStatus(s: SyncSnapshot): Integration {
  const base = {
    key: "cron",
    name: "Scheduled job (cron)",
    lastActivityLabel: "Last cron run",
    lastActivityAt: s.latestCron?.started_at ?? null,
    detail: "Runs daily ~08:00 IST",
    href: "/admin/sync",
  };
  if (!s.latestCron) {
    return { ...base, health: "degraded", summary: "Never fired" };
  }
  const age = Date.now() - Date.parse(s.latestCron.started_at);
  if (age > CRON_STALE_MS) {
    const hrs = Math.round(age / (60 * 60 * 1000));
    return { ...base, health: "degraded", summary: `No run in ${hrs}h` };
  }
  return { ...base, health: "operational", summary: "On schedule" };
}

// ── Monthly import ───────────────────────────────────────────────────────────

async function monthlyImportStatus(): Promise<Integration> {
  const sql = getSql();
  const [row] = await sql`
    SELECT max(date)::text AS latest FROM usage_daily WHERE source = 'import'`;
  const latest = (row as { latest: string | null })?.latest ?? null;
  const base = {
    key: "import",
    name: "Monthly usage import",
    lastActivityLabel: "Latest imported data",
    detail: "Rows loaded with source = import",
  };
  if (!latest) {
    return { ...base, health: "not_configured", summary: "No imports yet", lastActivityAt: null };
  }
  return {
    ...base,
    health: "operational",
    summary: `Through ${latest}`,
    // usage_daily carries no ingest timestamp; the data date is the signal.
    lastActivityAt: null,
    detail: `Latest imported month ends ${latest}`,
  };
}

// ── Email ────────────────────────────────────────────────────────────────────

function emailStatus(): Integration {
  const sender = process.env.GMAIL_SENDER;
  const hasAppPassword = !!process.env.GMAIL_APP_PASSWORD;
  const hasOauth =
    !!process.env.GMAIL_OAUTH_REFRESH_TOKEN &&
    !!process.env.GOOGLE_CLIENT_ID &&
    !!process.env.GOOGLE_CLIENT_SECRET;
  const base = {
    key: "email",
    name: "Outbound email",
    lastActivityLabel: "Sends",
    lastActivityAt: null,
    detail: "Invite delivery",
  };
  if (sender && (hasAppPassword || hasOauth)) {
    return {
      ...base,
      health: "operational",
      summary: `Configured (${hasAppPassword ? "app password" : "OAuth"})`,
    };
  }
  return {
    ...base,
    health: "not_configured",
    summary: "Not configured",
    detail: "Invites still succeed; email delivery is skipped until wired up.",
  };
}
