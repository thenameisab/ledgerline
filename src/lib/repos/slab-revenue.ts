// Volume-pricing revenue corrections for dashboard reads.
//
// usage_daily_with_revenue prices per day and yields 0 revenue for volume-priced
// APIs — 'tier' (graduated) and 'slab' (whole-volume) — since their flat columns
// are 0 and period-total pricing can't live in a per-day view. Invoices recompute
// those lines in deriveStatement. Dashboard reads that sum the view therefore
// UNDER-report volume-priced accounts. This module recomputes that revenue for a
// window per (account, api) pair so callers can add it back. The view stays the
// single source for hits/vendor cost.

import getSql from "../db";
import { computeVolumeRevenue, type Slab, type VolumeModel } from "../pricing/slabs";
import { toNumber } from "../money";
import { shiftISO } from "./periods";

/** A volume-priced schedule for one pair: model + its brackets. */
type VolumeSchedule = { model: VolumeModel; slabs: Slab[] };

export type PairCorrection = {
  client_id: number;
  api_code: string;
  revenue: number; // slab revenue over the window (the view counted 0)
  vendor_cost: number;
  hits: number;
};

type Opts = { from: string; to: string; accountId?: number; includeSandbox?: boolean };

/**
 * Effective slab schedules as of `asOf`, optionally for one account. A period
 * is priced by the row effective on/before its end (mid-window model changes
 * are rare and resolve on the next read). Keyed `${client_id}:${api_code}`.
 */
async function schedulesAsOf(asOf: string, accountId?: number): Promise<Map<string, VolumeSchedule>> {
  const sql = getSql();
  const accountCond = accountId != null ? sql`AND p.client_id = ${accountId}` : sql``;
  const rows = await sql`
    SELECT pe.client_id, pe.api_code, pe.pricing_model, ps.min_hits, ps.max_hits,
           ps.price_successful, ps.price_successful_no_data,
           ps.price_failed, ps.price_in_progress
    FROM (
      SELECT DISTINCT ON (p.client_id, p.api_code)
             p.id, p.client_id, p.api_code, p.pricing_model
      FROM pricing p
      WHERE p.effective_from <= ${asOf} ${accountCond}
      ORDER BY p.client_id, p.api_code, p.effective_from DESC
    ) pe
    JOIN pricing_slab ps ON ps.pricing_id = pe.id
    WHERE pe.pricing_model IN ('slab', 'tier')
    ORDER BY pe.client_id, pe.api_code, ps.min_hits
  `;
  const map = new Map<string, VolumeSchedule>();
  for (const r of rows as any[]) {
    const key = `${r.client_id}:${r.api_code}`;
    const tier: Slab = {
      min_hits: Number(r.min_hits),
      max_hits: r.max_hits == null ? null : Number(r.max_hits),
      price_successful: r.price_successful,
      price_successful_no_data: r.price_successful_no_data,
      price_failed: r.price_failed,
      price_in_progress: r.price_in_progress,
    };
    const entry = map.get(key);
    if (entry) entry.slabs.push(tier);
    else map.set(key, { model: r.pricing_model as VolumeModel, slabs: [tier] });
  }
  return map;
}

/**
 * Per-(account, api) volume revenue over [from, to], computed **per calendar
 * month** (brackets reset monthly — the billing truth; see deriveStatement) and
 * summed, so it matches the sum of monthly invoices instead of pooling the
 * whole window into one ladder (which under-reports multi-month windows).
 * Handles both models — 'tier' (graduated) and 'slab' (whole-volume).
 * Schedules are read as of each month's end (clamped to `to`), mirroring
 * slabBreakdownByApi. Bundle-applied usage is excluded (bundles bill at the
 * bundle rate, never by volume). Empty when no volume usage is in scope.
 */
