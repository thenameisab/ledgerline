// Loads the daily series the alert rules read, for one window of dates.
//
// Grain: one array slot per day for each (account, API) pair, then summed to
// accounts, APIs, vendors and the platform. Read only.
//
// What is left out, and why:
//   * Accounts whose name starts with "Sandbox". Not all of them are flagged
//     is_sandbox; their test traffic would otherwise read as unpriced usage
//     and new-API adoption, so they are skipped here.
//   * Sandbox usage (effective_is_sandbox = 1) from every volume, failure and
//     revenue series. It is kept in a separate series for rule D3 only.
//   * Manual entries from the hit series. A manual entry is one large row on
//     one date, so daily rules would read
//     it as a spike. Manual entries still count toward revenue and toward the
//     hits in revenue per hit.

import type postgres from "postgres";
import { slabRevenueCorrections } from "../repos/slab-revenue";
import { shiftISO } from "../repos/periods";
import { SYNC_EPOCH } from "../repos/sync-runs";

export type Series = Float64Array;

export type PairSeries = {
  client: number;
  api: string;
  s: Series;
  snd: Series;
  f: Series;
  ip: Series;
  hits: Series;
  rev: Series;
  vc: Series;
  /** Billable hits on days the pair had no price. */
  unpriced: Series;
  /** Sandbox hits, used only by D3. */
  sandbox: Series;
};

export type AccountSeries = {
  id: number;
  name: string;
  slug: string | null;
  hits: Series;
  rev: Series;
  /** Hits from manual entries (revenue per hit only). */
  manualHits: Series;
  pairs: string[];
};

export type ApiSeries = { code: string; name: string; hits: Series; f: Series; pairs: string[] };

export type VendorSeries = {
  t: Series;
  f: Series;
  byAccount: Map<number, { t: Series; f: Series }>;
};

export type AlertData = {
  dates: string[];
  index: Map<string, number>;
  pairs: Map<string, PairSeries>;
  accounts: Map<number, AccountSeries>;
  apis: Map<string, ApiSeries>;
  vendors: Map<string, VendorSeries>;
  platform: { t: Series; ok: Series };
  /** First billable synced hit, over all history. */
  accountFirst: Map<number, string>;
  pairFirst: Map<string, string>;
  /** Unmapped names first seen inside the window. */
  unmappedFirst: { kind: "account" | "api"; name: string; first: string }[];
  /** Volume-priced schedules per pair: tier start points by effective date, ascending. */
  volumeSchedules: Map<string, { eff: string; mins: number[] }[]>;
  /** Vendor-reported and Ledgerline hits per `${vendor}|${api_code}`. */
  recon: Map<string, { vendor: Series; ours: Series }>;
  reconFrom: string | null;
};

export const pairKey = (client: number, api: string) => `${client}|${api}`;

const daysInMonth = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * The first date to load so every rule has its history for `from`: 95 days
 * back (D5 looks 90 days back), moved to the first of that month so volume
 * pricing is computed on whole months, and never before usage starts.
 */
export function windowStart(from: string): string {
  const back = shiftISO(from, -95).slice(0, 8) + "01";
  return back < SYNC_EPOCH ? SYNC_EPOCH : back;
}

