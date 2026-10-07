// Compact single-entity summaries for the rich hover cards (account/API name
// hovers). Deliberately thin wrappers over the existing cached summary reads —
// getAccountSummaries / getApiSummaries already compute every field a card
// needs (revenue, hits, sparkline, top APIs, unpriced state, slab-corrected
// revenue), and reusing them keeps the hover numbers identical to the lists
// instead of forking a second, drifting query. The window is always the
// dashboard default (MTD, or last full month early in a month) — a hover is a
// quick glance, not a period-scoped report.

import { defaultRange, monthLabel } from "./periods";
import { generateSlug } from "../slug";
import { getAccountSummaries, type AccountTopApi } from "./accounts";
import { costConfidence } from "./vendor-cost";
import type { CostConfidence } from "../vendor-confidence";
import { getApiSummaries, getApiTopConsumer } from "./apis";
import type { StatusKind } from "@/components/chips/StatusChip";

export type AccountHoverCard = {
  accountId: number;
  name: string;
  slug: string;
  hasLogo: boolean;
  group: string | null;
  status: StatusKind;
  periodLabel: string;
  revenue: number;
  hits: number;
  apisUsed: number;
  activeDays: number;
  unpricedPairs: number;
  unpricedHits: number;
  spark: number[];
  topApis: AccountTopApi[];
};

export type ApiHoverCard = {
  productCode: string;
  name: string;
  category: string;
  vendorType: string;
  /** What one billed unit is, e.g. "1M tokens". */
  unit: string;
  periodLabel: string;
  revenue: number;
  hits: number;
  uniqueAccounts: number;
  avgUnitPrice: number;
  margin: number | null;
  /**
   * Coverage behind `margin`. Null when the viewer sees no cost. The card has
   * no room for a confidence bar, so this only decides whether the margin
   * renders in the muted token — the same rule every other margin follows.
   */
  costConfidence: CostConfidence | null;
  vendorBreakdown: { vendor: string; hits: number }[];
  topConsumer: { name: string; revenue: number; share: number } | null;
};

export async function getAccountHoverCard(slug: string): Promise<AccountHoverCard | null> {
  const period = defaultRange();
  const summaries = await getAccountSummaries(period);
  const c = summaries.find(
    (s) => (s.slug ?? generateSlug(s.display_name)) === slug
  );
  if (!c) return null;
  return {
    accountId: c.client_id,
    name: c.display_name,
    slug: c.slug ?? generateSlug(c.display_name),
    hasLogo: c.has_logo,
    group: c.group_name,
    status: c.status_pill,
    periodLabel: monthLabel(period.from),
    revenue: c.revenue,
    hits: c.hits,
    apisUsed: c.apis_used,
    activeDays: c.active_days,
    unpricedPairs: c.active_unpriced_pairs,
    unpricedHits: c.active_unpriced_hits,
    spark: c.spark,
    topApis: c.top_apis.slice(0, 4),
  };
}

export async function getApiHoverCard(
  code: string,
  includeCost: boolean
): Promise<ApiHoverCard | null> {
  const period = defaultRange();
  // Same window and the same sandbox rule getApiSummaries uses, so the
  // coverage describes the rows the margin was computed from.
  const [summaries, topConsumer, confidence] = await Promise.all([
    getApiSummaries({ ...period, includeCost, includeAllCatalog: true }),
    getApiTopConsumer(code, period),
    includeCost
      ? costConfidence({ ...period, apiCode: code, includeSandbox: false })
      : Promise.resolve(null),
  ]);
  const a = summaries.find((s) => s.product_code === code);
  if (!a) return null;
  return {
    productCode: a.product_code,
    name: a.name,
    category: a.category,
    vendorType: a.vendor_type,
    unit: a.unit,
    periodLabel: monthLabel(period.from),
    revenue: a.revenue,
    hits: a.total_hits,
    uniqueAccounts: a.unique_accounts,
    avgUnitPrice: a.avg_unit_price,
    margin: a.margin,
    costConfidence: confidence,
    vendorBreakdown: a.vendor_breakdown.slice(0, 3),
    topConsumer,
  };
}
