// Cross-cutting reads over the revenue view: org-level KPIs, daily series,
// alerts panel counts, and vendor list.

import getSql from "../db";
import type { DailySeriesRow, Alert, RiskSummary } from "./types";
import { mtdRange } from "./periods";
import { toMoney, toNumber, marginPct } from "../money";
import { slabRevenueCorrections, slabRevenueTotal } from "./slab-revenue";
import {
  vendorVolumeCostByDate,
  vendorVolumeCostByPair,
  vendorVolumeCostTotal,
} from "./vendor-volume-cost";
import { vendorMinimumTopUpTotal } from "./vendor-minimum";
import { cachedRevenueRead } from "../cache";

// Cached wrappers — keyed by their args; busted by revalidateRevenue().
export const getKpis = cachedRevenueRead(getKpisImpl, ["getKpis"]);
export const getDailySeries = cachedRevenueRead(getDailySeriesImpl, ["getDailySeries"]);
export const getRiskSummary = cachedRevenueRead(getRiskSummaryImpl, ["getRiskSummary"]);

export type WindowKpis = {
  revenue: number;
  // Null for viewers without cost access — see canViewCost().
  vendor_cost: number | null;
  /**
   * The part of `vendor_cost` that comes from vendor monthly minimums rather
   * than metered traffic. It belongs to no account, API or day, so it is the
   * exact amount by which this total exceeds the sum of the accounts. Null for
   * viewers without cost access; 0 when no floor bound in the window.
   */
  minimum_top_up: number | null;
  margin: number | null;
  margin_pct: number | null;
  active_accounts: number;
  total_hits: number;
  hit_breakdown: {
    successful: number;
    successful_no_data: number;
    failed: number;
    in_progress: number;
  };
};

async function getKpisImpl(
  opts: { from: string; to: string; includeSandbox?: boolean; includeCost?: boolean } = mtdRange()
): Promise<WindowKpis> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const [row] = await sql`
    SELECT
      SUM(revenue)      AS revenue,
      SUM(vendor_cost)  AS vendor_cost,
      SUM(successful)   AS sum_s,
      SUM(successful_no_data) AS sum_snd,
      SUM(failed)       AS sum_f,
      SUM(in_progress)  AS sum_ip,
      COUNT(DISTINCT client_id) AS active_accounts
    FROM usage_daily_with_revenue v
    WHERE date BETWEEN ${opts.from} AND ${opts.to}
    ${sandboxCond}
  `;

  // Slab APIs price on the period total, so the per-day view counts them as 0.
  // Add their recomputed revenue back before deriving margin. Vendor rates that
  // change with volume are ₹0 in the view for the same reason, on the cost side.
  //
  // A vendor's monthly minimum tops its month up to the contracted floor. It
  // belongs to no account, API or day, so it is counted here and nowhere
  // further down: this total is the company's cost, and it is larger than the
  // sum of the accounts by exactly `minimum_top_up`.
  const [slabRev, volumeCost, minimumTopUp] = await Promise.all([
    slabRevenueTotal({ from: opts.from, to: opts.to, includeSandbox: opts.includeSandbox }),
    vendorVolumeCostTotal({ from: opts.from, to: opts.to, includeSandbox: opts.includeSandbox }),
    vendorMinimumTopUpTotal({ from: opts.from, to: opts.to }),
  ]);
  const revenueM = toMoney(row.revenue).plus(toMoney(slabRev));
  const vendorCostM = toMoney(row.vendor_cost)
    .plus(toMoney(volumeCost))
    .plus(toMoney(minimumTopUp));
  const marginM = revenueM.minus(vendorCostM);
  const total_hits =
    Number(row.sum_s ?? 0) +
    Number(row.sum_snd ?? 0) +
    Number(row.sum_f ?? 0) +
    Number(row.sum_ip ?? 0);

  return {
    revenue: toNumber(revenueM),
    vendor_cost: opts.includeCost ? toNumber(vendorCostM) : null,
    minimum_top_up: opts.includeCost ? minimumTopUp : null,
    margin: opts.includeCost ? toNumber(marginM) : null,
    margin_pct: opts.includeCost ? marginPct(marginM, revenueM) : null,
    active_accounts: Number(row.active_accounts ?? 0),
    total_hits,
    hit_breakdown: {
      successful: Number(row.sum_s ?? 0),
      successful_no_data: Number(row.sum_snd ?? 0),
      failed: Number(row.sum_f ?? 0),
      in_progress: Number(row.sum_ip ?? 0),
    },
  };
}