export async function slabRevenueCorrections(opts: Opts): Promise<PairCorrection[]> {
  const sql = getSql();
  const accountCond = opts.accountId != null ? sql`AND v.client_id = ${opts.accountId}` : sql``;
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT v.client_id, v.api_code,
           to_char(date_trunc('month', v.date::date), 'YYYY-MM-DD') AS month_start,
           SUM(v.successful)          AS s,
           SUM(v.successful_no_data)  AS snd,
           SUM(v.failed)              AS f,
           SUM(v.in_progress)         AS ip,
           SUM(v.vendor_cost)         AS vendor_cost
    FROM usage_daily_with_revenue v
    WHERE v.client_id IS NOT NULL AND v.api_code IS NOT NULL
      AND v.date BETWEEN ${opts.from} AND ${opts.to}
      AND v.bundle_applied = 0
      AND v.p_model IN ('slab', 'tier')
      ${accountCond} ${sandboxCond}
    GROUP BY v.client_id, v.api_code, date_trunc('month', v.date::date)
  `;
  if ((rows as any[]).length === 0) return [];

  // Schedules are stable month-to-month in practice; cache per as-of date.
  const schedCache = new Map<string, Map<string, VolumeSchedule>>();
  const schedAt = async (asOf: string) => {
    let m = schedCache.get(asOf);
    if (!m) { m = await schedulesAsOf(asOf, opts.accountId); schedCache.set(asOf, m); }
    return m;
  };

  // Sum each (account, api)'s monthly graduations back into one correction.
  const acc = new Map<string, PairCorrection>();
  for (const r of rows as any[]) {
    const asOf = monthEndClamped(r.month_start, opts.to);
    const schedule = (await schedAt(asOf)).get(`${r.client_id}:${r.api_code}`);
    if (!schedule) continue;
    const hits = {
      successful: Number(r.s ?? 0),
      successful_no_data: Number(r.snd ?? 0),
      failed: Number(r.f ?? 0),
      in_progress: Number(r.ip ?? 0),
    };
    const { revenue } = computeVolumeRevenue(schedule.model, hits, schedule.slabs);
    const key = `${r.client_id}:${r.api_code}`;
    let entry = acc.get(key);
    if (!entry) {
      entry = { client_id: Number(r.client_id), api_code: r.api_code, revenue: 0, vendor_cost: 0, hits: 0 };
      acc.set(key, entry);
    }
    entry.revenue += toNumber(revenue);
    entry.vendor_cost += Number(r.vendor_cost ?? 0);
    entry.hits += hits.successful + hits.successful_no_data + hits.failed + hits.in_progress;
  }
  return [...acc.values()];
}

/** Total slab revenue over the window (org-wide unless accountId given). */
export async function slabRevenueTotal(opts: Opts): Promise<number> {
  const corrections = await slabRevenueCorrections(opts);
  return corrections.reduce((s, c) => s + c.revenue, 0);
}

/** Slab revenue per account over the window. Key: client_id. */
export async function slabRevenueByAccount(opts: Opts): Promise<Map<number, number>> {
  const corrections = await slabRevenueCorrections(opts);
  const m = new Map<number, number>();
  for (const c of corrections) m.set(c.client_id, (m.get(c.client_id) ?? 0) + c.revenue);
  return m;
}

/**
 * Slab revenue per billing period for one account (for the invoice-list draft
 * totals). Schedules are read as of the latest period end — exact for the
 * current/open period; a historical pricing change would only skew the summary
 * list, not the invoice itself (deriveStatement prices each period precisely).
 * Key: period_id.
 */
export async function slabRevenueByPeriod(
  accountId: number,
  periods: { id: number; start_date: string; end_date: string }[],
  includeSandbox = false
): Promise<Map<number, number>> {
  if (periods.length === 0) return new Map();
  const asOf = periods.reduce((m, p) => (p.end_date > m ? p.end_date : m), periods[0].end_date);
  const schedules = await schedulesAsOf(asOf, accountId);
  if (schedules.size === 0) return new Map();

  const sql = getSql();
  const ids = periods.map((p) => p.id);
  const sandboxCond = includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT bp.id AS period_id, v.api_code,
           SUM(v.successful)         AS s,
           SUM(v.successful_no_data) AS snd,
           SUM(v.failed)             AS f,
           SUM(v.in_progress)        AS ip
    FROM billing_periods bp
    JOIN usage_daily_with_revenue v
      ON v.client_id = ${accountId}
     AND v.date BETWEEN bp.start_date AND bp.end_date
    WHERE bp.id = ANY(${ids})
      AND v.api_code IS NOT NULL
      AND v.p_model IN ('slab', 'tier')
      AND v.bundle_applied = 0
      ${sandboxCond}
    GROUP BY bp.id, v.api_code
  `;
  const m = new Map<number, number>();
  for (const r of rows as any[]) {
    const schedule = schedules.get(`${accountId}:${r.api_code}`);
    if (!schedule) continue;
    const { revenue } = computeVolumeRevenue(
      schedule.model,
      {
        successful: Number(r.s ?? 0),
        successful_no_data: Number(r.snd ?? 0),
        failed: Number(r.f ?? 0),
        in_progress: Number(r.ip ?? 0),
      },
      schedule.slabs
    );
    const pid = Number(r.period_id);
    m.set(pid, (m.get(pid) ?? 0) + toNumber(revenue));
  }
  return m;
}

