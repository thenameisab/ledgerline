import getSql from "../db";
import { cachedRevenueRead } from "../cache";
import { toNumber } from "../money";
import type { CostConfidence } from "../vendor-confidence";
import { vendorVolumeCostByApi, vendorVolumeCostByVendor } from "./vendor-volume-cost";
import { vendorMinimumTopUpByVendor } from "./vendor-minimum";

/**
 * Vendor cost reads for the rate card and the vendor list.
 *
 * Two rules this module exists to enforce:
 *
 * 1. **Cost comes from `usage_daily_with_revenue`, never from a direct join on
 *    `vendor_pricing`.** The view resolves the latest rate row effective on or
 *    before each usage day. A plain join matches every dated row for a pair, so
 *    the moment a rate has history the cost is counted once per version.
 *
 * 2. **A rate card is not a usage report.** It lists every (vendor, API) pair
 *    that is priced or has ever been served, so a rate can be entered before
 *    traffic arrives and a vendor with no traffic this period still opens.
 *    Traffic decides the numbers beside each row, not
 *    whether the row exists.
 */

// The shape and the confirmed/unconfirmed threshold live in lib/vendor-confidence
// so client components can import the helpers too. Re-exported here because
// every existing caller reads the type from this module.
export type { CostConfidence } from "../vendor-confidence";

export type VendorListRow = {
  vendor_id: number;
  vendor_name: string;
  /** A vendor we no longer send traffic to keeps its history and its page. */
  status: "active" | "inactive";
  /** APIs served in this period. */
  api_count: number;
  /** Pairs on the rate card, whether or not they had traffic. */
  rated_pairs: number;
  /** APIs served in this period whose rate is actually known. */
  priced_apis: number;
  total_hits: number;
  /** Includes the minimum top-up below, which no API row accounts for. */
  total_cost: number;
  /** What the monthly minimum added over and above metered cost. 0 when none. */
  minimum_top_up: number;
  confidence: CostConfidence;
};

