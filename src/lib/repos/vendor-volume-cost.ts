// Vendor cost for rates that change with volume.
//
// `usage_daily_with_revenue` costs one day at a time, and a volume bracket is
// decided by a month's total — a single day cannot know which bracket it falls
// in. So a volume-priced (vendor, API) pair keeps its four flat cost columns at
// 0, the view yields $0 for it, and this module computes the cost the view
// could not and hands it back to be added on. Same arrangement
// `slab-revenue.ts` has on the client side, for the same reason.
//
// **One entry point, on purpose.** The client side grew eight separate add-back
// sites and still has surfaces that report volume-priced rows at $0 (the
// revenue-truth register lists it). Cost has ten readers, so instead of ten
// bespoke corrections every caller asks this module for the grain it needs.
// Adding a reader means calling one function; it does not mean re-deriving the
// pooling rule.
//
// **Pooling is per (vendor, API) per calendar month.**
// Brackets reset monthly because that is how a monthly invoice is cut.
//
// **Pooling is across every account, and attribution is by hits.** This is the
// one place the vendor side cannot copy the client side. A client's brackets
// are a contract with that client, so pooling per (client, API) IS the
// contract. A vendor's brackets are a contract with the vendor over all the
// traffic we send it; the vendor has never heard of our accounts. Pooling one
// account's hits on their own would run that account up a ladder it does not
// climb alone, and the accounts would then sum to more than the vendor's bill.
// So the month's whole volume — every account, and sandbox too unless the
// vendor has told us it does not charge for sandbox calls — decides
// the brackets,
// the ladder collapses to a blended cost per hit per outcome, and each reader
// multiplies that rate by whatever hits it is looking at. Every grain below is
// that one multiplication, so the grains agree with each other: the sum of
// accounts is the org total, the sum of days is the month, and each equals the
// vendor's bill.
//
// The bracket math is not forked. `lib/pricing/slabs.ts` types `Slab.price_*`
// as `unknown`, so vendor costs pass through `computeVolumeRevenue` unchanged
// and the two sides cannot drift apart on how a bracket is read. Its
// `effective` field is the blended rate this module needs: for `tier` it is the
// volume-weighted average across the brackets the month climbed, and for `slab`
// it is the one bracket the month landed in.

import getSql from "../db";
import { toMoney, toNumber, ZERO, type Money } from "../money";
import { shiftISO, todayIST } from "./periods";
import {
  computeVolumeRevenue,
  type Slab,
  type VolumeModel,
} from "../pricing/slabs";

type VendorSchedule = { model: VolumeModel; slabs: Slab[] };

/** Blended vendor cost per hit, per outcome, for one (vendor, API) month. */
export type UnitCost = {
  successful: Money;
  successful_no_data: Money;
  failed: Money;
  in_progress: Money;
};

/** Plain-number form of UnitCost, for callers outside the money layer. */
export type UnitCostNumbers = {
  successful: number;
  successful_no_data: number;
  failed: number;
  in_progress: number;
};

/** How a caller wants the correction broken down. */
type CostGrain = "total" | "api" | "vendor" | "date" | "client" | "pair";

export type VolumeCostOpts = {
  from: string;
  to: string;
  vendor?: string;
  apiCode?: string;
  clientId?: number;
  /** Match the caller's own read. Vendor surfaces pass true. */
  includeSandbox?: boolean;
};

type OutcomeCounts = {
  successful: number;
  successful_no_data: number;
  failed: number;
  in_progress: number;
};

// Vendor names are canonical via the registry (lib/vendor-registry.ts) and API codes are
// alphanumeric, so neither can contain this separator.
const SEP = "";
const poolKey = (vendor: string, api: string, month: string) =>
  [vendor, api, month].join(SEP);

/** Inclusive last day of `monthStart`'s calendar month. */
function monthEnd(monthStart: string): string {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7));
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return shiftISO(nextFirst, -1);
}

/** First day of `iso`'s calendar month. */
function monthStartOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function sumCounts(h: OutcomeCounts): number {
  return h.successful + h.successful_no_data + h.failed + h.in_progress;
}

function costOf(h: OutcomeCounts, rate: UnitCost): Money {
  return toMoney(h.successful)
    .times(rate.successful)
    .plus(toMoney(h.successful_no_data).times(rate.successful_no_data))
    .plus(toMoney(h.failed).times(rate.failed))
    .plus(toMoney(h.in_progress).times(rate.in_progress));
}

