import getSql from "../db";
import { cachedRevenueRead } from "../cache";
import { toNumber } from "../money";

/**
 * Reconciliation: what a vendor says it served against what Ledgerline counted.
 *
 * Two rules this module exists to enforce.
 *
 * 1. **In-progress hits are excluded on both sides.** `vendor_usage_report` has
 *    no in-progress column, so counting ours would show a permanent positive
 *    delta that is an artifact of the schema. In-progress volume alone can be
 *    large enough to create a false finding.
 *
 * 2. **Sandbox traffic counts.** The vendor invoices for a call whether or not
 *    Ledgerline bills a customer for it, so the comparison ignores
 *    `effective_is_sandbox` — the same rule `vendorConfidence` follows. This
 *    also means the comparison reads `usage_daily` directly rather than
 *    `usage_daily_with_revenue`: no revenue, pricing or bundle logic belongs
 *    in a volume check.
 *
 * A delta is rarely miscounting. Usually it is vendor volume with no customer
 * attribution behind it: calls we pay for and do not bill.
 */

/** Below this the delta is treated as agreement. */
export const DELTA_THRESHOLD_PCT = 2;

/**
 * A pair needs this many hits on its larger side before a percentage delta is
 * worth anyone's attention. Without it the queue fills with pairs like 3 hits
 * against 1 — a 200% delta and nothing to investigate. Stated in the UI so the
 * floor is a disclosed rule, not a hidden filter.
 */
export const MIN_HITS_FOR_FLAG = 50;

export type ReconRow = {
  vendor: string;
  /** Null for a vendor-side API name that matches nothing in the catalog. */
  api_code: string | null;
  api_name: string;
  /** The vendor's own name for it, always present. */
  raw_api_name: string;
  vendor_successful: number;
  vendor_no_data: number;
  vendor_failed: number;
  vendor_hits: number;
  our_successful: number;
  our_no_data: number;
  our_failed: number;
  our_hits: number;
  /** ours − vendor. Positive means we counted more than the vendor served. */
  delta_hits: number;
  /** delta as a percentage of the vendor's count. Null when the vendor reports none. */
  delta_pct: number | null;
  /**
   * The unreconciled hits priced at this vendor's rate for this API, when a
   * rate is known. Null when the rate is unknown — the gap exists either way,
   * but its cost does not become a number we can assert.
   */
  delta_cost: number | null;
  /** True when a dismissal covers this item for this month. */
  dismissed: boolean;
  dismissed_reason: string | null;
};

export type ReconSummary = {
  vendor_hits: number;
  our_hits: number;
  delta_hits: number;
  delta_pct: number | null;
  /** Items over the threshold and above the hit floor, excluding dismissed ones. */
  open_items: number;
  dismissed_items: number;
  /** Rupee value of open gaps where a rate is known. */
  open_delta_cost: number;
  /** Vendor-side rows whose API name matched nothing in the catalog. */
  unmatched_hits: number;
  /** Latest vendor-side date we hold, so the page can say how current it is. */
  vendor_data_through: string | null;
};

/** Over the threshold, above the floor, and not accepted for this month. */
export function isOpen(r: ReconRow): boolean {
  if (r.dismissed) return false;
  if (Math.max(r.vendor_hits, r.our_hits) < MIN_HITS_FOR_FLAG) return false;
  if (r.delta_pct == null) return r.our_hits >= MIN_HITS_FOR_FLAG;
  return Math.abs(r.delta_pct) > DELTA_THRESHOLD_PCT;
}