async function listVendorsImpl(from: string, to: string): Promise<VendorListRow[]> {
  const sql = getSql();
  const rows = await sql`
    WITH usage AS (
      SELECT
        v.vendor AS vendor_name,
        COUNT(DISTINCT v.api_code)                                    AS api_count,
        COUNT(DISTINCT CASE WHEN COALESCE(v.vendor_cost_known, false)
                            THEN v.api_code END)                      AS priced_apis,
        SUM(v.successful + v.successful_no_data + v.failed + v.in_progress)                                      AS total_hits,
        SUM(v.vendor_cost)                                            AS total_cost,
        SUM(CASE WHEN COALESCE(v.vendor_cost_basis, 'vendor') <> 'vendor'
                   OR NOT v.vendor_billable
                 THEN v.successful + v.successful_no_data + v.failed + v.in_progress ELSE 0 END)                 AS hits_not_billed,
        SUM(CASE WHEN COALESCE(v.vendor_cost_known, false)
                  AND v.vendor_cost_status = 'contracted'
                  AND COALESCE(v.vendor_cost_basis, 'vendor') = 'vendor'
                  AND v.vendor_billable
                 THEN v.successful + v.successful_no_data + v.failed + v.in_progress ELSE 0 END)                 AS hits_contracted,
        SUM(CASE WHEN COALESCE(v.vendor_cost_known, false)
                  AND v.vendor_cost_status = 'quoted'
                  AND COALESCE(v.vendor_cost_basis, 'vendor') = 'vendor'
                  AND v.vendor_billable
                 THEN v.successful + v.successful_no_data + v.failed + v.in_progress ELSE 0 END)                 AS hits_quoted,
        SUM(CASE WHEN COALESCE(v.vendor_cost_known, false)
                  AND v.vendor_cost_status = 'estimated'
                  AND COALESCE(v.vendor_cost_basis, 'vendor') = 'vendor'
                  AND v.vendor_billable
                 THEN v.successful + v.successful_no_data + v.failed + v.in_progress ELSE 0 END)                 AS hits_estimated,
        SUM(CASE WHEN COALESCE(v.vendor_cost_known, false)
                 THEN 0 ELSE v.successful + v.successful_no_data + v.failed + v.in_progress END)                 AS hits_unknown
      FROM usage_daily_with_revenue v
      WHERE v.date BETWEEN ${from} AND ${to}
        AND v.vendor IS NOT NULL AND v.vendor <> ''
      GROUP BY v.vendor
    ),
    rated AS (
      SELECT vendor_id, COUNT(DISTINCT api_code) AS rated_pairs
      FROM vendor_pricing GROUP BY vendor_id
    )
    -- The registry is the list. Every vendor ever seen has a row in it,
    -- so a priced vendor with a quiet month, and a vendor recorded before its
    -- first hit arrives, are both reachable.
    SELECT
      vd.id                          AS vendor_id,
      vd.canonical_name              AS vendor_name,
      vd.status                      AS status,
      COALESCE(u.api_count, 0)       AS api_count,
      COALESCE(u.priced_apis, 0)     AS priced_apis,
      COALESCE(r.rated_pairs, 0)     AS rated_pairs,
      COALESCE(u.total_hits, 0)      AS total_hits,
      COALESCE(u.total_cost, 0)      AS total_cost,
      COALESCE(u.hits_not_billed, 0)  AS hits_not_billed,
      COALESCE(u.hits_contracted, 0) AS hits_contracted,
      COALESCE(u.hits_quoted, 0)     AS hits_quoted,
      COALESCE(u.hits_estimated, 0)  AS hits_estimated,
      COALESCE(u.hits_unknown, 0)    AS hits_unknown
    FROM vendors vd
    LEFT JOIN usage u ON u.vendor_name = vd.canonical_name
    LEFT JOIN rated r ON r.vendor_id = vd.id
    ORDER BY COALESCE(u.total_cost, 0) DESC, COALESCE(u.total_hits, 0) DESC,
             vd.canonical_name
  `;
  // A volume-priced pair costs $0 per day in the view — the month's bracket is
  // only decided by the month's total. Vendor surfaces count sandbox traffic,
  // because the vendor billed for it.
  //
  // A monthly minimum tops the vendor up to its floor. It belongs to no API, so
  // it lands on the vendor's total here and nowhere further down; a vendor whose
  // rows sum to less than its total is a vendor whose floor bound that month.
  const [volumeByVendor, minimumByVendor] = await Promise.all([
    vendorVolumeCostByVendor({ from, to, includeSandbox: true }),
    vendorMinimumTopUpByVendor({ from, to }),
  ]);
  return (rows as any[]).map((r) => ({
    vendor_id: Number(r.vendor_id),
    vendor_name: r.vendor_name as string,
    status: (r.status === "inactive" ? "inactive" : "active") as "active" | "inactive",
    api_count: Number(r.api_count ?? 0),
    rated_pairs: Number(r.rated_pairs ?? 0),
    priced_apis: Number(r.priced_apis ?? 0),
    total_hits: Number(r.total_hits ?? 0),
    total_cost:
      toNumber(r.total_cost) +
      (volumeByVendor.get(r.vendor_name as string) ?? 0) +
      (minimumByVendor.get(r.vendor_name as string) ?? 0),
    minimum_top_up: minimumByVendor.get(r.vendor_name as string) ?? 0,
    confidence: {
      hits: Number(r.total_hits ?? 0),
      contracted: Number(r.hits_contracted ?? 0),
      quoted: Number(r.hits_quoted ?? 0),
      estimated: Number(r.hits_estimated ?? 0),
      not_billed: Number(r.hits_not_billed ?? 0),
      unknown: Number(r.hits_unknown ?? 0),
    },
  }))
    // The SQL sorted on the uncorrected cost; a volume-priced vendor would sit
    // at the bottom of its own rate card list. Restore cost-desc.
    .sort(
      (a, b) =>
        b.total_cost - a.total_cost ||
        b.total_hits - a.total_hits ||
        a.vendor_name.localeCompare(b.vendor_name)
    );
}

export type RateStatus = "estimated" | "quoted" | "contracted";

/**
 * Where a pair's cost comes from.
 *
 * `vendor` is the default and means the four cost columns apply. The other two
 * both mean $0, and differ only in why: `in_house` because we served the call
 * ourselves and no invoice exists, `components` because the cost is real but
 * sits on the component APIs of a stitched or journey product and charging it
 * twice would double-count. Both count as *known* — a decided zero is an
 * answer, not a gap.
 */
export type CostBasis = "vendor" | "in_house" | "components";

/**
 * One bracket of a volume-priced vendor rate.
 *
 * `min_hits` is the exclusive lower bound, `max_hits` the inclusive cap with
 * NULL on the open-ended top bracket — the same shape as `pricing_slab`, so the
 * two sides read alike and share `lib/pricing/slabs.ts` unforked. The four
 * costs are nullable for the same reason the flat columns are: NULL is unknown,
 * 0 is confirmed not charged.
 */
