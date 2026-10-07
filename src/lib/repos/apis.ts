// Per-API reads: catalog, summaries, activity, price variance, top consumers.

import getSql from "../db";
import type { ActivityDay } from "./types";
import { toNumber } from "../money";
import { cachedRevenueRead } from "../cache";
import { slabRevenueCorrections } from "./slab-revenue";
import { vendorVolumeCostByApi, vendorVolumeCostByClient } from "./vendor-volume-cost";

// Cached wrappers — keyed by their args; busted by revalidateRevenue().
// All read only usage_daily_with_revenue (or pricing, which pricing edits also
// bust via revalidateRevenue), so the tag keeps every entry fresh after a write.
export const getApiSummaries = cachedRevenueRead(getApiSummariesImpl, ["getApiSummaries"]);
export const getApiActivity = cachedRevenueRead(getApiActivityImpl, ["getApiActivity"]);
export const getApiPriceVariance = cachedRevenueRead(getApiPriceVarianceImpl, ["getApiPriceVariance"]);
export const getApiTopConsumer = cachedRevenueRead(getApiTopConsumerImpl, ["getApiTopConsumer"]);
export const getApiTopAccounts = cachedRevenueRead(getApiTopAccountsImpl, ["getApiTopAccounts"]);

export type ApiSummary = {
  product_code: string;
  name: string;
  category: string;
  vendor_type: string;
  /** What one billed unit is, e.g. "1M tokens", "minute". */
  unit: string;
  total_hits: number;
  revenue: number;
  // Null for viewers without cost access — see canViewCost().
  vendor_cost: number | null;
  margin: number | null;
  /**
   * Hits in the window whose effective vendor rate is actually known.
   *
   * `margin` is arithmetically true — revenue minus the cost we computed — but
   * an API with no rate computes ₹0 cost and therefore reads 100% margin. The
   * number cannot say which it is; this can. 0 means the margin figure is
   * revenue wearing a different name. Null for viewers without cost access.
   */
  cost_known_hits: number | null;
  unique_accounts: number;
  avg_unit_price: number;
  vendor_breakdown: { vendor: string; hits: number }[];
};

export async function listApis(): Promise<any[]> {
  const sql = getSql();
  return sql`
    SELECT product_code, name, category, vendor_type, unit
    FROM apis WHERE is_active = 1 ORDER BY name
  ` as unknown as Promise<any[]>;
}

export async function getApi(code: string): Promise<any> {
  const sql = getSql();
  const [row] = await sql`SELECT * FROM apis WHERE product_code = ${code}`;
  return row ?? null;
}

export function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export type ApiConflict = {
  kind: "name" | "alias";
  value: string;
  product_code: string;
  name: string;
};

/**
 * Case-insensitive collision check for a proposed name + aliases against the
 * rest of the catalog (each API's code, name, and log_aliases). Used by the
 * create/edit routes to reject duplicates before they enter the catalog.
 */
export async function findApiConflicts(input: {
  name: string;
  aliases: string[];
  excludeCode?: string;
}): Promise<ApiConflict[]> {
  const sql = getSql();
  const rows = (await sql`SELECT product_code, name, log_aliases FROM apis`) as any[];
  const conflicts: ApiConflict[] = [];
  const nameLower = input.name.trim().toLowerCase();

  for (const r of rows) {
    if (input.excludeCode && r.product_code === input.excludeCode) continue;
    const known = new Set(
      [r.product_code, r.name, ...parseAliases(r.log_aliases)].map((s: string) =>
        s.toLowerCase()
      )
    );
    if (known.has(nameLower)) {
      conflicts.push({ kind: "name", value: input.name, product_code: r.product_code, name: r.name });
    }
    for (const alias of input.aliases) {
      const a = alias.trim().toLowerCase();
      if (!a || a === nameLower) continue;
      if (known.has(a)) {
        conflicts.push({ kind: "alias", value: alias, product_code: r.product_code, name: r.name });
      }
    }
  }
  return conflicts;
}

export type DuplicateGroup = {
  kind: "name" | "alias";
  value: string;
  apis: { product_code: string; name: string }[];
};

