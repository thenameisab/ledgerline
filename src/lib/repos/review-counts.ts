// Open-work counts for the sidebar's Review section.
//
// These render on every page, so cost matters. Two reads:
//
//   - The usage-derived three (unmapped names, unmatched API codes, unpriced
//     pairs) come from one statement wrapped in cachedRevenueRead. They all
//     read usage_daily / usage_daily_with_revenue, and every write that can
//     move them (a sync, an alias mapping, a price, a catalog rename) already
//     calls revalidateRevenue().
//
//   - Alerts needing attention is a count over the alerts table, uncached for
//     the same reason as approvals: acknowledging one must drop the badge.
//
//   - Pending approvals is a single-row count over a tiny table that is *not*
//     covered by the revenue tag (filing a merge request changes no usage), so
//     it stays uncached — a stale approvals badge would be a lie.
//
// The API review badge deliberately counts only the two blocking problems
// (unknown codes, missing codes) and not name drift, which the page itself
// lists as advisory — a badge that never reaches zero stops meaning anything.

import getSql from "../db";
import { cachedRevenueRead } from "../cache";
import { alertAttentionCount } from "./alerts";

export type ReviewCounts = {
  aliases: number;
  apiReview: number;
  unpriced: number;
  approvals: number;
  alerts: number;
};

const usageCounts = cachedRevenueRead(async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT
      (SELECT COUNT(DISTINCT raw_client_name) FROM usage_daily WHERE client_id IS NULL)
        AS unmapped_accounts,
      (SELECT COUNT(DISTINCT raw_api_name) FROM usage_daily WHERE api_code IS NULL)
        AS unmapped_apis,
      (SELECT COUNT(DISTINCT raw_api_code) FROM usage_daily
        WHERE api_code IS NULL AND raw_api_code IS NOT NULL AND raw_api_code <> '')
        AS unknown_codes,
      (SELECT COUNT(DISTINCT raw_api_name) FROM usage_daily
        WHERE api_code IS NULL AND (raw_api_code IS NULL OR raw_api_code = ''))
        AS no_code_names,
      (SELECT COUNT(*) FROM (
        SELECT 1
        FROM usage_daily_with_revenue v
        WHERE v.client_id IS NOT NULL AND v.api_code IS NOT NULL
          AND v.p_s = 0 AND v.p_snd = 0 AND v.p_f = 0 AND v.p_ip = 0
          AND v.bundle_id IS NULL AND v.p_model NOT IN ('slab', 'tier')
          AND (v.successful + v.successful_no_data + v.failed + v.in_progress) > 0
          AND COALESCE(v.effective_is_sandbox, 0) = 0
          AND NOT EXISTS (
            SELECT 1 FROM leak_dismissals d
            WHERE d.client_id = v.client_id AND d.api_code = v.api_code
          )
        GROUP BY v.client_id, v.api_code
      ) pairs) AS unpriced
  `;
  const r = (rows as any[])[0] ?? {};
  return {
    aliases: Number(r.unmapped_accounts ?? 0) + Number(r.unmapped_apis ?? 0),
    apiReview: Number(r.unknown_codes ?? 0) + Number(r.no_code_names ?? 0),
    unpriced: Number(r.unpriced ?? 0),
  };
}, ["review-counts"]);

export async function getReviewCounts(): Promise<ReviewCounts> {
  const sql = getSql();
  const [usage, pending, alerts] = await Promise.all([
    usageCounts(),
    sql`SELECT COUNT(*) AS n FROM client_operations WHERE status = 'pending'`,
    alertAttentionCount(),
  ]);
  return {
    ...usage,
    approvals: Number((pending as any[])[0]?.n ?? 0),
    alerts,
  };
}