export type VendorSlabTier = {
  min_hits: number;
  max_hits: number | null;
  cost_successful: number | null;
  cost_successful_no_data: number | null;
  cost_failed: number | null;
  cost_in_progress: number | null;
};

export type RateCardRow = {
  api_code: string;
  api_name: string;
  /** null means the rate is unknown; 0 means the vendor confirmed it does not charge. */
  cost_successful: number | null;
  cost_successful_no_data: number | null;
  cost_failed: number | null;
  cost_in_progress: number | null;
  /** Effective date of the rate in force today, or null when the pair has no row. */
  effective_from: string | null;
  status: RateStatus | null;
  source: string | null;
  /** Null when the pair has no rate row at all; otherwise never null. */
  cost_basis: CostBasis | null;
  /** `flat` means the four cost columns are the rates; the other two bracket. */
  pricing_model: "flat" | "slab" | "tier";
  /** The bracket set, empty on a flat row. */
  slabs: VendorSlabTier[];
  /** How many dated versions this pair has. 0 = no rate row at all. */
  versions: number;
  hits: number;
  successful: number;
  successful_no_data: number;
  failed: number;
  in_progress: number;
  period_cost: number;
};

/**
 * `vendor` is the canonical name. Every clause below resolves it to the
 * registry id first, so the rate rows, the traffic and the card are
 * joined on the vendor's identity rather than on three tables spelling it the
 * same way.
 */
async function rateCardImpl(vendor: string, from: string, to: string): Promise<RateCardRow[]> {
  const sql = getSql();
  const rows = await sql`
    WITH vend AS (
      SELECT id FROM vendors WHERE lower(canonical_name) = lower(${vendor})
    ),
    pairs AS (
      -- Priced pairs and ever-served pairs, so a rate can be set before
      -- traffic arrives and a pair that lost its rate row still shows.
      SELECT api_code FROM vendor_pricing WHERE vendor_id = (SELECT id FROM vend)
      UNION
      SELECT api_code FROM usage_daily
      WHERE vendor_id = (SELECT id FROM vend) AND api_code IS NOT NULL
    ),
    period AS (
      SELECT v.api_code,
             SUM(v.successful + v.successful_no_data + v.failed + v.in_progress)       AS hits,
             SUM(v.successful)              AS successful,
             SUM(v.successful_no_data)      AS successful_no_data,
             SUM(v.failed)                  AS failed,
             SUM(v.in_progress)             AS in_progress,
             SUM(v.vendor_cost)             AS period_cost
      FROM usage_daily_with_revenue v
      WHERE v.vendor = ${vendor} AND v.date BETWEEN ${from} AND ${to}
      GROUP BY v.api_code
    ),
    versions AS (
      SELECT api_code, COUNT(*) AS versions
      FROM vendor_pricing WHERE vendor_id = (SELECT id FROM vend)
      GROUP BY api_code
    )
    SELECT
      p.api_code,
      COALESCE(a.name, p.api_code)      AS api_name,
      cur.cost_successful,
      cur.cost_successful_no_data,
      cur.cost_failed,
      cur.cost_in_progress,
      cur.effective_from::text          AS effective_from,
      cur.status,
      cur.source,
      cur.cost_basis,
      COALESCE(cur.pricing_model, 'flat') AS pricing_model,
      COALESCE(br.brackets, '[]'::json) AS brackets,
      COALESCE(ver.versions, 0)         AS versions,
      COALESCE(pe.hits, 0)              AS hits,
      COALESCE(pe.successful, 0)        AS successful,
      COALESCE(pe.successful_no_data, 0) AS successful_no_data,
      COALESCE(pe.failed, 0)            AS failed,
      COALESCE(pe.in_progress, 0)       AS in_progress,
      COALESCE(pe.period_cost, 0)       AS period_cost
    FROM pairs p
    LEFT JOIN apis a ON a.product_code = p.api_code
    LEFT JOIN period pe ON pe.api_code = p.api_code
    LEFT JOIN versions ver ON ver.api_code = p.api_code
    -- The rate in force today is the one the editor edits.
    LEFT JOIN LATERAL (
      SELECT vp.* FROM vendor_pricing vp
      WHERE vp.vendor_id = (SELECT id FROM vend) AND vp.api_code = p.api_code
        AND vp.effective_from <= CURRENT_DATE
      ORDER BY vp.effective_from DESC LIMIT 1
    ) cur ON true
    -- Brackets hang off the rate row in force, so the editor opens on the same
    -- version the four cost cells above it are showing.
    LEFT JOIN LATERAL (
      SELECT json_agg(
               json_build_object(
                 'min_hits', vs.min_hits,
                 'max_hits', vs.max_hits,
                 'cost_successful', vs.cost_successful,
                 'cost_successful_no_data', vs.cost_successful_no_data,
                 'cost_failed', vs.cost_failed,
                 'cost_in_progress', vs.cost_in_progress
               ) ORDER BY vs.min_hits
             ) AS brackets
      FROM vendor_pricing_slab vs WHERE vs.vendor_pricing_id = cur.id
    ) br ON true
    ORDER BY COALESCE(pe.hits, 0) DESC, p.api_code
  `;
  // Same per-day blind spot as everywhere else: a bracketed rate costs $0 in
  // the view. Sandbox included — this is the vendor's own bill.
  const volumeByApi = await vendorVolumeCostByApi({ from, to, vendor, includeSandbox: true });
  const num = (v: unknown) => (v == null ? null : toNumber(v));
  return (rows as any[]).map((r) => ({
    api_code: r.api_code as string,
    api_name: r.api_name as string,
    cost_successful: num(r.cost_successful),
    cost_successful_no_data: num(r.cost_successful_no_data),
    cost_failed: num(r.cost_failed),
    cost_in_progress: num(r.cost_in_progress),
    effective_from: (r.effective_from as string | null) ?? null,
    status: (r.status as RateStatus | null) ?? null,
    source: (r.source as string | null) ?? null,
    cost_basis: (r.cost_basis as CostBasis | null) ?? null,
    pricing_model: (r.pricing_model === "slab" || r.pricing_model === "tier"
      ? r.pricing_model
      : "flat") as "flat" | "slab" | "tier",
    slabs: ((r.brackets ?? []) as any[]).map((b) => ({
      min_hits: Number(b.min_hits),
      max_hits: b.max_hits == null ? null : Number(b.max_hits),
      cost_successful: b.cost_successful == null ? null : Number(b.cost_successful),
      cost_successful_no_data:
        b.cost_successful_no_data == null ? null : Number(b.cost_successful_no_data),
      cost_failed: b.cost_failed == null ? null : Number(b.cost_failed),
      cost_in_progress: b.cost_in_progress == null ? null : Number(b.cost_in_progress),
    })),
    versions: Number(r.versions ?? 0),
    hits: Number(r.hits ?? 0),
    successful: Number(r.successful ?? 0),
    successful_no_data: Number(r.successful_no_data ?? 0),
    failed: Number(r.failed ?? 0),
    in_progress: Number(r.in_progress ?? 0),
    period_cost: toNumber(r.period_cost) + (volumeByApi.get(r.api_code as string) ?? 0),
  }));
}

