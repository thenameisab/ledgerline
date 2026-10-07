import getSql from "../db";
import { isBilledPair } from "./statements";
import { toNumber } from "../money";
import type { Slab, VolumeModel } from "../pricing/slabs";

/** A volume-priced schedule: the model decides how its brackets are charged. */
export type VolumeSchedule = { model: VolumeModel; slabs: Slab[] };

/** A tier as edited/displayed in the UI — prices as plain numbers. */
export type SlabTier = {
  min_hits: number;
  max_hits: number | null;
  price_successful: number;
  price_successful_no_data: number;
  price_failed: number;
  price_in_progress: number;
};

export type PricingRow = {
  api_code: string;
  api_name: string;
  price_successful: number;
  price_successful_no_data: number;
  price_failed: number;
  price_in_progress: number;
  effective_from: string;
  billed: boolean;
  /**
   * 'flat' uses the four price_* fields; 'tier' (graduated) and 'slab'
   * (whole-volume) both price from `slabs` — they differ only in the math.
   */
  pricing_model: "flat" | "slab" | "tier";
  slabs: SlabTier[];
  /** Set on rows synthesized from usage: the pair has traffic but no pricing row. */
  unpriced?: boolean;
  first_used?: string;
  usage_hits?: number;
};

/**
 * Effective volume-priced schedules for an account's APIs, as of `asOf` (a
 * billing period is priced by the pricing row effective on/before its end date
 * — a mid-period model change is rare and resolves on the next derive). Returns
 * api_code → {model, brackets} for both 'tier' (graduated) and 'slab'
 * (whole-volume) rows; flat APIs are absent from the map.
 */
export async function getEffectiveSlabSchedules(
  accountId: number,
  asOf: string
): Promise<Map<string, VolumeSchedule>> {
  const sql = getSql();
  const rows = await sql`
    SELECT pe.api_code, pe.pricing_model, ps.min_hits, ps.max_hits,
           ps.price_successful, ps.price_successful_no_data,
           ps.price_failed, ps.price_in_progress
    FROM (
      SELECT DISTINCT ON (p.api_code) p.id, p.api_code, p.pricing_model
      FROM pricing p
      WHERE p.client_id = ${accountId} AND p.effective_from <= ${asOf}
      ORDER BY p.api_code, p.effective_from DESC
    ) pe
    JOIN pricing_slab ps ON ps.pricing_id = pe.id
    WHERE pe.pricing_model IN ('slab', 'tier')
    ORDER BY pe.api_code, ps.min_hits
  `;
  const map = new Map<string, VolumeSchedule>();
  for (const r of rows as any[]) {
    const tier: Slab = {
      min_hits: Number(r.min_hits),
      max_hits: r.max_hits == null ? null : Number(r.max_hits),
      price_successful: r.price_successful,
      price_successful_no_data: r.price_successful_no_data,
      price_failed: r.price_failed,
      price_in_progress: r.price_in_progress,
    };
    const entry = map.get(r.api_code);
    if (entry) entry.slabs.push(tier);
    else map.set(r.api_code, { model: r.pricing_model as VolumeModel, slabs: [tier] });
  }
  return map;
}

/**
 * APIs this account has recorded usage for but no pricing row at all — the
 * pairs behind the account page's revenue-leak callout. Surfaced in the
 * pricing editor as default rows so pricing them doesn't require a manual
 * "Add API" step.
 */
export async function getAccountUnpricedUsage(accountId: number): Promise<
  { api_code: string; api_name: string; hits: number; first_used: string }[]
> {
  const sql = getSql();
  const rows = await sql`
    SELECT u.api_code,
           COALESCE(a.name, u.api_code) AS api_name,
           SUM(u.successful + u.successful_no_data + u.failed + u.in_progress) AS hits,
           MIN(u.date) AS first_used
    FROM usage_daily u
    LEFT JOIN apis a ON a.product_code = u.api_code
    WHERE u.client_id = ${accountId} AND u.api_code IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pricing p
        WHERE p.client_id = ${accountId} AND p.api_code = u.api_code
      )
      AND NOT EXISTS (
        SELECT 1 FROM api_bundle_members bm
        WHERE bm.client_id = ${accountId} AND bm.api_code = u.api_code
      )
    GROUP BY u.api_code, a.name
    ORDER BY hits DESC
  `;
  return (rows as any[]).map((r) => ({
    api_code: r.api_code,
    api_name: r.api_name,
    hits: Number(r.hits ?? 0),
    first_used: r.first_used,
  }));
}

/**
 * Per-API traffic context for the pricing editor: a trailing daily hit series
 * (for the row sparkline) and trailing revenue, plus the account total. Sparklines
 * chart *hits*, not revenue — volume-priced (slab/tier) rows read ₹0 on this view
 * (revenue for those is resolved in deriveStatement), so a revenue trend would lie
 * for them; hit volume is always honest. Revenue is surfaced only as the trailing
 * total in the header, where flat + bundle pricing dominates and reads true.
 */