async function getDailySeriesImpl(opts: {
  from: string;
  to: string;
  includeSandbox?: boolean;
  includeCost?: boolean;
}): Promise<DailySeriesRow[]> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT date,
      SUM(revenue)      AS revenue,
      SUM(vendor_cost)  AS vendor_cost,
      SUM(successful + successful_no_data + failed + in_progress) AS hits
    FROM usage_daily_with_revenue v
    WHERE date BETWEEN ${opts.from} AND ${opts.to}
    ${sandboxCond}
    GROUP BY date
    ORDER BY date
  `;
  // Volume-priced vendor rates cost ₹0 per day in the view; the month's blended
  // rate lands on the days that earned it, so the series still sums to the month.
  const volumeByDate = await vendorVolumeCostByDate({
    from: opts.from,
    to: opts.to,
    includeSandbox: opts.includeSandbox,
  });
  return rows.map((r: any) => {
    const rev = toMoney(r.revenue);
    const vc = toMoney(r.vendor_cost).plus(toMoney(volumeByDate.get(r.date) ?? 0));
    return {
      date: r.date,
      revenue: toNumber(rev),
      vendor_cost: opts.includeCost ? toNumber(vc) : null,
      margin: opts.includeCost ? toNumber(rev.minus(vc)) : null,
      hits: Number(r.hits ?? 0),
    };
  });
}

export async function getAlerts(opts: { from: string; to: string }): Promise<Alert[]> {
  const sql = getSql();

  const [ucRow] = await sql`
    SELECT COUNT(DISTINCT raw_client_name) AS n
    FROM usage_daily
    WHERE client_id IS NULL AND date BETWEEN ${opts.from} AND ${opts.to}
  `;
  const [uaRow] = await sql`
    SELECT COUNT(DISTINCT raw_api_name) AS n
    FROM usage_daily
    WHERE api_code IS NULL AND date BETWEEN ${opts.from} AND ${opts.to}
  `;
  const [upRow] = await sql`
    SELECT COUNT(*) AS n FROM (
      SELECT DISTINCT v.client_id, v.api_code
      FROM usage_daily_with_revenue v
      WHERE v.client_id IS NOT NULL AND v.api_code IS NOT NULL
        AND v.date BETWEEN ${opts.from} AND ${opts.to}
        AND v.p_s = 0 AND v.p_snd = 0 AND v.p_f = 0 AND v.p_ip = 0
        AND v.bundle_id IS NULL
        AND (v.successful + v.successful_no_data + v.failed + v.in_progress) > 0
        AND COALESCE(v.effective_is_sandbox, 0) = 0
    ) sub
  `;

  return [
    { kind: "unmapped_account", count: Number(ucRow.n ?? 0) },
    { kind: "unmapped_api",    count: Number(uaRow.n ?? 0) },
    { kind: "unpriced",        count: Number(upRow.n ?? 0) },
  ];
}

// Quantifies the dashboard's health issues in rupees. Three classes:
//  - revenue_leak: (account, api) pairs with billable traffic but no price set.
//    Value is *estimated* — these hits have no price, so we model what they'd
//    earn at the org's avg revenue-per-billable-hit.
//  - silent_loss: usage rows whose client_name/api_name didn't resolve, so
//    they're excluded from revenue entirely. Also estimated via avg rate.
//  - margin_watch: priced pairs where vendor cost exceeds revenue. This is an
//    *actual* booked loss — no estimation.
async function getRiskSummaryImpl(opts: {
  from: string;
  to: string;
  includeSandbox?: boolean;
  includeCost?: boolean;
}): Promise<RiskSummary> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;

  // Org avg revenue per billable hit over priced traffic. This is the rate we
  // apply to unpriced/unmapped volume to model rupees at risk.
  const [rateRow] = await sql`
    SELECT SUM(revenue) AS rev,
           SUM(successful + successful_no_data + failed + in_progress) AS hits
    FROM usage_daily_with_revenue v
    WHERE v.date BETWEEN ${opts.from} AND ${opts.to}
      AND v.revenue > 0
      ${sandboxCond}
  `;
  const rate =
    Number(rateRow.hits ?? 0) > 0 ? parseFloat(rateRow.rev ?? 0) / Number(rateRow.hits) : 0;

  // Revenue leak — unpriced billable pairs and their at-risk hit volume.
  const [leakRow] = await sql`
    SELECT COUNT(*) AS pairs, COALESCE(SUM(hits), 0) AS hits FROM (
      SELECT v.client_id, v.api_code,
             SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits
      FROM usage_daily_with_revenue v
      WHERE v.client_id IS NOT NULL AND v.api_code IS NOT NULL
        AND v.date BETWEEN ${opts.from} AND ${opts.to}
        AND v.p_s = 0 AND v.p_snd = 0 AND v.p_f = 0 AND v.p_ip = 0
        AND v.bundle_id IS NULL AND v.p_model NOT IN ('slab', 'tier')
        AND (v.successful + v.successful_no_data + v.failed + v.in_progress) > 0
        ${sandboxCond}
        AND NOT EXISTS (
          SELECT 1 FROM leak_dismissals d
          WHERE d.client_id = v.client_id AND d.api_code = v.api_code
        )
      GROUP BY v.client_id, v.api_code
    ) sub
  `;

  // Silent loss — unmapped names and the hits they hide from revenue.
  const [lossRow] = await sql`
    SELECT
      (SELECT COUNT(DISTINCT raw_client_name) FROM usage_daily
        WHERE client_id IS NULL AND date BETWEEN ${opts.from} AND ${opts.to}) AS uc,
      (SELECT COUNT(DISTINCT raw_api_name) FROM usage_daily
        WHERE api_code IS NULL AND date BETWEEN ${opts.from} AND ${opts.to}) AS ua,
      (SELECT COALESCE(SUM(successful + successful_no_data + failed + in_progress), 0)
        FROM usage_daily
        WHERE (client_id IS NULL OR api_code IS NULL)
          AND date BETWEEN ${opts.from} AND ${opts.to}) AS hits
  `;

  // Margin watch — priced pairs sold below vendor cost. Actual booked loss.
  //
  // The per-pair rows come back uncorrected and the test is applied here rather
  // than in a HAVING, because neither side of it is complete in the view: a
  // volume-priced API earns ₹0 revenue per day and a volume-priced vendor rate
  // costs ₹0 per day. Both corrections are added to the same pair before it is
  // judged, so a pair that is only under water once both land is counted once,
  // not twice or never.
  const pairRows = await sql`
    SELECT v.client_id, v.api_code,
           SUM(v.revenue) AS rev, SUM(v.vendor_cost) AS cost,
           SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits
    FROM usage_daily_with_revenue v
    WHERE v.client_id IS NOT NULL AND v.api_code IS NOT NULL
      AND v.date BETWEEN ${opts.from} AND ${opts.to}
      ${sandboxCond}
      -- Booked loss = invoiced usage only. Clamp to billing-period coverage
      -- so current-month / un-invoiced usage (no billing period yet) isn't
      -- reported as "actual booked loss". Leak/silent_loss below stay on the
      -- raw window — they are forward-looking run-rate estimates.
      AND EXISTS (
        SELECT 1 FROM billing_periods bp
        WHERE v.date BETWEEN bp.start_date AND bp.end_date
      )
    GROUP BY v.client_id, v.api_code
    HAVING SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) > 0
  `;

  // Both corrections are clamped to billing-period coverage the same way — per
  // period, summed — so they describe the same invoiced usage the rows above do.
  const billedPeriods = await sql`
    SELECT start_date, end_date FROM billing_periods
    WHERE start_date <= ${opts.to} AND end_date >= ${opts.from}
  `;
  const pairRevenueAdd = new Map<string, number>();
  const pairCostAdd = new Map<string, number>();
  for (const bp of billedPeriods as any[]) {
    const f = bp.start_date > opts.from ? bp.start_date : opts.from;
    const t = bp.end_date < opts.to ? bp.end_date : opts.to;
    const [slabCorr, volumeCost] = await Promise.all([
      slabRevenueCorrections({ from: f, to: t, includeSandbox: opts.includeSandbox }),
      vendorVolumeCostByPair({ from: f, to: t, includeSandbox: opts.includeSandbox }),
    ]);
    for (const c of slabCorr) {
      const k = `${c.client_id}:${c.api_code}`;
      pairRevenueAdd.set(k, (pairRevenueAdd.get(k) ?? 0) + c.revenue);
    }
    for (const [k, cost] of volumeCost) {
      pairCostAdd.set(k, (pairCostAdd.get(k) ?? 0) + cost);
    }
  }

  let marginPairs = 0;
  let marginHits = 0;
  let marginNet = 0; // negative (loss)
  for (const r of pairRows as any[]) {
    const k = `${r.client_id}:${r.api_code}`;
    const revenue = toNumber(r.rev) + (pairRevenueAdd.get(k) ?? 0);
    const cost = toNumber(r.cost) + (pairCostAdd.get(k) ?? 0);
    if (revenue > 0 && revenue < cost) {
      marginPairs++;
      marginHits += Number(r.hits ?? 0);
      marginNet += revenue - cost;
    }
  }

  const leakHits = Number(leakRow.hits ?? 0);
  const lossHits = Number(lossRow.hits ?? 0);
  const marginLoss = Math.abs(marginNet);

  const items: RiskSummary["items"] = [
    {
      kind: "revenue_leak",
      count: Number(leakRow.pairs ?? 0),
      hits: leakHits,
      amount: leakHits * rate,
      estimated: true,
      href: "/admin/pricing?filter=unpriced",
    },
    {
      kind: "silent_loss",
      count: Number(lossRow.uc ?? 0),
      count2: Number(lossRow.ua ?? 0),
      hits: lossHits,
      amount: lossHits * rate,
      estimated: true,
      href: "/admin/aliases",
    },
    {
      kind: "margin_watch",
      count: marginPairs,
      hits: marginHits,
      amount: marginLoss,
      estimated: false,
      href: "/vendors",
    },
  ];

  // Margin watch is a cost-derived figure (revenue < vendor cost). Members
  // can't see cost, so the item — and its contribution to the total — is
  // dropped entirely rather than shown without its number.
  const visibleItems = opts.includeCost
    ? items
    : items.filter((it) => it.kind !== "margin_watch");

  const total = visibleItems.reduce((s, it) => s + it.amount, 0);
  return {
    items: visibleItems,
    total,
    estimated: visibleItems.some((it) => it.estimated && it.amount > 0),
    rate,
  };
}

export async function listVendors(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT DISTINCT vendor FROM usage_daily WHERE vendor IS NOT NULL ORDER BY vendor
  `;
  return rows.map((r: any) => r.vendor as string);
}