/**
 * Cost confidence over any slice of the revenue view.
 *
 * One read behind every margin surface, so the coverage figure beside a margin
 * number always describes the same rows the margin was computed from. Callers
 * pass the filters their own revenue query used — most importantly
 * `includeSandbox`, which the org, account and API margin reads apply from the
 * global toggle. A confidence figure taken over a different population than
 * its margin is worse than none.
 *
 * Counted per usage day, so a rate that changed mid-period is attributed to
 * the days it actually applied to rather than to the whole window.
 */
export type CostConfidenceFilters = {
  from: string;
  to: string;
  vendor?: string;
  clientId?: number;
  apiCode?: string;
  /** Match the caller's revenue read. Vendor surfaces pass true: a vendor bills for sandbox traffic. */
  includeSandbox?: boolean;
};

async function costConfidenceImpl(f: CostConfidenceFilters): Promise<CostConfidence> {
  const sql = getSql();
  const sandboxCond = f.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const vendorCond = f.vendor ? sql`AND v.vendor = ${f.vendor}` : sql``;
  const clientCond = f.clientId != null ? sql`AND v.client_id = ${f.clientId}` : sql``;
  const apiCond = f.apiCode ? sql`AND v.api_code = ${f.apiCode}` : sql``;
  const [r] = await sql`
    SELECT
      SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits,
      -- A decided pair is counted once, as not_billed. Its status column is
      -- left over from the rebuild and says nothing about a rate it does not
      -- have, so the three status buckets exclude it. A sandbox hit on a
      -- vendor that has told us it does not charge for sandbox is the same
      -- kind of fact, and lands in the same bucket.
      SUM(CASE WHEN COALESCE(v.vendor_cost_basis, 'vendor') <> 'vendor'
                OR NOT v.vendor_billable
               THEN v.successful + v.successful_no_data + v.failed + v.in_progress ELSE 0 END) AS not_billed,
      SUM(CASE WHEN COALESCE(v.vendor_cost_known, false) AND v.vendor_cost_status = 'contracted'
                AND COALESCE(v.vendor_cost_basis, 'vendor') = 'vendor' AND v.vendor_billable
               THEN v.successful + v.successful_no_data + v.failed + v.in_progress ELSE 0 END) AS contracted,
      SUM(CASE WHEN COALESCE(v.vendor_cost_known, false) AND v.vendor_cost_status = 'quoted'
                AND COALESCE(v.vendor_cost_basis, 'vendor') = 'vendor' AND v.vendor_billable
               THEN v.successful + v.successful_no_data + v.failed + v.in_progress ELSE 0 END) AS quoted,
      SUM(CASE WHEN COALESCE(v.vendor_cost_known, false) AND v.vendor_cost_status = 'estimated'
                AND COALESCE(v.vendor_cost_basis, 'vendor') = 'vendor' AND v.vendor_billable
               THEN v.successful + v.successful_no_data + v.failed + v.in_progress ELSE 0 END) AS estimated,
      SUM(CASE WHEN COALESCE(v.vendor_cost_known, false)
               THEN 0 ELSE v.successful + v.successful_no_data + v.failed + v.in_progress END) AS unknown
    FROM usage_daily_with_revenue v
    WHERE v.date BETWEEN ${f.from} AND ${f.to}
    ${sandboxCond}
    ${vendorCond}
    ${clientCond}
    ${apiCond}
  `;
  const n = (k: string) => Number((r as any)?.[k] ?? 0);
  return {
    hits: n("hits"),
    contracted: n("contracted"),
    quoted: n("quoted"),
    estimated: n("estimated"),
    not_billed: n("not_billed"),
    unknown: n("unknown"),
  };
}

