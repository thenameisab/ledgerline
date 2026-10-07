/**
 * Vendor-side usage from the upstream Metabase database (MySQL), table
 * `vendor_usage_report`.
 *
 * Separate from lib/metabase.ts on purpose. That module reads a
 * saved question with a bound date parameter and a fixed column contract. This
 * one runs a native query against the database directly, because there is no
 * saved card for `vendor_usage_report` and the reconciliation needs a date range
 * in a single round trip rather than one call per day.
 *
 * Auth is the same username/password → session flow, and the session cache is
 * shared with lib/metabase.ts through the same global symbol: two logins per
 * cold start would be wasteful, and the 401-relogin path is identical.
 *
 * No "server-only" import: the sync script runs this from the CLI.
 *
 * Demo mode: with MOCK_INTEGRATIONS=true both exports read the local
 * usage_daily instead of Metabase (see mockVendorUsage below).
 */

import getSql from "./db";

// Metabase database id that holds the vendor report table. Set per deployment.
const DATABASE_ID = Number(process.env.METABASE_VENDOR_DATABASE_ID ?? 0);
const isMock = () => process.env.MOCK_INTEGRATIONS === "true";

/** One deduplicated (date, vendor, api) row as the vendor reports it. */
export type VendorUsageRow = {
  report_date: string;
  vendor: string;
  /** Display name, e.g. "Credit Bureau Pull". The catalog match runs on this. */
  type_label: string;
  /** Endpoint slug, e.g. "credit-bureau-pull". */
  api_name: string;
  successful: number;
  successful_no_data: number;
  failed: number;
};

// Shared with lib/metabase.ts — same Metabase user, same session.
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
      // 4xx won't self-heal (bad credentials); only 5xx is worth a retry.
      if (res.status < 500) throw new Error(`Metabase login failed: HTTP ${res.status}`);
      lastErr = `HTTP ${res.status}`;
    }
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, attempt * 2_000));
  }
  throw new Error(`Metabase login failed after ${MAX_ATTEMPTS} attempts: ${lastErr}`);
}