/** A tier's realised hits + revenue, summed across the window's months. */
export type SlabBandAgg = {
  min_hits: number;
  max_hits: number | null;
  price: number; // the tier's successful rate (the headline ₹/hit)
  hits: number;
  revenue: number;
};

/** Inclusive last day of `monthStart`'s calendar month, clamped to `to`. */
function monthEndClamped(monthStart: string, to: string): string {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7));
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const end = shiftISO(nextFirst, -1);
  return end > to ? to : end;
}

/**
 * Per-(api_code) volume revenue for one account over [from, to], computed **per
 * calendar month** (brackets reset monthly — the billing truth; see
 * deriveStatement) and summed, for both 'tier' (graduated) and 'slab'
 * (whole-volume). Unlike slabRevenueCorrections, which pools the whole window
 * into one ladder, this matches the sum of monthly invoices. Each result also
 * carries a per-bracket breakdown aggregated across the window's months.
 * Schedules are read as of each month's end (clamped to `to`).
 */
export async function slabBreakdownByApi(
  opts: Opts
): Promise<Map<string, { revenue: number; bands: SlabBandAgg[] }>> {
  const sql = getSql();
  const accountCond = opts.accountId != null ? sql`AND v.client_id = ${opts.accountId}` : sql``;
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT v.client_id, v.api_code,
           to_char(date_trunc('month', v.date::date), 'YYYY-MM-DD') AS month_start,
           SUM(v.successful)         AS s,
           SUM(v.successful_no_data) AS snd,
           SUM(v.failed)             AS f,
           SUM(v.in_progress)        AS ip
    FROM usage_daily_with_revenue v
    WHERE v.client_id IS NOT NULL AND v.api_code IS NOT NULL
      AND v.date BETWEEN ${opts.from} AND ${opts.to}
      AND v.p_model IN ('slab', 'tier')
      AND v.bundle_applied = 0
      ${accountCond} ${sandboxCond}
    GROUP BY v.client_id, v.api_code, date_trunc('month', v.date::date)
  `;
  if ((rows as any[]).length === 0) return new Map();

  // Schedules are stable month-to-month in practice; cache per as-of date.
  const schedCache = new Map<string, Map<string, VolumeSchedule>>();
  const schedAt = async (asOf: string) => {
    let m = schedCache.get(asOf);
    if (!m) { m = await schedulesAsOf(asOf, opts.accountId); schedCache.set(asOf, m); }
    return m;
  };

  type Acc = { revenue: number; bands: Map<number, SlabBandAgg> };
  const acc = new Map<string, Acc>();
  for (const r of rows as any[]) {
    const asOf = monthEndClamped(r.month_start, opts.to);
    const schedule = (await schedAt(asOf)).get(`${r.client_id}:${r.api_code}`);
    if (!schedule) continue;
    const { revenue, bands } = computeVolumeRevenue(
      schedule.model,
      {
        successful: Number(r.s ?? 0),
        successful_no_data: Number(r.snd ?? 0),
        failed: Number(r.f ?? 0),
        in_progress: Number(r.ip ?? 0),
      },
      schedule.slabs
    );
    let entry = acc.get(r.api_code);
    if (!entry) { entry = { revenue: 0, bands: new Map() }; acc.set(r.api_code, entry); }
    entry.revenue += toNumber(revenue);
    for (const b of bands) {
      let agg = entry.bands.get(b.min_hits);
      if (!agg) {
        agg = { min_hits: b.min_hits, max_hits: b.max_hits, price: toNumber(b.price_successful), hits: 0, revenue: 0 };
        entry.bands.set(b.min_hits, agg);
      }
      agg.hits += b.hits;
      agg.revenue += toNumber(b.revenue);
    }
  }

  const out = new Map<string, { revenue: number; bands: SlabBandAgg[] }>();
  for (const [code, e] of acc) {
    out.set(code, { revenue: e.revenue, bands: [...e.bands.values()].sort((a, b) => a.min_hits - b.min_hits) });
  }
  return out;
}
