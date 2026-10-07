// A vendor's monthly minimum.
//
// Some contracts carry a floor: bill at least X in a calendar month, whatever
// the traffic came to. Period cost = max(computed, minimum), so when the floor
// binds the difference is a real cost that no per-hit rate can produce.
//
// **The top-up is never allocated.** The vendor bills it because our TOTAL
// volume was low, not because any one account's was. Spreading it over accounts
// pro-rata would move an account's invoiced margin for reasons outside that
// account — an attribution the contract does not make. So it raises the
// vendor's period cost and the org's vendor cost, named as its own figure, and
// leaves account statements, per-API margin and the daily series untouched.
// Org cost therefore no longer equals the sum of account costs; every surface
// that carries the top-up has to say so.
//
// **A minimum only applies to a calendar month the window fully contains and
// that has ended.** This is the one place the bucket-and-sum rule the rest of
// the codebase uses cannot be followed. A volume ladder can be attributed to a
// partial month because there are hits in scope to price; a flat floor has
// nothing to scale by, and the three alternatives are all wrong:
//
//   - pro-rating by days invents a daily entitlement the contract does not
//     have, and nothing in this codebase pro-rates a billable amount;
//   - charging the whole month's floor to a seven-day window would let two
//     overlapping windows each claim all of it;
//   - comparing a partial month's cost against a whole month's floor reports a
//     shortfall that the rest of the month may well close.
//
// So a partial or in-progress month contributes its computed cost only, and
// says so. That matches how MonthPace declines to project a figure it would
// be dishonest about.
//
// **Computed is measured over the vendor's whole book, sandbox included.**
// Whether the floor binds is a fact about the invoice, and the vendor invoices
// every call it served. A caller that excludes sandbox from its own base
// still gets the true top-up; the base is what is narrow, not the floor.

import getSql from "../db";
import { toMoney, toNumber, ZERO, type Money } from "../money";
import { todayIST, shiftISO } from "./periods";
import { vendorVolumeCostByVendor } from "./vendor-volume-cost";

/** Why a month in the window carries no top-up even though a minimum exists. */
export type SkipReason = "partial" | "in_progress";

/** One vendor-month: what the floor was, what we ran up, and the difference. */
export type VendorMinimumMonth = {
  vendor: string;
  /** First day of the calendar month, YYYY-MM-DD. */
  month: string;
  /** The floor in force for that month. */
  minimum: number;
  /** Flat plus volume cost over the vendor's whole book that month. */
  computed: number;
  /** max(0, minimum - computed). Zero when the floor did not bind. */
  top_up: number;
  /** False when the month is only partly in the window, or has not ended. */
  applied: boolean;
  /** Set when `applied` is false. */
  skipped?: SkipReason;
};

export type MinimumOpts = { from: string; to: string; vendor?: string };

/** First day of `iso`'s calendar month. */
function monthStartOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Inclusive last day of `monthStart`'s calendar month. */
function monthEnd(monthStart: string): string {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7));
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return shiftISO(nextFirst, -1);
}

/**
 * Whether any vendor has a minimum at all.
 *
 * Every read below costs a scan before it can discover there is nothing to
 * apply. While no contract has one — the state until the first is entered —
 * this lets every reader skip that for one EXISTS.
 */
export async function anyVendorMinimum(): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql`
    SELECT 1 AS ok WHERE EXISTS (
      SELECT 1 FROM vendor_commitments WHERE monthly_minimum IS NOT NULL
    )
  `;
  return !!row;
}

/**
 * The minimum in force for each vendor as of `asOf` — the row effective on or
 * before that date, the same resolution rule a rate uses. Keyed by vendor name.
 */
async function minimumsAsOf(asOf: string, vendor?: string): Promise<Map<string, number>> {
  const sql = getSql();
  const vendorCond = vendor ? sql`AND lower(vd.canonical_name) = lower(${vendor})` : sql``;
  // Keyed by name, because the usage side of every caller groups by the view's
  // vendor column, which is the registry's canonical name.
  const rows = await sql`
    SELECT DISTINCT ON (vc.vendor_id) vd.canonical_name AS vendor_name, vc.monthly_minimum
    FROM vendor_commitments vc
    JOIN vendors vd ON vd.id = vc.vendor_id
    WHERE vc.effective_from <= ${asOf} ${vendorCond}
    ORDER BY vc.vendor_id, vc.effective_from DESC
  `;
  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    // A later row that clears the minimum back to NULL ends the commitment;
    // it does not fall through to the older figure.
    if (r.monthly_minimum == null) continue;
    map.set(r.vendor_name as string, toNumber(r.monthly_minimum));
  }
  return map;
}

/**
 * Every vendor-month the window touches where a minimum is in force, with the
 * top-up it produces and whether that top-up counts.
 *
 * Returns the skipped months too, so a surface can say "August's floor has not
 * been applied because this window covers only part of it" rather than quietly
 * reporting a smaller number.
 */