/**
 * Existing collisions already in the catalog: the same name used by multiple
 * product codes, or the same alias claimed by multiple APIs (an alias equal
 * to another API's name or code counts too — the importer would resolve it
 * ambiguously).
 */
export async function listCatalogDuplicates(): Promise<DuplicateGroup[]> {
  const sql = getSql();
  const rows = (await sql`SELECT product_code, name, log_aliases FROM apis`) as any[];

  const byName = new Map<string, { value: string; apis: { product_code: string; name: string }[] }>();
  const byAlias = new Map<string, { value: string; apis: { product_code: string; name: string }[] }>();

  for (const r of rows) {
    const api = { product_code: r.product_code, name: r.name };
    const nameKey = String(r.name).trim().toLowerCase();
    if (!byName.has(nameKey)) byName.set(nameKey, { value: r.name, apis: [] });
    byName.get(nameKey)!.apis.push(api);

    // Each identifier an API answers to in the importer: code, name, aliases.
    const idents = new Set(
      [r.product_code, r.name, ...parseAliases(r.log_aliases)].map((s: string) =>
        s.trim().toLowerCase()
      )
    );
    for (const ident of idents) {
      if (!byAlias.has(ident)) byAlias.set(ident, { value: ident, apis: [] });
      byAlias.get(ident)!.apis.push(api);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const g of byName.values()) {
    if (g.apis.length > 1) groups.push({ kind: "name", value: g.value, apis: g.apis });
  }
  const nameDupKeys = new Set(
    groups.map((g) => g.value.trim().toLowerCase())
  );
  for (const [key, g] of byAlias) {
    // Skip groups already reported as duplicate names.
    if (g.apis.length > 1 && !nameDupKeys.has(key)) {
      groups.push({ kind: "alias", value: g.value, apis: g.apis });
    }
  }
  return groups.sort((a, b) => b.apis.length - a.apis.length);
}

// ── API review page: code-only matching surfaces ──────────────────────────
// Code-only ingestion quarantines anything whose Product Code isn't an active
// catalog code. These reads power /admin/sku-review.

export type UnknownCode = {
  code: string; sample_name: string; rows: number; hits: number; last_seen: string;
  // the code exists in the catalog but is deactivated → "reactivate"; else brand-new → "accept"
  exists_inactive: boolean;
};

/** Usage carrying a Product Code that isn't an active catalog code (unknown or retired). */
export async function listUnknownCodes(): Promise<UnknownCode[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT u.raw_api_code AS code,
           MIN(u.raw_api_name) AS sample_name,
           COUNT(*) AS rows,
           SUM(u.successful + u.successful_no_data + u.failed + u.in_progress) AS hits,
           MAX(u.date) AS last_seen,
           EXISTS (SELECT 1 FROM apis a WHERE a.product_code = u.raw_api_code AND a.is_active = 0) AS exists_inactive
    FROM usage_daily u
    WHERE u.api_code IS NULL AND u.raw_api_code IS NOT NULL AND u.raw_api_code <> ''
    GROUP BY u.raw_api_code
    ORDER BY hits DESC`;
  return (rows as any[]).map((r) => ({
    code: r.code, sample_name: r.sample_name, rows: Number(r.rows), hits: Number(r.hits),
    last_seen: r.last_seen, exists_inactive: Boolean(r.exists_inactive),
  }));
}

export type NoCodeRow = { raw_name: string; rows: number; hits: number; last_seen: string };

/** Usage with a blank Product Code — needs an admin override or an upstream fix. */
export async function listNoCodeRows(): Promise<NoCodeRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT raw_api_name AS raw_name,
           COUNT(*) AS rows,
           SUM(successful + successful_no_data + failed + in_progress) AS hits,
           MAX(date) AS last_seen
    FROM usage_daily
    WHERE api_code IS NULL AND (raw_api_code IS NULL OR raw_api_code = '')
    GROUP BY raw_api_name
    ORDER BY hits DESC`;
  return (rows as any[]).map((r) => ({
    raw_name: r.raw_name, rows: Number(r.rows), hits: Number(r.hits), last_seen: r.last_seen,
  }));
}

export type NameDrift = { api_code: string; raw_name: string; hits: number; last_seen: string };

/** Code-matched rows whose raw API name isn't a known catalog name/alias (advisory). */
export async function listNameDrift(): Promise<NameDrift[]> {
  const sql = getSql();
  const [pairs, cat] = await Promise.all([
    sql`
      SELECT api_code, raw_api_name AS raw_name,
             SUM(successful + successful_no_data + failed + in_progress) AS hits,
             MAX(date) AS last_seen
      FROM usage_daily
      WHERE api_code IS NOT NULL
      GROUP BY api_code, raw_api_name`,
    sql`SELECT product_code, name, log_aliases FROM apis`,
  ]);
  const known = new Map<string, Set<string>>();
  for (const a of cat as any[]) {
    const s = new Set<string>([String(a.name).trim().toLowerCase()]);
    for (const al of parseAliases(a.log_aliases)) s.add(al.trim().toLowerCase());
    known.set(a.product_code, s);
  }
  return (pairs as any[])
    .filter((p) => !known.get(p.api_code)?.has(String(p.raw_name).trim().toLowerCase()))
    .map((p) => ({ api_code: p.api_code, raw_name: p.raw_name, hits: Number(p.hits), last_seen: p.last_seen }))
    .sort((a, b) => b.hits - a.hits);
}

export type RetiredWithUsage = { product_code: string; name: string; rows: number; hits: number };

/** Deactivated catalog codes that still carry usage — review to reactivate/merge. */
export async function listRetiredWithUsage(): Promise<RetiredWithUsage[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT a.product_code, a.name,
           COUNT(u.id) AS rows,
           COALESCE(SUM(u.successful + u.successful_no_data + u.failed + u.in_progress), 0) AS hits
    FROM apis a
    JOIN usage_daily u ON u.api_code = a.product_code
    WHERE a.is_active = 0
    GROUP BY a.product_code, a.name
    ORDER BY hits DESC`;
  return (rows as any[]).map((r) => ({
    product_code: r.product_code, name: r.name, rows: Number(r.rows), hits: Number(r.hits),
  }));
}

async function getApiSummariesImpl(opts: {
  from: string;
  to: string;
  includeSandbox?: boolean;
  includeCost?: boolean;
  /** Include catalog APIs with no usage in the window (0 hits/revenue). */
  includeAllCatalog?: boolean;
}): Promise<ApiSummary[]> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;

  // includeAllCatalog: LEFT JOIN the full catalog onto the window's usage so
  // zero-usage APIs still appear (the page is a catalog, not just a ranking).
  // Otherwise only APIs with traffic in the window show.
  const rows = opts.includeAllCatalog
    ? await sql`
        WITH agg AS (
          SELECT
            v.api_code,
            SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS total_hits,
            SUM(v.successful) AS s_hits,
            SUM(v.revenue)    AS revenue,
            SUM(v.vendor_cost) AS vendor_cost,
            SUM(CASE WHEN COALESCE(v.vendor_cost_known, false)
                     THEN v.successful + v.successful_no_data + v.failed + v.in_progress
                     ELSE 0 END) AS cost_known_hits,
            COUNT(DISTINCT v.client_id) AS unique_accounts
          FROM usage_daily_with_revenue v
          WHERE v.api_code IS NOT NULL AND v.date BETWEEN ${opts.from} AND ${opts.to}
          ${sandboxCond}
          GROUP BY v.api_code
        )
        SELECT
          a.product_code AS api_code,
          a.name         AS api_name,
          COALESCE(agg.total_hits, 0)     AS total_hits,
          COALESCE(agg.s_hits, 0)         AS s_hits,
          COALESCE(agg.revenue, 0)        AS revenue,
          COALESCE(agg.vendor_cost, 0)    AS vendor_cost,
          COALESCE(agg.cost_known_hits, 0) AS cost_known_hits,
          COALESCE(agg.unique_accounts, 0) AS unique_accounts
        FROM apis a
        LEFT JOIN agg ON agg.api_code = a.product_code
        ORDER BY revenue DESC, a.name
      `
    : await sql`
        SELECT
          v.api_code,
          v.api_name,
          SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS total_hits,
          SUM(v.successful) AS s_hits,
          SUM(v.revenue)    AS revenue,
          SUM(v.vendor_cost) AS vendor_cost,
          SUM(CASE WHEN COALESCE(v.vendor_cost_known, false)
                   THEN v.successful + v.successful_no_data + v.failed + v.in_progress
                   ELSE 0 END) AS cost_known_hits,
          COUNT(DISTINCT v.client_id) AS unique_accounts
        FROM usage_daily_with_revenue v
        WHERE v.api_code IS NOT NULL AND v.date BETWEEN ${opts.from} AND ${opts.to}
        ${sandboxCond}
        GROUP BY v.api_code, v.api_name
        ORDER BY revenue DESC
      `;

  const apiCatalog = await sql`SELECT product_code, name, category, vendor_type, unit FROM apis`;
  const catMap = new Map(
    (apiCatalog as any[]).map((a) => [a.product_code, a])
  );

  const vbRows = await sql`
    SELECT v.api_code, v.vendor,
      SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits
    FROM usage_daily_with_revenue v
    WHERE v.api_code IS NOT NULL AND v.date BETWEEN ${opts.from} AND ${opts.to}
    ${sandboxCond}
    GROUP BY v.api_code, v.vendor
  `;

  const vbMap = new Map<string, { vendor: string; hits: number }[]>();
  for (const v of vbRows as any[]) {
    if (!vbMap.has(v.api_code)) vbMap.set(v.api_code, []);
    vbMap.get(v.api_code)!.push({ vendor: v.vendor ?? "—", hits: Number(v.hits ?? 0) });
  }

  // Volume-priced APIs (tier/slab) price to ₹0 in the per-day view; add their
  // per-month revenue back, summed per api_code. Vendor rates that change with
  // volume cost ₹0 in the view for the same reason, so the cost side needs the
  // same treatment — both, or the margin column moves the wrong way.
  const [slabCorrections, volumeCostByApi] = await Promise.all([
    slabRevenueCorrections({ from: opts.from, to: opts.to, includeSandbox: opts.includeSandbox }),
    vendorVolumeCostByApi({ from: opts.from, to: opts.to, includeSandbox: opts.includeSandbox }),
  ]);
  const slabByApi = new Map<string, number>();
  for (const c of slabCorrections) {
    slabByApi.set(c.api_code, (slabByApi.get(c.api_code) ?? 0) + c.revenue);
  }

  return (rows as any[])
    .map((r) => {
      const cat = catMap.get(r.api_code) as any;
      const revenue = toNumber(r.revenue) + (slabByApi.get(r.api_code) ?? 0);
      const vendor_cost = toNumber(r.vendor_cost) + (volumeCostByApi.get(r.api_code) ?? 0);
      const s_hits = Number(r.s_hits ?? 0);
      return {
        product_code: r.api_code,
        name: cat?.name ?? r.api_name ?? r.api_code,
        category: cat?.category ?? "",
        vendor_type: cat?.vendor_type ?? "",
        unit: cat?.unit ?? "call",
        total_hits: Number(r.total_hits ?? 0),
        revenue,
        vendor_cost: opts.includeCost ? vendor_cost : null,
        margin: opts.includeCost ? revenue - vendor_cost : null,
        cost_known_hits: opts.includeCost ? Number(r.cost_known_hits ?? 0) : null,
        unique_accounts: Number(r.unique_accounts ?? 0),
        avg_unit_price: s_hits > 0 ? revenue / s_hits : 0,
        vendor_breakdown: (vbMap.get(r.api_code) ?? []).sort((a, b) => b.hits - a.hits),
      };
    })
    // Adding slab revenue back reorders APIs; restore revenue-desc (the SQL's
    // original sort) so the list ranking is correct.
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
}

async function getApiActivityImpl(
  apiCode: string,
  opts: { from: string; to: string; includeSandbox?: boolean }
): Promise<ActivityDay[]> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT date,
      SUM(successful + successful_no_data + failed + in_progress) AS hits,
      SUM(revenue) AS revenue
    FROM usage_daily_with_revenue v
    WHERE v.api_code = ${apiCode} AND v.date BETWEEN ${opts.from} AND ${opts.to}
    ${sandboxCond}
    GROUP BY date
    ORDER BY date
  `;
  return (rows as any[]).map((r) => ({
    date: r.date,
    hits: Number(r.hits ?? 0),
    revenue: toNumber(r.revenue),
  }));
}

async function getApiPriceVarianceImpl(
  apiCode: string
): Promise<{ min: number; max: number; accounts_priced: number } | null> {
  const sql = getSql();
  const [row] = await sql`
    SELECT MIN(price_successful) AS p_min, MAX(price_successful) AS p_max, COUNT(*) AS n
    FROM pricing WHERE api_code = ${apiCode} AND price_successful > 0
  `;
  if (!row || !Number(row.n)) return null;
  return {
    min: toNumber(row.p_min),
    max: toNumber(row.p_max),
    accounts_priced: Number(row.n),
  };
}

async function getApiTopConsumerImpl(
  apiCode: string,
  opts: { from: string; to: string; includeSandbox?: boolean }
): Promise<{ name: string; revenue: number; share: number } | null> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT v.client_id, v.client_name AS display_name, SUM(v.revenue) AS revenue
    FROM usage_daily_with_revenue v
    WHERE v.api_code = ${apiCode} AND v.date BETWEEN ${opts.from} AND ${opts.to}
      AND v.client_id IS NOT NULL ${sandboxCond}
    GROUP BY v.client_id, v.client_name
    ORDER BY revenue DESC
  `;
  if (!rows.length) return null;

  // Slab accounts read ₹0 in the view, so ranking by view revenue buries them
  // (the true top consumer of a slab API can rank last). Add per-account slab
  // revenue back before picking the top and the share denominator.
  const slabByAccount = new Map<number, number>();
  for (const c of await slabRevenueCorrections({ from: opts.from, to: opts.to, includeSandbox: opts.includeSandbox })) {
    if (c.api_code === apiCode) slabByAccount.set(c.client_id, c.revenue);
  }
  const enriched = (rows as any[]).map((r) => ({
    name: r.display_name ?? "—",
    revenue: toNumber(r.revenue) + (slabByAccount.get(Number(r.client_id)) ?? 0),
  }));
  const total = enriched.reduce((s, e) => s + e.revenue, 0);
  if (total === 0) return null;
  enriched.sort((a, b) => b.revenue - a.revenue);
  const top = enriched[0];
  return {
    name: top.name,
    revenue: top.revenue,
    share: (top.revenue / total) * 100,
  };
}

async function getApiTopAccountsImpl(
  apiCode: string,
  opts: { from: string; to: string; includeSandbox?: boolean }
): Promise<any[]> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT
      v.client_id,
      v.client_name AS display_name,
      SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits,
      SUM(v.successful) AS s_hits,
      SUM(v.revenue)    AS revenue,
      SUM(v.vendor_cost) AS vendor_cost,
      MAX(v.p_s) AS p_s,
      MAX(v.bundle_name) AS bundle_name
    FROM usage_daily_with_revenue v
    WHERE v.api_code = ${apiCode} AND v.date BETWEEN ${opts.from} AND ${opts.to}
    ${sandboxCond}
    GROUP BY v.client_id, v.client_name
    ORDER BY hits DESC
  `;

  // Slab accounts read ₹0 in the view; add per-account slab revenue back so the
  // revenue column is truthful (ordering stays by hits, which is correct). A
  // volume-priced vendor rate reads ₹0 the same way on the cost column.
  const [slabCorrections, volumeCostByClient] = await Promise.all([
    slabRevenueCorrections({ from: opts.from, to: opts.to, includeSandbox: opts.includeSandbox }),
    vendorVolumeCostByClient({ from: opts.from, to: opts.to, apiCode, includeSandbox: opts.includeSandbox }),
  ]);
  const slabByAccount = new Map<number, number>();
  for (const c of slabCorrections) {
    if (c.api_code === apiCode) slabByAccount.set(c.client_id, c.revenue);
  }
  return (rows as any[]).map((r) => ({
    ...r,
    revenue: toNumber(r.revenue) + (slabByAccount.get(Number(r.client_id)) ?? 0),
    vendor_cost: toNumber(r.vendor_cost) + (volumeCostByClient.get(Number(r.client_id)) ?? 0),
  }));
}
