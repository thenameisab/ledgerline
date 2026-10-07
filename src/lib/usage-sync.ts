// Daily usage sync engine — pulls the usage card from Metabase and lands rows in
// usage_daily with source='log' and the real business date.
//
// Semantics per date, in one transaction:
//   delete that date's source='log' rows, insert the fresh pull. Re-running
//   a date is therefore idempotent, and Metabase restating a day (in-progress
//   hits settling) can never leave stale orphan rows behind.
//
// API mapping is CODE-ONLY: a row maps to an API iff its Product Code is an
// active code in apis. No name/alias matching (a stray space must never decide
// identity). When the code is blank or unknown, an explicit admin-curated
// api_code_overrides entry (raw API name → code) is the only fallback; else the
// row is quarantined with api_code NULL and raw_api_code kept, surfacing in the
// API review page. Clients still map by display_name/log_aliases. Never
// auto-create catalog records here.
//
// Every (run, date) writes a sync_runs row — the run history for /admin/sync
// and the signal the cron's gap self-heal keys off.
//
// No "server-only" import: scripts/backfill-usage.ts drives this from the CLI.

import getSql from "./db";
import { fetchUsageForDate, type MetabaseUsageRow } from "./metabase";
import { shiftISO, todayIST } from "./repos/periods";
import { resolveVendors } from "./vendor-registry";

// Portfolio mock: when set, the usage pull is simulated locally instead of
// calling Metabase. The "Refresh now" / "Backfill" buttons then synthesize
// usage for the existing client×API pairs, so the sync produces a real diff
// without any external service.
const MOCK = process.env.MOCK_INTEGRATIONS === "true";

// Deterministic per (date, key) jitter so a refreshed day is stable on re-run
// but differs across days — mirrors how real traffic settles.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Simulate a Metabase pull for one date from the client×API pairs already in
 * usage_daily. Each pair's volume tracks its recent history with a little
 * date-seeded variation; today (partial) lands a bit lower, as in reality.
 */
async function mockUsageForDate(date: string): Promise<MetabaseUsageRow[]> {
  const sql = getSql();
  const pairs = await sql`
    SELECT c.display_name AS client_name, a.product_code, a.name AS api_name, a.default_vendor,
           AVG(u.successful + u.successful_no_data + u.failed + u.in_progress) AS avg_total
    FROM usage_daily u
    JOIN clients c ON c.id = u.client_id
    JOIN apis a ON a.product_code = u.api_code
    WHERE u.source = 'log'
    GROUP BY c.display_name, a.product_code, a.name, a.default_vendor
  `;
  const isToday = date === todayIST();
  const rows: MetabaseUsageRow[] = [];
  for (const p of pairs as any[]) {
    const baseline = Number(p.avg_total) || 0;
    if (baseline <= 0) continue;
    const jitter = 0.85 + hash(`${date}:${p.product_code}:${p.client_name}`) * 0.3; // 0.85–1.15
    const partial = isToday ? 0.6 : 1; // today's data is still coming in
    const total = Math.max(0, Math.round(baseline * jitter * partial));
    if (total === 0) continue;
    const failed = Math.round(total * 0.06);
    const noData = Math.round(total * 0.04);
    const successful = Math.max(0, total - failed - noData);
    rows.push({
      "Client name": p.client_name,
      "API Name": p.api_name,
      "Hits via": "Integration",
      "Product Code": p.product_code,
      "Grand Total": total,
      Successful: successful,
      "Successful-No data": noData,
      "In-progress": 0,
      Failed: failed,
      // The card reports the vendor that served each row (#118). The mock
      // uses the catalog default vendor for the API.
      Vendor: p.default_vendor ?? "",
    });
  }
  return rows;
}

export type SyncTrigger = "cron" | "manual" | "backfill";

export type SyncDateResult = {
  date: string;
  status: "success" | "error";
  rows_fetched: number;
  rows_deleted: number;
  rows_inserted: number;
  total_hits: number;
  unmapped_clients: string[];
  unmapped_apis: string[];
  error?: string;
};