export async function loadAlertData(sql: postgres.Sql, from: string, to: string): Promise<AlertData> {
  const dates: string[] = [];
  for (let d = from; d <= to; d = shiftISO(d, 1)) dates.push(d);
  const N = dates.length;
  const index = new Map(dates.map((d, i) => [d, i]));
  const mk = () => new Float64Array(N);

  const [pairRows, vendorRows, clients, apis, acctFirstRows, pairFirstRows, unmappedRows, vendRecon, ourRecon, schedRows] =
    await Promise.all([
      sql`
        SELECT v.date::text AS date, v.client_id, v.api_code,
               COALESCE(v.effective_is_sandbox, 0) AS sbx, (v.source = 'manual') AS man,
               SUM(v.successful) AS s, SUM(v.successful_no_data) AS snd,
               SUM(v.failed) AS f, SUM(v.in_progress) AS ip,
               SUM(v.revenue) AS rev, SUM(v.vendor_cost) AS vc,
               SUM(CASE WHEN v.p_s = 0 AND v.p_snd = 0 AND v.p_f = 0 AND v.p_ip = 0
                         AND v.bundle_id IS NULL AND v.p_model NOT IN ('tier', 'slab')
                        THEN v.successful + v.successful_no_data + v.failed + v.in_progress ELSE 0 END) AS unpriced
        FROM usage_daily_with_revenue v
        JOIN clients c ON c.id = v.client_id
        WHERE v.date BETWEEN ${from} AND ${to} AND v.api_code IS NOT NULL
          AND c.deleted_at IS NULL AND c.display_name !~* '^sandbox'
        GROUP BY 1, 2, 3, 4, 5`,
      sql`
        SELECT v.date::text AS date, v.vendor, v.client_id,
               SUM(v.failed) AS f,
               SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS t
        FROM usage_daily_with_revenue v
        JOIN clients c ON c.id = v.client_id
        WHERE v.date BETWEEN ${from} AND ${to}
          AND v.vendor IS NOT NULL AND v.vendor <> '' AND v.source = 'log'
          AND COALESCE(v.effective_is_sandbox, 0) = 0
          AND c.deleted_at IS NULL AND c.display_name !~* '^sandbox'
        GROUP BY 1, 2, 3`,
      sql`SELECT id, display_name, slug FROM clients WHERE deleted_at IS NULL`,
      sql`SELECT product_code, name FROM apis`,
      sql`
        SELECT client_id, MIN(date)::text AS first FROM usage_daily_with_revenue
        WHERE source = 'log' AND client_id IS NOT NULL AND COALESCE(effective_is_sandbox, 0) = 0
          AND (successful + successful_no_data + failed + in_progress) > 0
        GROUP BY 1`,
      sql`
        SELECT client_id, api_code, MIN(date)::text AS first FROM usage_daily_with_revenue
        WHERE source = 'log' AND client_id IS NOT NULL AND api_code IS NOT NULL
          AND COALESCE(effective_is_sandbox, 0) = 0
          AND (successful + successful_no_data + failed + in_progress) > 0
        GROUP BY 1, 2`,
      sql`
        SELECT 'account' AS kind, raw_client_name AS name, MIN(date)::text AS first
        FROM usage_daily WHERE client_id IS NULL GROUP BY raw_client_name
        HAVING MIN(date) BETWEEN ${from} AND ${to}
        UNION ALL
        SELECT 'api', COALESCE(raw_api_code, raw_api_name), MIN(date)::text
        FROM usage_daily WHERE api_code IS NULL GROUP BY COALESCE(raw_api_code, raw_api_name)
        HAVING MIN(date) BETWEEN ${from} AND ${to}`,
      sql`
        SELECT date::text AS date, vendor, api_code, SUM(successful + successful_no_data + failed) AS h
        FROM vendor_usage_daily WHERE date BETWEEN ${from} AND ${to} GROUP BY 1, 2, 3`,
      sql`
        SELECT date::text AS date, vendor, api_code, SUM(successful + successful_no_data + failed) AS h
        FROM usage_daily
        WHERE date BETWEEN ${from} AND ${to} AND source = 'log' AND vendor IS NOT NULL AND vendor <> ''
        GROUP BY 1, 2, 3`,
      sql`
        SELECT p.client_id, p.api_code, p.effective_from::text AS eff, ps.min_hits
        FROM pricing p JOIN pricing_slab ps ON ps.pricing_id = p.id
        WHERE p.pricing_model IN ('tier', 'slab')
        ORDER BY p.client_id, p.api_code, p.effective_from, ps.min_hits`,
    ]);

  const clientInfo = new Map<number, { name: string; slug: string | null }>(
    (clients as any[]).map((c) => [Number(c.id), { name: c.display_name, slug: c.slug ?? null }])
  );
  const apiName = new Map<string, string>((apis as any[]).map((a) => [a.product_code, a.name]));

  // ---- pairs ----
  const pairs = new Map<string, PairSeries>();
  const getPair = (client: number, api: string) => {
    const k = pairKey(client, api);
    let p = pairs.get(k);
    if (!p) {
      p = { client, api, s: mk(), snd: mk(), f: mk(), ip: mk(), hits: mk(), rev: mk(), vc: mk(), unpriced: mk(), sandbox: mk() };
      pairs.set(k, p);
    }
    return p;
  };
  const manualHits = new Map<string, Series>();
  for (const r of pairRows as any[]) {
    const i = index.get(r.date);
    if (i == null) continue;
    const p = getPair(Number(r.client_id), r.api_code);
    const t = Number(r.s) + Number(r.snd) + Number(r.f) + Number(r.ip);
    if (Number(r.sbx) === 1) {
      p.sandbox[i] += t;
      continue;
    }
    p.rev[i] += Number(r.rev);
    p.vc[i] += Number(r.vc);
    if (r.man) {
      const k = pairKey(p.client, p.api);
      let m = manualHits.get(k);
      if (!m) manualHits.set(k, (m = mk()));
      m[i] += t;
      continue;
    }
    p.s[i] += Number(r.s);
    p.snd[i] += Number(r.snd);
    p.f[i] += Number(r.f);
    p.ip[i] += Number(r.ip);
    p.hits[i] += t;
    p.unpriced[i] += Number(r.unpriced);
  }

  // Volume-priced (tier / slab) revenue is 0 per day in the view. Compute it per
  // calendar month (tiers reset monthly) and spread it over the pair's days by
  // hits, so daily and weekly revenue include it.
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const corrections = await Promise.all(
    months.map((m) => {
      const mFrom = `${m}-01` < from ? from : `${m}-01`;
      const mEnd = `${m}-${String(daysInMonth(`${m}-01`)).padStart(2, "0")}`;
      return slabRevenueCorrections({ from: mFrom, to: mEnd > to ? to : mEnd }).then((c) => ({ mFrom, mTo: mEnd > to ? to : mEnd, c }));
    })
  );
  for (const { mFrom, mTo, c } of corrections) {
    const lo = index.get(mFrom)!, hi = index.get(mTo)!;
    for (const corr of c) {
      const p = pairs.get(pairKey(corr.client_id, corr.api_code));
      if (!p) continue;
      let total = 0;
      for (let i = lo; i <= hi; i++) total += p.hits[i];
      if (total <= 0) continue;
      for (let i = lo; i <= hi; i++) if (p.hits[i] > 0) p.rev[i] += (corr.revenue * p.hits[i]) / total;
    }
  }

  // ---- accounts, APIs, platform ----
  const accounts = new Map<number, AccountSeries>();
  const apisOut = new Map<string, ApiSeries>();
  const platform = { t: mk(), ok: mk() };
  for (const [k, p] of pairs) {
    let a = accounts.get(p.client);
    if (!a) {
      const info = clientInfo.get(p.client);
      a = { id: p.client, name: info?.name ?? `Account ${p.client}`, slug: info?.slug ?? null, hits: mk(), rev: mk(), manualHits: mk(), pairs: [] };
      accounts.set(p.client, a);
    }
    let ap = apisOut.get(p.api);
    if (!ap) {
      ap = { code: p.api, name: apiName.get(p.api) ?? p.api, hits: mk(), f: mk(), pairs: [] };
      apisOut.set(p.api, ap);
    }
    a.pairs.push(k);
    ap.pairs.push(k);
    const man = manualHits.get(k);
    for (let i = 0; i < N; i++) {
      a.hits[i] += p.hits[i];
      a.rev[i] += p.rev[i];
      if (man) a.manualHits[i] += man[i];
      ap.hits[i] += p.hits[i];
      ap.f[i] += p.f[i];
      platform.t[i] += p.hits[i];
      platform.ok[i] += p.s[i] + p.snd[i];
    }
  }

  // ---- vendors ----
  const vendors = new Map<string, VendorSeries>();
  for (const r of vendorRows as any[]) {
    const i = index.get(r.date);
    if (i == null) continue;
    let v = vendors.get(r.vendor);
    if (!v) vendors.set(r.vendor, (v = { t: mk(), f: mk(), byAccount: new Map() }));
    let va = v.byAccount.get(Number(r.client_id));
    if (!va) v.byAccount.set(Number(r.client_id), (va = { t: mk(), f: mk() }));
    v.t[i] += Number(r.t);
    v.f[i] += Number(r.f);
    va.t[i] += Number(r.t);
    va.f[i] += Number(r.f);
  }

  // ---- reconciliation (only vendors that report usage) ----
  const recon = new Map<string, { vendor: Series; ours: Series }>();
  const reporting = new Set((vendRecon as any[]).map((r) => r.vendor));
  const put = (r: any, side: "vendor" | "ours") => {
    const i = index.get(r.date);
    if (i == null) return;
    const k = `${r.vendor}|${r.api_code ?? "?"}`;
    let e = recon.get(k);
    if (!e) recon.set(k, (e = { vendor: mk(), ours: mk() }));
    e[side][i] += Number(r.h);
  };
  for (const r of vendRecon as any[]) put(r, "vendor");
  for (const r of ourRecon as any[]) if (reporting.has(r.vendor)) put(r, "ours");
  const reconFrom = (vendRecon as any[]).map((r) => r.date as string).sort()[0] ?? null;

  // ---- volume schedules ----
  const volumeSchedules = new Map<string, { eff: string; mins: number[] }[]>();
  for (const r of schedRows as any[]) {
    const k = pairKey(Number(r.client_id), r.api_code);
    let list = volumeSchedules.get(k);
    if (!list) volumeSchedules.set(k, (list = []));
    let e = list.find((x) => x.eff === r.eff);
    if (!e) list.push((e = { eff: r.eff, mins: [] }));
    e.mins.push(Number(r.min_hits));
  }

  return {
    dates,
    index,
    pairs,
    accounts,
    apis: apisOut,
    vendors,
    platform,
    accountFirst: new Map((acctFirstRows as any[]).map((r) => [Number(r.client_id), r.first])),
    pairFirst: new Map((pairFirstRows as any[]).map((r) => [pairKey(Number(r.client_id), r.api_code), r.first])),
    unmappedFirst: (unmappedRows as any[]).map((r) => ({ kind: r.kind, name: r.name, first: r.first })),
    volumeSchedules,
    recon,
    reconFrom,
  };
}