export type PricingContext = {
  windowDays: number;
  latestDate: string | null;
  /** Trailing-window revenue across the account's flat/bundle-priced traffic. */
  totalRevenue: number;
  /** api_code → { 14-day daily hit series (oldest→newest), trailing revenue }. */
  perApi: Record<string, { series: number[]; revenue: number }>;
};

const SPARK_DAYS = 14;
const WINDOW_DAYS = 30;

export async function getAccountPricingContext(accountId: number): Promise<PricingContext> {
  const sql = getSql();
  const rows = await sql`
    WITH bounds AS (
      SELECT MAX(date) AS maxd FROM usage_daily_with_revenue
      WHERE client_id = ${accountId} AND COALESCE(effective_is_sandbox, 0) = 0
    )
    SELECT v.api_code,
           v.date::text AS date,
           SUM(v.successful + v.successful_no_data + v.failed + v.in_progress)::bigint AS hits,
           SUM(v.revenue) AS revenue
    FROM usage_daily_with_revenue v, bounds
    WHERE v.client_id = ${accountId}
      AND v.api_code IS NOT NULL
      AND COALESCE(v.effective_is_sandbox, 0) = 0
      AND bounds.maxd IS NOT NULL
      AND v.date > bounds.maxd - (${WINDOW_DAYS} || ' days')::interval
    GROUP BY v.api_code, v.date
    ORDER BY v.api_code, v.date
  `;

  const parsed = (rows as any[]).map((r) => ({
    api_code: r.api_code as string,
    date: r.date as string,
    hits: Number(r.hits ?? 0),
    revenue: toNumber(r.revenue),
  }));

  const latestDate = parsed.reduce<string | null>(
    (m, r) => (m == null || r.date > m ? r.date : m),
    null
  );

  // Build the 14 sparkline slots as calendar days ending on latestDate, so gaps
  // (days with no traffic) read as zeros rather than collapsing the trend.
  const slotDates: string[] = [];
  if (latestDate) {
    const end = new Date(latestDate + "T00:00:00Z");
    for (let i = SPARK_DAYS - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - i);
      slotDates.push(d.toISOString().slice(0, 10));
    }
  }
  const slotIndex = new Map(slotDates.map((d, i) => [d, i]));

  const perApi: Record<string, { series: number[]; revenue: number }> = {};
  let totalRevenue = 0;
  for (const r of parsed) {
    const entry = (perApi[r.api_code] ??= { series: new Array(SPARK_DAYS).fill(0), revenue: 0 });
    entry.revenue += r.revenue;
    totalRevenue += r.revenue;
    const idx = slotIndex.get(r.date);
    if (idx !== undefined) entry.series[idx] += r.hits;
  }

  return { windowDays: WINDOW_DAYS, latestDate, totalRevenue, perApi };
}

/** One account × API price pair for the admin cross-account pricing view. */
export type PricingPair = {
  client_id: number;
  client_name: string;
  slug: string | null;
  api_code: string;
  api_name: string;
  price_successful: number;
  price_successful_no_data: number;
  price_failed: number;
  price_in_progress: number;
  pricing_model: "flat" | "slab" | "tier";
  effective_from: string | null;
  billed: boolean;
  unpriced: boolean;
  /** Only populated for unpriced pairs (the leak set). */
  hits: number;
  first_used: string | null;
};

/**
 * Every unpriced billable pair across all accounts — the rows behind the
 * dashboard's "Revenue leak" banner, listed so an admin can price them in one
 * view. The predicate MUST stay in sync with the leak count in
 * `getRiskSummary` (repos/usage.ts) — same zero-price / non-bundle /
 * non-volume / non-sandbox / not-dismissed definition, minus the date window
 * (this view is all-time, matching `getAccountUnpricedUsage`).
 */