async function reconRowsImpl(from: string, to: string): Promise<ReconRow[]> {
  const sql = getSql();
  // A dismissal is scoped to the month it was accepted for; the window's month
  // is taken from its start date, so a month-aligned period matches exactly and
  // a custom range inherits the month it opens in.
  const rows = await sql`
    WITH vend AS (
      SELECT vendor,
             api_code,
             MAX(raw_api_name)        AS raw_api_name,
             SUM(successful)          AS v_s,
             SUM(successful_no_data)  AS v_snd,
             SUM(failed)              AS v_f
      FROM vendor_usage_daily
      WHERE date BETWEEN ${from} AND ${to}
      -- An unmatched name groups on itself; matched rows group on the code, so
      -- two vendor-side names mapped to one API reconcile as one item.
      GROUP BY vendor, api_code, CASE WHEN api_code IS NULL THEN raw_api_name ELSE '' END
    ),
    ours AS (
      SELECT vendor,
             api_code,
             SUM(successful)         AS o_s,
             SUM(successful_no_data) AS o_snd,
             SUM(failed)             AS o_f
      FROM usage_daily
      WHERE date BETWEEN ${from} AND ${to}
        AND vendor IS NOT NULL AND vendor <> ''
      GROUP BY vendor, api_code
    )
    SELECT
      COALESCE(v.vendor, o.vendor)      AS vendor,
      COALESCE(v.api_code, o.api_code)  AS api_code,
      COALESCE(a.name, v.raw_api_name, o.api_code, '—') AS api_name,
      COALESCE(v.raw_api_name, a.name, o.api_code, '—') AS raw_api_name,
      COALESCE(v.v_s, 0)    AS v_s,
      COALESCE(v.v_snd, 0)  AS v_snd,
      COALESCE(v.v_f, 0)    AS v_f,
      COALESCE(o.o_s, 0)    AS o_s,
      COALESCE(o.o_snd, 0)  AS o_snd,
      COALESCE(o.o_f, 0)    AS o_f,
      rate.cost_successful,
      rate.cost_successful_no_data,
      rate.cost_failed,
      d.reason              AS dismissed_reason,
      (d.id IS NOT NULL)    AS dismissed
    FROM vend v
    -- A vendor/API pair can exist on either side alone: the vendor served an
    -- API we never logged, or we attributed traffic to a vendor that reports
    -- none of it. Both are findings, so neither side may be dropped.
    FULL OUTER JOIN ours o
      ON o.vendor = v.vendor AND o.api_code IS NOT DISTINCT FROM v.api_code
    LEFT JOIN apis a ON a.product_code = COALESCE(v.api_code, o.api_code)
    -- The rate in force at the end of the window, one row only (a plain join
    -- would multiply the gap by the number of dated versions).
    LEFT JOIN LATERAL (
      SELECT vp.cost_successful, vp.cost_successful_no_data, vp.cost_failed
      FROM vendor_pricing vp
      WHERE vp.vendor_id = (
          SELECT vd.id FROM vendors vd
          WHERE lower(vd.canonical_name) = lower(COALESCE(v.vendor, o.vendor))
        )
        AND vp.api_code = COALESCE(v.api_code, o.api_code)
        AND vp.effective_from <= ${to}::date
      ORDER BY vp.effective_from DESC LIMIT 1
    ) rate ON true
    LEFT JOIN vendor_recon_dismissals d
      ON d.vendor = COALESCE(v.vendor, o.vendor)
     AND COALESCE(d.api_code, '') = COALESCE(v.api_code, o.api_code, '')
     AND COALESCE(d.raw_api_name, '') =
         CASE WHEN COALESCE(v.api_code, o.api_code) IS NULL
              THEN COALESCE(v.raw_api_name, '') ELSE '' END
     AND d.period_month = DATE_TRUNC('month', ${from}::date)::date
    ORDER BY COALESCE(v.vendor, o.vendor),
             ABS(COALESCE(v.v_s, 0) + COALESCE(v.v_snd, 0) + COALESCE(v.v_f, 0)
                 - COALESCE(o.o_s, 0) - COALESCE(o.o_snd, 0) - COALESCE(o.o_f, 0)) DESC
  `;

  return (rows as any[]).map((r) => {
    const v_s = Number(r.v_s ?? 0);
    const v_snd = Number(r.v_snd ?? 0);
    const v_f = Number(r.v_f ?? 0);
    const o_s = Number(r.o_s ?? 0);
    const o_snd = Number(r.o_snd ?? 0);
    const o_f = Number(r.o_f ?? 0);
    const vendor_hits = v_s + v_snd + v_f;
    const our_hits = o_s + o_snd + o_f;
    const c_s = r.cost_successful == null ? null : toNumber(r.cost_successful);
    const c_snd = r.cost_successful_no_data == null ? null : toNumber(r.cost_successful_no_data);
    const c_f = r.cost_failed == null ? null : toNumber(r.cost_failed);
    // Priced per outcome, because a vendor's rate differs per outcome and the
    // gap is rarely spread evenly across the three.
    const delta_cost =
      c_s == null
        ? null
        : (v_s - o_s) * c_s + (v_snd - o_snd) * (c_snd ?? 0) + (v_f - o_f) * (c_f ?? 0);
    return {
      vendor: r.vendor as string,
      api_code: (r.api_code as string | null) ?? null,
      api_name: r.api_name as string,
      raw_api_name: r.raw_api_name as string,
      vendor_successful: v_s,
      vendor_no_data: v_snd,
      vendor_failed: v_f,
      vendor_hits,
      our_successful: o_s,
      our_no_data: o_snd,
      our_failed: o_f,
      our_hits,
      delta_hits: our_hits - vendor_hits,
      delta_pct: vendor_hits > 0 ? ((our_hits - vendor_hits) / vendor_hits) * 100 : null,
      delta_cost,
      dismissed: !!r.dismissed,
      dismissed_reason: (r.dismissed_reason as string | null) ?? null,
    };
  });
}