function countsFrom(r: any): OutcomeCounts {
  return {
    successful: Number(r.s ?? 0),
    successful_no_data: Number(r.snd ?? 0),
    failed: Number(r.f ?? 0),
    in_progress: Number(r.ip ?? 0),
  };
}

/**
 * Whether any vendor has volume brackets at all.
 *
 * Every correction below reads usage before it can discover there is nothing to
 * correct. While no contract has brackets — the state until the first one is
 * typed in — this lets every reader skip that work for the price of one EXISTS.
 */
export async function anyVendorVolumePricing(): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql`
    SELECT 1 AS ok WHERE EXISTS (
      SELECT 1 FROM vendor_pricing
      WHERE pricing_model IN ('slab', 'tier')
        AND COALESCE(cost_basis, 'vendor') = 'vendor'
    )
  `;
  return !!row;
}

/**
 * Bracket sets in force as of `asOf`, keyed by vendor and API code.
 *
 * A month is costed by the `vendor_pricing` row effective on or before its end,
 * the same resolution rule the view's LATERAL uses per day. The as-of date is
 * clamped to today so an in-progress month resolves the rate actually in force
 * now rather than one dated later in the month, and so two readers looking at
 * different windows agree about the same month.
 */
async function schedulesAsOf(asOf: string): Promise<Map<string, VendorSchedule>> {
  const sql = getSql();
  const rows = await sql`
    SELECT vd.canonical_name AS vendor_name, ve.api_code, ve.pricing_model,
           vs.min_hits, vs.max_hits,
           vs.cost_successful, vs.cost_successful_no_data,
           vs.cost_failed, vs.cost_in_progress
    FROM (
      SELECT DISTINCT ON (vp.vendor_id, vp.api_code)
             vp.id, vp.vendor_id, vp.api_code, vp.pricing_model, vp.cost_basis
      FROM vendor_pricing vp
      WHERE vp.effective_from <= ${asOf}
      ORDER BY vp.vendor_id, vp.api_code, vp.effective_from DESC
    ) ve
    -- The schedule is keyed by NAME below, because every reader groups the
    -- usage side by the view's vendor column. That column is now the
    -- registry's canonical name, so the two sides still meet, and a
    -- rename moves both at once.
    JOIN vendors vd ON vd.id = ve.vendor_id
    JOIN vendor_pricing_slab vs ON vs.vendor_pricing_id = ve.id
    WHERE ve.pricing_model IN ('slab', 'tier')
      AND COALESCE(ve.cost_basis, 'vendor') = 'vendor'
    ORDER BY vd.canonical_name, ve.api_code, vs.min_hits
  `;
  const map = new Map<string, VendorSchedule>();
  for (const r of rows as any[]) {
    const key = [r.vendor_name, r.api_code].join(SEP);
    // Aliased onto the shared math's field names. A NULL bracket cost means
    // that outcome's rate is unknown; it contributes 0 rather than breaking the
    // computation, and the pair's confidence already says the rate is partial.
    const bracket: Slab = {
      min_hits: Number(r.min_hits),
      max_hits: r.max_hits == null ? null : Number(r.max_hits),
      price_successful: r.cost_successful ?? 0,
      price_successful_no_data: r.cost_successful_no_data ?? 0,
      price_failed: r.cost_failed ?? 0,
      price_in_progress: r.cost_in_progress ?? 0,
    };
    const entry = map.get(key);
    if (entry) entry.slabs.push(bracket);
    else map.set(key, { model: r.pricing_model as VolumeModel, slabs: [bracket] });
  }
  return map;
}

/**
 * Blended cost per hit per outcome for every volume-priced (vendor, API) month
 * the window touches.
 *
 * The volume that picks the brackets is the WHOLE calendar month across every
 * account and both environments — the vendor's invoice line — even when the
 * caller asked about three days of one account. Empty when no volume-priced
 * pair carried traffic.
 */