function parseCount(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : 0;
  if (v == null) return 0;
  const n = parseInt(String(v).replace(/[",]/g, "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

type UsageInsert = {
  date: string;
  client_id: number | null;
  api_code: string | null;
  raw_client_name: string;
  raw_api_name: string;
  raw_api_code: string | null;
  hits_via: string | null;
  vendor: string | null;
  vendor_id: number | null;
  failed: number;
  in_progress: number;
  successful_no_data: number;
  successful: number;
  source: "log";
};

/** Pull one business date from Metabase and land it in usage_daily. */
export async function syncDate(date: string, trigger: SyncTrigger): Promise<SyncDateResult> {
  const sql = getSql();
  const [run] = await sql`
    INSERT INTO sync_runs (trigger, target_date) VALUES (${trigger}, ${date}) RETURNING id
  `;

  try {
    const fetched = MOCK ? await mockUsageForDate(date) : await fetchUsageForDate(date);

    // The MIS export ships an "ALL CLIENTS TOTAL / ALL APIs" checksum row;
    // exclude it defensively in case the card ever grows one.
    const dataRows = fetched.filter(
      (r) => r["Client name"] !== "ALL CLIENTS TOTAL" && r["API Name"] !== "ALL APIs"
    );

    // Mapping tables — same resolution rules as scripts/import-usage.ts.
    const clients = await sql`SELECT id, display_name, log_aliases FROM clients`;
    const clientMap = new Map<string, number>();
    for (const c of clients) {
      if (!clientMap.has(c.display_name)) clientMap.set(c.display_name, Number(c.id));
      for (const a of JSON.parse(c.log_aliases ?? "[]") as string[]) {
        if (!clientMap.has(a)) clientMap.set(a, Number(c.id));
      }
    }
    const apis = await sql`SELECT product_code, default_vendor, is_active FROM apis`;
    // Only ACTIVE codes are valid match targets; retired/unknown codes quarantine.
    const apiCodes = new Set(
      apis.filter((a) => Number(a.is_active) === 1).map((a) => a.product_code as string)
    );
    const vendorByCode = new Map<string, string | null>();
    for (const a of apis) vendorByCode.set(a.product_code, a.default_vendor ?? null);
    // Explicit admin-curated exceptions, consulted ONLY when code is blank/unknown.
    const overrideRows = await sql`SELECT raw_api_name, api_code FROM api_code_overrides`;
    const overrides = new Map<string, string>();
    for (const o of overrideRows) overrides.set(o.raw_api_name as string, o.api_code as string);

    // Every vendor spelling in this pull resolved in one pass, creating a
    // registry row for any name never seen before. Both sources are
    // covered: the card's own Vendor column, and the catalog defaults that
    // stand in for rows which carry none.
    const vendors = await resolveVendors(sql, [
      ...dataRows.map((r) => (r.Vendor ?? "").trim()),
      ...vendorByCode.values(),
    ]);

    const unmappedClients = new Set<string>();
    const unmappedApis = new Set<string>();

    // Aggregate by the unique key — if Metabase ever returns two rows for the
    // same (client, api, hits_via, vendor), sum them rather than violate the index.
    const byKey = new Map<string, UsageInsert>();

    for (const r of dataRows) {
      const clientName = (r["Client name"] ?? "").trim();
      const apiName = (r["API Name"] ?? "").trim();
      if (!clientName || !apiName) continue;

      const clientId = clientMap.get(clientName) ?? null;
      if (clientId === null) unmappedClients.add(clientName);

      const fileCode = (r["Product Code"] ?? "").trim();
      let apiCode: string | null = null;
      if (fileCode && apiCodes.has(fileCode)) {
        apiCode = fileCode;
      } else if (overrides.has(apiName)) {
        apiCode = overrides.get(apiName)!;
      } else {
        unmappedApis.add(`${apiName}${fileCode ? ` [${fileCode}]` : ""}`);
      }

      const hitsVia = (r["Hits via"] ?? "").trim() || null;
      // Observed vendor from the card; the catalog default is only a fallback
      // for rows (or historical pulls) that carry no vendor.
      const vendorRef = vendors.get(
        (r.Vendor ?? "").trim() || (apiCode ? vendorByCode.get(apiCode) ?? null : null)
      );
      const vendor = vendorRef?.name ?? null;
      const key = `${clientName} ${apiName} ${hitsVia ?? ""} ${vendor ?? ""}`;
      const counts = {
        failed: parseCount(r.Failed),
        in_progress: parseCount(r["In-progress"]),
        successful_no_data: parseCount(r["Successful-No data"]),
        successful: parseCount(r.Successful),
      };
      const existing = byKey.get(key);
      if (existing) {
        existing.failed += counts.failed;
        existing.in_progress += counts.in_progress;
        existing.successful_no_data += counts.successful_no_data;
        existing.successful += counts.successful;
      } else {
        byKey.set(key, {
          date,
          client_id: clientId,
          api_code: apiCode,
          raw_client_name: clientName,
          raw_api_name: apiName,
          raw_api_code: fileCode || null,
          hits_via: hitsVia,
          vendor,
          vendor_id: vendorRef?.id ?? null,
          ...counts,
          source: "log",
        });
      }
    }
    const inserts = [...byKey.values()];

    let rowsDeleted = 0;
    await sql.begin(async (tx) => {
      const del = await tx`
        DELETE FROM usage_daily WHERE date = ${date} AND source = 'log'`;
      rowsDeleted = del.count;
      const CHUNK = 500;
      for (let i = 0; i < inserts.length; i += CHUNK) {
        await tx`INSERT INTO usage_daily ${tx(inserts.slice(i, i + CHUNK))}`;
      }
    });

    const totalHits = inserts.reduce(
      (a, r) => a + r.successful + r.successful_no_data + r.failed + r.in_progress, 0);

    await sql`
      UPDATE sync_runs SET
        status = 'success',
        rows_fetched = ${fetched.length},
        rows_deleted = ${rowsDeleted},
        rows_inserted = ${inserts.length},
        unmapped_clients = ${unmappedClients.size},
        unmapped_apis = ${unmappedApis.size},
        total_hits = ${totalHits},
        finished_at = NOW()
      WHERE id = ${run.id}`;

    return {
      date,
      status: "success",
      rows_fetched: fetched.length,
      rows_deleted: rowsDeleted,
      rows_inserted: inserts.length,
      total_hits: totalHits,
      unmapped_clients: [...unmappedClients].sort(),
      unmapped_apis: [...unmappedApis].sort(),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await sql`
      UPDATE sync_runs SET status = 'error', error = ${message.slice(0, 2000)}, finished_at = NOW()
      WHERE id = ${run.id}`;
    return {
      date,
      status: "error",
      rows_fetched: 0,
      rows_deleted: 0,
      rows_inserted: 0,
      total_hits: 0,
      unmapped_clients: [],
      unmapped_apis: [],
      error: message,
    };
  }
}

/** Sync an inclusive date range, oldest first. Errors don't stop later dates. */
export async function syncRange(
  from: string,
  to: string,
  trigger: SyncTrigger
): Promise<SyncDateResult[]> {
  const results: SyncDateResult[] = [];
  for (let d = from; d <= to; d = shiftISO(d, 1)) {
    results.push(await syncDate(d, trigger));
  }
  return results;
}

export type RefreshDiff = {
  from: string;
  to: string;
  dates: {
    date: string;
    status: "success" | "error";
    hits_before: number;
    hits_after: number;
    rows_before: number;
    rows_after: number;
    error?: string;
  }[];
  /** Per-client hit deltas across the refreshed window, biggest movers first. */
  movers: { client: string; hits_before: number; hits_after: number; delta: number }[];
  hits_before: number;
  hits_after: number;
  unmapped_clients: string[];
  unmapped_apis: string[];
};

const MAX_MOVERS = 12;

/**
 * Manual "refresh now": re-pull today plus the prior `days - 1` days and
 * report what changed. Unlike the cron (closed days only), this includes
 * today's partial data — the point of a midday refresh is seeing today.
 * Tomorrow's cron re-pulls today anyway, so the partial day self-corrects.
 */
export async function refreshLatest(days = 3): Promise<RefreshDiff> {
  const sql = getSql();
  const to = todayIST();
  const from = shiftISO(to, -(days - 1));

  const snapshot = async () => {
    const rows = await sql`
      SELECT date, raw_client_name,
             COUNT(*) AS rows,
             SUM(successful + successful_no_data + failed + in_progress) AS hits
      FROM usage_daily
      WHERE source = 'log' AND date BETWEEN ${from} AND ${to}
      GROUP BY date, raw_client_name`;
    return rows as unknown as { date: string; raw_client_name: string; rows: string; hits: string }[];
  };

  const before = await snapshot();
  const results = await syncRange(from, to, "manual");
  const after = await snapshot();

  const byDate = new Map<string, { hits_before: number; hits_after: number; rows_before: number; rows_after: number }>();
  const byClient = new Map<string, { hits_before: number; hits_after: number }>();
  for (let d = from; d <= to; d = shiftISO(d, 1)) {
    byDate.set(d, { hits_before: 0, hits_after: 0, rows_before: 0, rows_after: 0 });
  }
  for (const r of before) {
    const d = byDate.get(r.date)!;
    d.hits_before += Number(r.hits);
    d.rows_before += Number(r.rows);
    const c = byClient.get(r.raw_client_name) ?? { hits_before: 0, hits_after: 0 };
    c.hits_before += Number(r.hits);
    byClient.set(r.raw_client_name, c);
  }
  for (const r of after) {
    const d = byDate.get(r.date)!;
    d.hits_after += Number(r.hits);
    d.rows_after += Number(r.rows);
    const c = byClient.get(r.raw_client_name) ?? { hits_before: 0, hits_after: 0 };
    c.hits_after += Number(r.hits);
    byClient.set(r.raw_client_name, c);
  }

  const movers = [...byClient.entries()]
    .map(([client, v]) => ({ client, ...v, delta: v.hits_after - v.hits_before }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, MAX_MOVERS);

  const unmappedClients = new Set<string>();
  const unmappedApis = new Set<string>();
  for (const r of results) {
    r.unmapped_clients.forEach((c) => unmappedClients.add(c));
    r.unmapped_apis.forEach((a) => unmappedApis.add(a));
  }

  return {
    from,
    to,
    dates: results.map((r) => ({
      date: r.date,
      status: r.status,
      ...byDate.get(r.date)!,
      ...(r.error ? { error: r.error } : {}),
    })),
    movers,
    hits_before: [...byDate.values()].reduce((a, d) => a + d.hits_before, 0),
    hits_after: [...byDate.values()].reduce((a, d) => a + d.hits_after, 0),
    unmapped_clients: [...unmappedClients].sort(),
    unmapped_apis: [...unmappedApis].sort(),
  };
}