/**
 * Per-vendor confidence for the rate card and the vendor list. Includes
 * sandbox traffic, because the vendor invoices for it whether or not Ledgerline
 * bills the customer.
 */
async function vendorConfidenceImpl(
  vendor: string,
  from: string,
  to: string,
): Promise<CostConfidence> {
  return costConfidenceImpl({ vendor, from, to, includeSandbox: true });
}

/**
 * What is still costed blind, split by which fix it needs.
 *
 * Three rules:
 *
 *   - **It counts pairs, not APIs.** One API served by three vendors is three
 *     rates to find.
 *   - **It tells a zero rate from an absent one.** `c_s` is COALESCE'd to 0 in
 *     the view, so it uses `vendor_cost_known` instead.
 *   - **It separates two jobs.** An API with no vendor needs routing;
 *     a pair with a vendor and no rate needs a contract. They go to different
 *     people.
 *
 * Sandbox is excluded from both headline counts, because this is a worklist and
 * production pairs are what someone should price first. It is not excluded from
 * the exposure: a vendor bills a sandbox call whether or not Ledgerline bills a
 * customer for it, so the
 * sandbox-only share is carried as its own number rather than dropped silently.
 */
export type CostWorklist = {
  /** APIs with traffic and no vendor at all — nothing to look a rate up on. */
  unrouted_apis: number;
  unrouted_hits: number;
  /** (vendor, API) pairs with traffic and no known successful-hit rate. */
  unrated_pairs: number;
  unrated_hits: number;
  /** Of `unrated_pairs`, how many exist only in sandbox traffic and are excluded above. */
  sandbox_only_pairs: number;
  sandbox_only_hits: number;
};