export async function vendorMinimumMonths(opts: MinimumOpts): Promise<VendorMinimumMonth[]> {
  if (!(await anyVendorMinimum())) return [];

  const sql = getSql();
  const today = todayIST();
  const vendorCond = opts.vendor ? sql`AND v.vendor = ${opts.vendor}` : sql``;

  // Cost per vendor-month over the vendor's whole book. Sandbox is included:
  // whether the floor binds is a fact about the invoice, and the vendor
  // invoiced those calls too.
  const rows = await sql`
    SELECT v.vendor,
           to_char(date_trunc('month', v.date::date), 'YYYY-MM-DD') AS month_start,
           SUM(v.vendor_cost) AS flat_cost
    FROM usage_daily_with_revenue v
    WHERE v.date BETWEEN ${monthStartOf(opts.from)} AND ${monthEnd(monthStartOf(opts.to))}
      AND v.vendor IS NOT NULL AND v.vendor <> ''
      ${vendorCond}
    GROUP BY v.vendor, date_trunc('month', v.date::date)
  `;
  if ((rows as any[]).length === 0) return [];

  // Volume-priced pairs cost $0 in the per-day view; their real cost counts
  // toward the floor like any other. One call per month, at vendor grain.
  const volumeByMonth = new Map<string, Map<string, number>>();
  const months = [...new Set((rows as any[]).map((r) => r.month_start as string))];
  for (const m of months) {
    volumeByMonth.set(
      m,
      await vendorVolumeCostByVendor({
        from: m,
        to: monthEnd(m),
        vendor: opts.vendor,
        includeSandbox: true,
      })
    );
  }

  const minCache = new Map<string, Map<string, number>>();
  const out: VendorMinimumMonth[] = [];

  for (const r of rows as any[]) {
    const month = r.month_start as string;
    const end = monthEnd(month);
    let mins = minCache.get(end);
    if (!mins) {
      mins = await minimumsAsOf(end, opts.vendor);
      minCache.set(end, mins);
    }
    const minimum = mins.get(r.vendor as string);
    if (minimum == null) continue;

    const computed =
      toNumber(r.flat_cost) + (volumeByMonth.get(month)?.get(r.vendor as string) ?? 0);

    // The month must lie wholly inside the window AND be over. An in-progress
    // month has not finished running up its cost; a clipped month never will.
    const skipped: SkipReason | undefined =
      end > today ? "in_progress" : month < opts.from || end > opts.to ? "partial" : undefined;

    out.push({
      vendor: r.vendor as string,
      month,
      minimum,
      computed,
      top_up: Math.max(0, minimum - computed),
      applied: skipped === undefined,
      skipped,
    });
  }
  return out.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.month.localeCompare(b.month));
}

/** Applied top-up per vendor over the window. The figure a vendor row adds on. */
export async function vendorMinimumTopUpByVendor(opts: MinimumOpts): Promise<Map<string, number>> {
  const months = await vendorMinimumMonths(opts);
  const acc = new Map<string, Money>();
  for (const m of months) {
    if (!m.applied || m.top_up <= 0) continue;
    acc.set(m.vendor, (acc.get(m.vendor) ?? ZERO).plus(toMoney(m.top_up)));
  }
  const out = new Map<string, number>();
  for (const [k, v] of acc) out.set(k, toNumber(v));
  return out;
}

/** Applied top-up across every vendor. The figure the org KPI adds on. */
export async function vendorMinimumTopUpTotal(opts: MinimumOpts): Promise<number> {
  const byVendor = await vendorMinimumTopUpByVendor(opts);
  let total = ZERO;
  for (const v of byVendor.values()) total = total.plus(toMoney(v));
  return toNumber(total);
}

/** The commitment rows on file for one vendor, newest first — for the editor. */
export type VendorCommitmentRow = {
  id: number;
  effective_from: string;
  monthly_minimum: number | null;
  status: "estimated" | "quoted" | "contracted";
  source: string | null;
};

export async function vendorCommitments(vendor: string): Promise<VendorCommitmentRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT vc.id, vc.effective_from::text AS effective_from, vc.monthly_minimum,
           vc.status, vc.source
    FROM vendor_commitments vc
    JOIN vendors vd ON vd.id = vc.vendor_id
    WHERE lower(vd.canonical_name) = lower(${vendor})
    ORDER BY vc.effective_from DESC
  `;
  return (rows as any[]).map((r) => ({
    id: Number(r.id),
    effective_from: r.effective_from as string,
    monthly_minimum: r.monthly_minimum == null ? null : toNumber(r.monthly_minimum),
    status: r.status as VendorCommitmentRow["status"],
    source: (r.source as string | null) ?? null,
  }));
}
