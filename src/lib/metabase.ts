// Metabase client for the saved usage question (METABASE_USAGE_CARD_ID).
//
// Auth is username/password → session id, passed as X-Metabase-Session.
// Sessions expire on inactivity; the only re-auth flow is "401 → log in
// again", so the session is cached on globalThis (same warm-lambda pattern
// as lib/db.ts) and never persisted — a cold start just logs in fresh.
//
// The card takes exactly one parameter, a date filter on report_date.
// Rows come back keyed by display name (see MetabaseUsageRow). There is NO date column: a range query aggregates the whole
// range into one row per (account, api, hits_via), so daily ingestion must
// query one day at a time and tag rows with the queried date itself.
//
// No "server-only" import, so CLI scripts can import this (the same way
// lib/db.ts stays script-importable).

// The saved question and its date parameter. Both are set per deployment.
// The demo runs with MOCK_INTEGRATIONS=true and never calls Metabase.
const CARD_ID = process.env.METABASE_USAGE_CARD_ID ?? "";
const DATE_PARAM_ID = process.env.METABASE_USAGE_DATE_PARAM_ID ?? "";

export type MetabaseUsageRow = {
  // The card may key this column "Client name" or "Account name".
  // Read via accountNameOf() to tolerate either.
  "Client name"?: string;
  "Account name"?: string;
  "API Name": string;
  "Hits via": string;
  "Product Code": string;
  // Provider that served the hits. Older exports lack it,
  // so the sync falls back to the catalog.
  Vendor?: string;
  "Grand Total": number;
  Successful: number;
  "Successful-No data": number;
  "In-progress": number;
  Failed: number;
};

/** The account/client column has shipped under both names; prefer the current one. */
export function accountNameOf(r: MetabaseUsageRow): string {
  return (r["Client name"] ?? r["Account name"] ?? "").trim();
}

const GLOBAL_KEY = Symbol.for("ledgerline.metabaseSession");
type G = typeof globalThis & { [GLOBAL_KEY]?: string };
const g = globalThis as G;

function baseUrl(): string {
  return (process.env.METABASE_URL ?? "https://metabase.example.com").replace(/\/$/, "");
}

async function login(): Promise<string> {
  const username = process.env.METABASE_USERNAME;
  const password = process.env.METABASE_PASSWORD;
  if (!username || !password) {
    throw new Error("METABASE_USERNAME / METABASE_PASSWORD not configured");
  }

  // Retry transient failures with backoff. This covers brief 5xx blips only —
  // it is NOT enough to outlast Metabase's nightly maintenance/backup window,
  // which returns 503 for far longer than these few seconds of retries. The
  // cron is scheduled to run after that window for exactly this
  // reason; the retries are just belt-and-suspenders. postQuery already retries
  // 5xx; login must match. 4xx (e.g. 401 bad credentials) won't self-heal, so
  // fail fast on those.
  const MAX_ATTEMPTS = 4;
  let lastErr = "unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(`${baseUrl()}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "network error";
    }

    if (res) {
      if (res.ok) {
        const body = (await res.json()) as { id?: string };
        if (!body.id) throw new Error("Metabase login returned no session id");
        return body.id;
      }
      if (res.status < 500) {
        throw new Error(`Metabase login failed: HTTP ${res.status}`);
      }
      lastErr = `HTTP ${res.status}`;
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, attempt * 2_000)); // 2s, 4s, 6s
    }
  }
  throw new Error(`Metabase login failed after ${MAX_ATTEMPTS} attempts: ${lastErr}`);
}

async function postQuery(session: string, date: string): Promise<Response> {
  // /query/json returns plain row objects keyed by column display name and
  // is not subject to /query's 2,000-row visualization cap.
  return fetch(`${baseUrl()}/api/card/${CARD_ID}/query/json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Metabase-Session": session,
    },
    body: JSON.stringify({
      parameters: [
        {
          id: DATE_PARAM_ID,
          type: "date/all-options",
          value: date,
          target: ["dimension", ["template-tag", "report_date"]],
        },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
}

/**
 * Fetch the usage card for a single business date (YYYY-MM-DD). Handles session
 * acquisition, one re-login on 401, and one retry on transient 5xx/network
 * failure. Throws on anything else — callers record the error in sync_runs.
 */
export async function fetchUsageForDate(date: string): Promise<MetabaseUsageRow[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`invalid date for Metabase query: ${date}`);
  }

  let session = g[GLOBAL_KEY];
  if (!session) session = g[GLOBAL_KEY] = await login();

  let res: Response;
  try {
    res = await postQuery(session, date);
  } catch {
    // network hiccup / timeout — one retry on a fresh connection
    res = await postQuery(session, date);
  }

  if (res.status === 401) {
    g[GLOBAL_KEY] = undefined;
    session = g[GLOBAL_KEY] = await login();
    res = await postQuery(session, date);
  }
  if (res.status >= 500) {
    res = await postQuery(session, date);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Metabase card ${CARD_ID} query failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) {
    throw new Error(`Metabase card ${CARD_ID} returned non-array response`);
  }
  return rows as MetabaseUsageRow[];
}