async function costWorklistImpl(from: string, to: string): Promise<CostWorklist> {
  const sql = getSql();
  const [row] = await sql`
    WITH traffic AS (
      SELECT
        v.api_code,
        NULLIF(TRIM(COALESCE(v.vendor, '')), '') AS vendor,
        COALESCE(v.vendor_cost_known, false)     AS rate_known,
        COALESCE(v.effective_is_sandbox, 0)      AS sandbox,
        (v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits
      FROM usage_daily_with_revenue v
      WHERE v.date BETWEEN ${from} AND ${to}
        AND v.api_code IS NOT NULL
        AND (v.successful + v.successful_no_data + v.failed + v.in_progress) > 0
    ),
    -- A pair is sandbox-only when no production row for it carries traffic.
    unrated AS (
      SELECT vendor, api_code,
             SUM(hits)                                   AS hits,
             SUM(CASE WHEN sandbox = 0 THEN hits ELSE 0 END) AS prod_hits
      FROM traffic
      WHERE vendor IS NOT NULL AND NOT rate_known
      GROUP BY vendor, api_code
    )
    SELECT
      (SELECT COUNT(DISTINCT api_code) FROM traffic WHERE vendor IS NULL AND sandbox = 0)
        AS unrouted_apis,
      (SELECT COALESCE(SUM(hits), 0) FROM traffic WHERE vendor IS NULL AND sandbox = 0)
        AS unrouted_hits,
      (SELECT COUNT(*) FROM unrated WHERE prod_hits > 0)                        AS unrated_pairs,
      (SELECT COALESCE(SUM(prod_hits), 0) FROM unrated WHERE prod_hits > 0)     AS unrated_hits,
      (SELECT COUNT(*) FROM unrated WHERE prod_hits = 0)                        AS sandbox_only_pairs,
      (SELECT COALESCE(SUM(hits), 0) FROM unrated WHERE prod_hits = 0)          AS sandbox_only_hits
  `;
  const r = (row as any) ?? {};
  return {
    unrouted_apis: Number(r.unrouted_apis ?? 0),
    unrouted_hits: Number(r.unrouted_hits ?? 0),
    unrated_pairs: Number(r.unrated_pairs ?? 0),
    unrated_hits: Number(r.unrated_hits ?? 0),
    sandbox_only_pairs: Number(r.sandbox_only_pairs ?? 0),
    sandbox_only_hits: Number(r.sandbox_only_hits ?? 0),
  };
}

/**
 * The registry entry a name or one of its aliases refers to, or null.
 *
 * A vendor page exists because the vendor is in the registry, not because it
 * has rates or traffic. An alias
 * resolves here too, so a link saved under a vendor's former name still finds
 * it.
 */
export async function vendorByName(name: string): Promise<{
  id: number;
  canonical_name: string;
  status: "active" | "inactive";
  charges_sandbox: boolean;
} | null> {
  const sql = getSql();
  const [row] = await sql`
    SELECT v.id, v.canonical_name, v.status, v.charges_sandbox
    FROM vendor_aliases a
    JOIN vendors v ON v.id = a.vendor_id
    WHERE lower(a.alias) = lower(${name})
  `;
  if (!row) return null;
  const r = row as any;
  return {
    id: Number(r.id),
    canonical_name: r.canonical_name as string,
    status: r.status === "inactive" ? "inactive" : "active",
    charges_sandbox: r.charges_sandbox !== false,
  };
}

/**
 * Sandbox hits this vendor served in the window, and what they cost today.
 *
 * The figure beside the "charges for sandbox" control, so the switch is not
 * blind: it says how much traffic the answer moves. Counted over the vendor's
 * whole book, production excluded.
 */
export async function vendorSandboxHits(
  vendor: string,
  from: string,
  to: string,
): Promise<{ hits: number; cost: number }> {
  const sql = getSql();
  const [row] = await sql`
    SELECT COALESCE(SUM(v.successful + v.successful_no_data + v.failed + v.in_progress), 0) AS hits,
           COALESCE(SUM(v.vendor_cost), 0) AS cost
    FROM usage_daily_with_revenue v
    WHERE v.vendor = ${vendor} AND v.date BETWEEN ${from} AND ${to}
      AND COALESCE(v.effective_is_sandbox, 0) = 1
  `;
  return { hits: Number((row as any)?.hits ?? 0), cost: toNumber((row as any)?.cost ?? 0) };
}

export const listVendors = cachedRevenueRead(listVendorsImpl, ["listVendors"]);
export const rateCard = cachedRevenueRead(rateCardImpl, ["vendorRateCard"]);
export const vendorConfidence = cachedRevenueRead(vendorConfidenceImpl, ["vendorConfidence"]);
export const costConfidence = cachedRevenueRead(costConfidenceImpl, ["costConfidence"]);

/**
 * The same read, uncached.
 *
 * For callers that must not see a cached copy. `deriveStatement` is one: it is
 * the billing truth, recomputed live on every open, and finalize freezes what
 * it returns — freezing a cached reading would stamp a stale coverage figure
 * onto an invoice permanently. It also keeps `deriveStatement` callable from a
 * script, which `unstable_cache` otherwise prevents.
 */
export const costConfidenceLive = costConfidenceImpl;
export const costWorklist = cachedRevenueRead(costWorklistImpl, ["costWorklist"]);