async function unitCostsByMonth(from: string, to: string): Promise<Map<string, UnitCost>> {
  const sql = getSql();
  const rows = await sql`
    SELECT v.vendor, v.api_code,
           to_char(date_trunc('month', v.date::date), 'YYYY-MM-DD') AS month_start,
           SUM(v.successful)         AS s,
           SUM(v.successful_no_data) AS snd,
           SUM(v.failed)             AS f,
           SUM(v.in_progress)        AS ip
    FROM usage_daily_with_revenue v
    WHERE v.date BETWEEN ${monthStartOf(from)} AND ${monthEnd(monthStartOf(to))}
      AND v.api_code IS NOT NULL
      AND v.vendor IS NOT NULL AND v.vendor <> ''
      AND v.vendor_cost_model IN ('slab', 'tier')
      -- Sandbox hits a vendor does not charge for are not on the invoice the
      -- brackets describe, so they neither pick the bracket nor get charged at
      -- it. Every vendor is billable until one is marked otherwise.
      AND v.vendor_billable
    GROUP BY v.vendor, v.api_code, date_trunc('month', v.date::date)
  `;
  const out = new Map<string, UnitCost>();
  if ((rows as any[]).length === 0) return out;

  const today = todayIST();
  const schedCache = new Map<string, Map<string, VendorSchedule>>();
  for (const r of rows as any[]) {
    const end = monthEnd(r.month_start);
    const asOf = end > today ? today : end;
    let scheds = schedCache.get(asOf);
    if (!scheds) {
      scheds = await schedulesAsOf(asOf);
      schedCache.set(asOf, scheds);
    }
    const sched = scheds.get([r.vendor, r.api_code].join(SEP));
    if (!sched) continue;
    const hits = countsFrom(r);
    if (sumCounts(hits) === 0) continue;
    const { effective } = computeVolumeRevenue(sched.model, hits, sched.slabs);
    out.set(poolKey(r.vendor, r.api_code, r.month_start), {
      successful: effective.price_successful,
      successful_no_data: effective.price_successful_no_data,
      failed: effective.price_failed,
      in_progress: effective.price_in_progress,
    });
  }
  return out;
}

/** The extra grouping column each grain needs. */
function grainColumn(sql: any, grain: CostGrain) {
  switch (grain) {
    case "api":
      return sql`v.api_code AS gk`;
    case "vendor":
      return sql`v.vendor AS gk`;
    case "date":
      return sql`v.date::text AS gk`;
    case "client":
      return sql`v.client_id::text AS gk`;
    case "pair":
      return sql`v.client_id::text || ':' || v.api_code AS gk`;
    default:
      return sql`'' AS gk`;
  }
}

/**
 * Volume cost over the window at the requested grain, keyed by that grain.
 *
 * Every entry is the hits in scope times the month's blended rate, so the
 * grains are consistent with each other and with the vendor's bill.
 */
async function costByGrain(opts: VolumeCostOpts, grain: CostGrain): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!(await anyVendorVolumePricing())) return out;

  const rates = await unitCostsByMonth(opts.from, opts.to);
  if (rates.size === 0) return out;

  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const vendorCond = opts.vendor ? sql`AND v.vendor = ${opts.vendor}` : sql``;
  const apiCond = opts.apiCode ? sql`AND v.api_code = ${opts.apiCode}` : sql``;
  const clientCond = opts.clientId != null ? sql`AND v.client_id = ${opts.clientId}` : sql``;

  const rows = await sql`
    SELECT v.vendor, v.api_code,
           to_char(date_trunc('month', v.date::date), 'YYYY-MM-DD') AS month_start,
           ${grainColumn(sql, grain)},
           SUM(v.successful)         AS s,
           SUM(v.successful_no_data) AS snd,
           SUM(v.failed)             AS f,
           SUM(v.in_progress)        AS ip
    FROM usage_daily_with_revenue v
    WHERE v.date BETWEEN ${opts.from} AND ${opts.to}
      AND v.api_code IS NOT NULL
      AND v.vendor IS NOT NULL AND v.vendor <> ''
      AND v.vendor_cost_model IN ('slab', 'tier')
      AND v.vendor_billable
      ${sandboxCond} ${vendorCond} ${apiCond} ${clientCond}
    GROUP BY 1, 2, 3, 4
  `;

  const acc = new Map<string, Money>();
  for (const r of rows as any[]) {
    const rate = rates.get(poolKey(r.vendor, r.api_code, r.month_start));
    if (!rate) continue;
    const key = String(r.gk ?? "");
    acc.set(key, (acc.get(key) ?? ZERO).plus(costOf(countsFrom(r), rate)));
  }
  for (const [k, v] of acc) out.set(k, toNumber(v));
  return out;
}

/** Window total. The figure a KPI tile adds to its `SUM(vendor_cost)`. */
export async function vendorVolumeCostTotal(opts: VolumeCostOpts): Promise<number> {
  const m = await costByGrain(opts, "total");
  return m.get("") ?? 0;
}

/** Keyed by `api_code`, summed across vendors. */
export async function vendorVolumeCostByApi(opts: VolumeCostOpts): Promise<Map<string, number>> {
  return costByGrain(opts, "api");
}