/**
 * Summarise any slice of rows — the whole book, or one vendor's.
 *
 * Pure, so a per-vendor page can filter the cached org-wide `reconRows` and get
 * figures computed by exactly the same rules, without a second query or a
 * second definition of "open".
 */
export function summariseRecon(rows: ReconRow[]): Omit<ReconSummary, "vendor_data_through"> {
  const vendor_hits = rows.reduce((s, r) => s + r.vendor_hits, 0);
  const our_hits = rows.reduce((s, r) => s + r.our_hits, 0);
  const open = rows.filter(isOpen);
  return {
    vendor_hits,
    our_hits,
    delta_hits: our_hits - vendor_hits,
    delta_pct: vendor_hits > 0 ? ((our_hits - vendor_hits) / vendor_hits) * 100 : null,
    open_items: open.length,
    dismissed_items: rows.filter((r) => r.dismissed).length,
    // Only gaps the vendor is owed for count toward the figure — a negative
    // delta_cost means we counted more than the vendor served, which is not
    // money at stake.
    open_delta_cost: open.reduce((s, r) => s + Math.max(0, r.delta_cost ?? 0), 0),
    unmatched_hits: rows.filter((r) => r.api_code == null).reduce((s, r) => s + r.vendor_hits, 0),
  };
}

/** Last day of vendor-side data, or null when nothing has been synced. */
export async function vendorDataThrough(): Promise<string | null> {
  const sql = getSql();
  const [through] = await sql`SELECT MAX(date)::text AS d FROM vendor_usage_daily`;
  return ((through as any)?.d as string | null) ?? null;
}

async function reconSummaryImpl(from: string, to: string): Promise<ReconSummary> {
  const rows = await reconRows(from, to);
  return { ...summariseRecon(rows), vendor_data_through: await vendorDataThrough() };
}

/** Open item count for the sidebar badge, over the current window. */
async function reconOpenCountImpl(from: string, to: string): Promise<number> {
  const rows = await reconRows(from, to);
  return rows.filter(isOpen).length;
}

export const reconRows = cachedRevenueRead(reconRowsImpl, ["vendorReconRows"]);
export const reconSummary = cachedRevenueRead(reconSummaryImpl, ["vendorReconSummary"]);
export const reconOpenCount = cachedRevenueRead(reconOpenCountImpl, ["vendorReconOpenCount"]);