function postNative(session: string, query: string): Promise<Response> {
  // /api/dataset/json takes the query as a form field and returns plain row
  // objects keyed by column name — no result metadata, and none of the
  // 2,000-row cap that /api/dataset applies for visualisations.
  return fetch(`${baseUrl()}/api/dataset/json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "X-Metabase-Session": session,
    },
    body: new URLSearchParams({
      query: JSON.stringify({
        database: DATABASE_ID,
        type: "native",
        native: { query },
      }),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(180_000),
  });
}

async function runNative<T>(query: string): Promise<T[]> {
  let session = g[GLOBAL_KEY];
  if (!session) session = g[GLOBAL_KEY] = await login();

  let res: Response;
  try {
    res = await postNative(session, query);
  } catch {
    res = await postNative(session, query); // one retry on a network hiccup
  }
  if (res.status === 401) {
    g[GLOBAL_KEY] = undefined;
    session = g[GLOBAL_KEY] = await login();
    res = await postNative(session, query);
  }
  if (res.status >= 500) {
    res = await postNative(session, query);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Metabase native query failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) throw new Error("Metabase native query returned non-array response");
  return rows as T[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Vendor-side counts for a closed date range, one row per
 * (date, vendor, type_label, api_name).
 *
 * The MAX aggregation collapses duplicates: `vendor_usage_report` can hold exact
 * re-uploads of the same key, and duplicates agree on the count, so MAX
 * picks the one true value where SUM would multiply it.
 *
 * Dates are validated, not escaped — they are interpolated into SQL, so the
 * regex is the injection guard. Callers pass ISO dates.
 */
export async function fetchVendorUsage(from: string, to: string): Promise<VendorUsageRow[]> {
  if (!ISO.test(from) || !ISO.test(to)) {
    throw new Error(`invalid date range for vendor usage query: ${from}..${to}`);
  }
  if (isMock()) return mockVendorUsage(from, to);
  const rows = await runNative<Record<string, unknown>>(`
    SELECT report_date, vendor, type_label, api_name,
           MAX(successful)          AS successful,
           MAX(successful_no_data)  AS successful_no_data,
           MAX(failed)              AS failed
    FROM vendor_usage_report
    WHERE report_date BETWEEN '${from}' AND '${to}'
    GROUP BY report_date, vendor, type_label, api_name
  `);
  return rows.map((r) => ({
    report_date: String(r.report_date ?? "").slice(0, 10),
    vendor: String(r.vendor ?? "").trim(),
    type_label: String(r.type_label ?? "").trim(),
    api_name: String(r.api_name ?? "").trim(),
    successful: Number(r.successful ?? 0),
    successful_no_data: Number(r.successful_no_data ?? 0),
    failed: Number(r.failed ?? 0),
  }));
}

/** Earliest and latest `report_date` the vendor table holds. Null when empty. */
export async function vendorUsageCoverage(): Promise<{ from: string; to: string } | null> {
  if (isMock()) {
    const [row] = await getSql()`
      SELECT MIN(date)::text AS mn, MAX(date)::text AS mx FROM usage_daily WHERE source = 'log'`;
    if (!row?.mn || !row?.mx) return null;
    return { from: row.mn as string, to: row.mx as string };
  }
  const [row] = await runNative<{ mn: string | null; mx: string | null }>(
    `SELECT MIN(report_date) AS mn, MAX(report_date) AS mx FROM vendor_usage_report`
  );
  if (!row?.mn || !row?.mx) return null;
  return { from: String(row.mn).slice(0, 10), to: String(row.mx).slice(0, 10) };
}

// ── Portfolio mock ────────────────────────────────────────────────────────────

// Deterministic 0–1 value per string, so a re-pull of the same window returns
// the same numbers.
function mockHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// A vendor-side API name that the mock catalog does not have, so the
// reconciliation page shows an unmatched row.
const MOCK_UNMATCHED = { vendor: "DataBridge", type_label: "Address Lookup Pro", api_name: "address-lookup-pro" };

/**
 * The vendor side of the reconciliation, derived from our own usage_daily.
 * Most (vendor, API) pairs match our count. About one pair in six reports
 * 8–30% more calls than we attribute to an account, which is the gap the
 * reconciliation exists to find. One vendor also reports an API name the
 * catalog does not know.
 */
async function mockVendorUsage(from: string, to: string): Promise<VendorUsageRow[]> {
  const rows = await getSql()`
    SELECT u.date::text AS d, u.vendor, a.name AS api_name,
           SUM(u.successful)::int AS successful,
           SUM(u.successful_no_data)::int AS successful_no_data,
           SUM(u.failed)::int AS failed
    FROM usage_daily u
    JOIN apis a ON a.product_code = u.api_code
    WHERE u.date BETWEEN ${from} AND ${to} AND u.vendor IS NOT NULL
    GROUP BY u.date, u.vendor, a.name`;
  const out: VendorUsageRow[] = [];
  const unmatchedDays = new Set<string>();
  for (const r of rows as any[]) {
    const pair = mockHash(`${r.vendor}:${r.api_name}`);
    // 1 in 6 pairs over-reports; the size of the gap varies a little per day.
    const extra = pair < 0.17 ? 1.08 + mockHash(`${r.d}:${r.vendor}:${r.api_name}`) * 0.22 : 1;
    out.push({
      report_date: r.d,
      vendor: r.vendor,
      type_label: r.api_name,
      api_name: String(r.api_name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      successful: Math.round(Number(r.successful) * extra),
      successful_no_data: Number(r.successful_no_data),
      failed: Number(r.failed),
    });
    if (r.vendor === MOCK_UNMATCHED.vendor) unmatchedDays.add(r.d);
  }
  for (const d of unmatchedDays) {
    out.push({
      report_date: d,
      ...MOCK_UNMATCHED,
      successful: 40 + Math.round(mockHash(`unmatched:${d}`) * 60),
      successful_no_data: 3,
      failed: 2,
    });
  }
  return out;
}