/** Keyed by vendor name. */
export async function vendorVolumeCostByVendor(opts: VolumeCostOpts): Promise<Map<string, number>> {
  return costByGrain(opts, "vendor");
}

/** Keyed by ISO date, for daily series. */
export async function vendorVolumeCostByDate(opts: VolumeCostOpts): Promise<Map<string, number>> {
  return costByGrain(opts, "date");
}

/** Keyed by `client_id`. */
export async function vendorVolumeCostByClient(opts: VolumeCostOpts): Promise<Map<number, number>> {
  const m = await costByGrain(opts, "client");
  const out = new Map<number, number>();
  for (const [k, v] of m) out.set(Number(k), v);
  return out;
}

/** Keyed `${client_id}:${api_code}`, for per-pair margin checks. */
export async function vendorVolumeCostByPair(opts: VolumeCostOpts): Promise<Map<string, number>> {
  return costByGrain(opts, "pair");
}

/**
 * Blended cost per hit per outcome per API over the window, weighted by the
 * hits in scope across vendors and months.
 *
 * For readers that must cost a hit count they hold themselves rather than one
 * this module can group — the statement's capped sandbox tail, where only some
 * of the sandbox successes are billed.
 */
export async function vendorVolumeUnitCostsByApi(
  opts: VolumeCostOpts
): Promise<Map<string, UnitCostNumbers>> {
  const out = new Map<string, UnitCostNumbers>();
  if (!(await anyVendorVolumePricing())) return out;

  const rates = await unitCostsByMonth(opts.from, opts.to);
  if (rates.size === 0) return out;

  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const apiCond = opts.apiCode ? sql`AND v.api_code = ${opts.apiCode}` : sql``;
  const clientCond = opts.clientId != null ? sql`AND v.client_id = ${opts.clientId}` : sql``;

  const rows = await sql`
    SELECT v.vendor, v.api_code,
           to_char(date_trunc('month', v.date::date), 'YYYY-MM-DD') AS month_start,
           SUM(v.successful)         AS s,
           SUM(v.successful_no_data) AS snd,
           SUM(v.failed)             AS f,
           SUM(v.in_progress)        AS ip
    FROM usage_daily_with_revenue v
    WHERE v.date BETWEEN ${opts.from} AND ${opts.to}
      AND v.api_code IS NOT NULL
      AND v.vendor IS NOT NULL AND v.vendor <> ''
      AND v.vendor_cost_model IN ('slab', 'tier')
      AND v.vendor_billable
      ${sandboxCond} ${apiCond} ${clientCond}
    GROUP BY v.vendor, v.api_code, date_trunc('month', v.date::date)
  `;

  // Weight each (vendor, month) rate by the hits it covers, so an API served by
  // two vendors reports the mix it was actually served at.
  type Acc = { weighted: UnitCost; weight: OutcomeCounts };
  const acc = new Map<string, Acc>();
  for (const r of rows as any[]) {
    const rate = rates.get(poolKey(r.vendor, r.api_code, r.month_start));
    if (!rate) continue;
    const h = countsFrom(r);
    let e = acc.get(r.api_code);
    if (!e) {
      e = {
        weighted: { successful: ZERO, successful_no_data: ZERO, failed: ZERO, in_progress: ZERO },
        weight: { successful: 0, successful_no_data: 0, failed: 0, in_progress: 0 },
      };
      acc.set(r.api_code, e);
    }
    e.weighted.successful = e.weighted.successful.plus(rate.successful.times(h.successful));
    e.weighted.successful_no_data = e.weighted.successful_no_data.plus(
      rate.successful_no_data.times(h.successful_no_data)
    );
    e.weighted.failed = e.weighted.failed.plus(rate.failed.times(h.failed));
    e.weighted.in_progress = e.weighted.in_progress.plus(rate.in_progress.times(h.in_progress));
    e.weight.successful += h.successful;
    e.weight.successful_no_data += h.successful_no_data;
    e.weight.failed += h.failed;
    e.weight.in_progress += h.in_progress;
  }

  const div = (m: Money, n: number) => (n > 0 ? toNumber(m.div(n)) : 0);
  for (const [code, e] of acc) {
    out.set(code, {
      successful: div(e.weighted.successful, e.weight.successful),
      successful_no_data: div(e.weighted.successful_no_data, e.weight.successful_no_data),
      failed: div(e.weighted.failed, e.weight.failed),
      in_progress: div(e.weighted.in_progress, e.weight.in_progress),
    });
  }
  return out;
}