export async function getUnpricedPairs(): Promise<PricingPair[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT v.client_id, c.slug, c.display_name AS client_name,
           v.api_code, COALESCE(a.name, v.api_code) AS api_name,
           SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits,
           MIN(v.date) AS first_used
    FROM usage_daily_with_revenue v
    JOIN clients c ON c.id = v.client_id
    LEFT JOIN apis a ON a.product_code = v.api_code
    WHERE v.client_id IS NOT NULL AND v.api_code IS NOT NULL
      AND v.p_s = 0 AND v.p_snd = 0 AND v.p_f = 0 AND v.p_ip = 0
      AND v.bundle_id IS NULL AND v.p_model NOT IN ('slab', 'tier')
      AND (v.successful + v.successful_no_data + v.failed + v.in_progress) > 0
      AND COALESCE(v.effective_is_sandbox, 0) = 0
      AND NOT EXISTS (
        SELECT 1 FROM leak_dismissals d
        WHERE d.client_id = v.client_id AND d.api_code = v.api_code
      )
    GROUP BY v.client_id, c.slug, c.display_name, v.api_code, a.name
    ORDER BY hits DESC
  `;
  return (rows as any[]).map((r) => ({
    client_id: Number(r.client_id),
    client_name: r.client_name,
    slug: r.slug,
    api_code: r.api_code,
    api_name: r.api_name,
    price_successful: 0,
    price_successful_no_data: 0,
    price_failed: 0,
    price_in_progress: 0,
    pricing_model: "flat" as const,
    effective_from: null,
    billed: false,
    unpriced: true,
    hits: Number(r.hits ?? 0),
    first_used: r.first_used,
  }));
}

/**
 * The latest effective price row per account × API across all accounts — the
 * "All" tab of the admin pricing view. Billed flags are resolved in bulk (one
 * query over finalized statement lines) rather than per pair.
 */
export async function getAllPricingPairs(): Promise<PricingPair[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT DISTINCT ON (p.client_id, p.api_code)
      p.client_id, c.slug, c.display_name AS client_name,
      p.api_code, COALESCE(a.name, p.api_code) AS api_name,
      p.price_successful, p.price_successful_no_data,
      p.price_failed, p.price_in_progress,
      p.pricing_model, p.effective_from
    FROM pricing p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN apis a ON a.product_code = p.api_code
    ORDER BY p.client_id, p.api_code, p.effective_from DESC
  `;
  const billedRows = await sql`
    SELECT DISTINCT s.client_id, sl.api_code
    FROM statement_lines sl
    JOIN statements s ON s.id = sl.statement_id
    WHERE s.status IN ('final', 'issued')
  `;
  const billed = new Set(
    (billedRows as any[]).map((r) => `${Number(r.client_id)}:${r.api_code}`)
  );
  return (rows as any[]).map((r) => ({
    client_id: Number(r.client_id),
    client_name: r.client_name,
    slug: r.slug,
    api_code: r.api_code,
    api_name: r.api_name,
    price_successful: toNumber(r.price_successful),
    price_successful_no_data: toNumber(r.price_successful_no_data),
    price_failed: toNumber(r.price_failed),
    price_in_progress: toNumber(r.price_in_progress),
    pricing_model: (r.pricing_model === "slab" || r.pricing_model === "tier"
      ? r.pricing_model
      : "flat") as "flat" | "slab" | "tier",
    effective_from: r.effective_from,
    billed: billed.has(`${Number(r.client_id)}:${r.api_code}`),
    unpriced: false,
    hits: 0,
    first_used: null,
  }));
}

export async function getAccountPricing(accountId: number): Promise<PricingRow[]> {
  const sql = getSql();
  // Latest effective price per API using DISTINCT ON (Postgres)
  const rows = await sql`
    SELECT DISTINCT ON (p.api_code)
      p.id,
      p.api_code,
      COALESCE(a.name, p.api_code) AS api_name,
      p.price_successful,
      p.price_successful_no_data,
      p.price_failed,
      p.price_in_progress,
      p.pricing_model,
      p.effective_from
    FROM pricing p
    LEFT JOIN apis a ON a.product_code = p.api_code
    WHERE p.client_id = ${accountId}
    ORDER BY p.api_code, p.effective_from DESC
  `;

  // Tiers for the slab rows in one round-trip, keyed by pricing row id.
  const slabRowIds = (rows as any[])
    .filter((r) => r.pricing_model === "slab" || r.pricing_model === "tier")
    .map((r) => Number(r.id));
  const tiersByPricingId = new Map<number, SlabTier[]>();
  if (slabRowIds.length > 0) {
    const tierRows = await sql`
      SELECT pricing_id, min_hits, max_hits,
             price_successful, price_successful_no_data, price_failed, price_in_progress
      FROM pricing_slab
      WHERE pricing_id = ANY(${slabRowIds})
      ORDER BY pricing_id, min_hits
    `;
    for (const t of tierRows as any[]) {
      const tier: SlabTier = {
        min_hits: Number(t.min_hits),
        max_hits: t.max_hits == null ? null : Number(t.max_hits),
        price_successful: toNumber(t.price_successful),
        price_successful_no_data: toNumber(t.price_successful_no_data),
        price_failed: toNumber(t.price_failed),
        price_in_progress: toNumber(t.price_in_progress),
      };
      const id = Number(t.pricing_id);
      const list = tiersByPricingId.get(id);
      if (list) list.push(tier);
      else tiersByPricingId.set(id, [tier]);
    }
  }

  const base = (rows as any[]).map((r) => ({
    api_code: r.api_code as string,
    api_name: r.api_name as string,
    price_successful: toNumber(r.price_successful),
    price_successful_no_data: toNumber(r.price_successful_no_data),
    price_failed: toNumber(r.price_failed),
    price_in_progress: toNumber(r.price_in_progress),
    pricing_model: (r.pricing_model === "slab" || r.pricing_model === "tier"
      ? r.pricing_model
      : "flat") as "flat" | "slab" | "tier",
    slabs: tiersByPricingId.get(Number(r.id)) ?? [],
    effective_from: r.effective_from as string,
    billed: false,
  }));

  const billedFlags = await Promise.all(
    base.map((r) => isBilledPair(accountId, r.api_code))
  );

  return base.map((r, i) => ({ ...r, billed: billedFlags[i] }));
}
