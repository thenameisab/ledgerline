import { formatMoney, formatNumber, formatPercent } from "./format";
import { formatShare, LOW_CONFIDENCE_PCT } from "./vendor-confidence";

// Deterministic briefing composer for v0.1.
// The interface (`composeAccountBriefing`, `composeApiBriefing`) is the seam
// for v0.2 where an LLM-backed implementation drops in. Keep input shapes
// stable; consumers should not branch on which composer is wired.

// v0.1: per-account margin / vendor_cost are intentionally absent. Margin
// requires vendor allocation we don't have; surfacing an estimated number
// at the per-account level is worse than omitting it. See V0.1_PLAN.md §3.1.
export type AccountBriefingInput = {
  display_name: string;
  is_sandbox: number;
  revenue: number;
  hits: number;
  apis_used: number;
  unpriced_pairs: number;
  unpriced_hits: number;
  top_api?: { name: string; revenue_share: number } | null;
  mom_revenue_delta_pct?: number | null;
};

export type ApiBriefingInput = {
  product_code: string;
  name: string;
  revenue: number;
  total_hits: number;
  unique_accounts: number;
  avg_unit_price: number;
  // Null for non-admin viewers — the margin sentence is then omitted entirely.
  margin: number | null;
  margin_pct: number | null;
  /**
   * Share of this API's hits whose vendor rate is known. Below
   * LOW_CONFIDENCE_PCT the margin clause states what is missing instead of
   * asserting a figure: prose cannot carry the coverage bar the Headline
   * shows, and an unqualified "margin sits at 100%" is the exact sentence the
   * confidence work exists to stop.
   */
  cost_confirmed_pct?: number | null;
  // Pricing variance across customers — max ÷ min (excluding zero-prices)
  price_min?: number | null;
  price_max?: number | null;
  // Top consumer concentration
  top_account?: { name: string; revenue_share: number } | null;
};

export interface BriefingComposer {
  composeAccountBriefing(input: AccountBriefingInput): string;
  composeApiBriefing(input: ApiBriefingInput): string;
}

export class DeterministicComposer implements BriefingComposer {
  composeAccountBriefing(o: AccountBriefingInput): string {
    if (o.is_sandbox) {
      return `${o.display_name} is a sandbox account. ${formatNumber(o.hits)} hits across ${o.apis_used} APIs this period — excluded from headline revenue and margin.`;
    }
    if (o.hits === 0) {
      return `${o.display_name} has no traffic this period. The account is configured but quiet — pricing rows exist for ${o.apis_used} APIs.`;
    }

    const sentences: string[] = [];

    // Sentence 1 — headline number + scale.
    sentences.push(
      o.revenue > 0
        ? `${o.display_name} drove ${formatMoney(o.revenue, { precision: 0 })} MTD across ${o.apis_used} API${o.apis_used === 1 ? "" : "s"} on ${formatNumber(o.hits)} hits.`
        : `${o.display_name} ran ${formatNumber(o.hits)} hits across ${o.apis_used} API${o.apis_used === 1 ? "" : "s"} but produced no billable revenue this period — likely missing pricing.`
    );

    // Margin sentence intentionally omitted at the per-account level — see type doc.

    // Sentence 2 — concentration risk if a single API dominates.
    if (o.top_api && o.top_api.revenue_share >= 60) {
      sentences.push(
        `${o.top_api.name} alone contributes ${formatPercent(o.top_api.revenue_share, 0)} of revenue — concentration to watch.`
      );
    }

    // Sentence 3 — leak warning.
    if (o.unpriced_pairs > 0) {
      sentences.push(
        `${o.unpriced_pairs} (account, api) pair${o.unpriced_pairs === 1 ? "" : "s"} have traffic but no pricing — ${formatNumber(o.unpriced_hits)} hits at risk if not configured.`
      );
    }

    // Sentence 4 — MoM delta when known.
    if (o.mom_revenue_delta_pct != null && Math.abs(o.mom_revenue_delta_pct) >= 5) {
      const dir = o.mom_revenue_delta_pct > 0 ? "up" : "down";
      sentences.push(
        `Pace is ${dir} ${formatPercent(Math.abs(o.mom_revenue_delta_pct), 0)} versus prior month.`
      );
    }

    return sentences.join(" ");
  }

  composeApiBriefing(o: ApiBriefingInput): string {
    if (o.total_hits === 0) {
      return `${o.name} (${o.product_code}) has no traffic this period.`;
    }

    const sentences: string[] = [];

    sentences.push(
      `${o.name} (${o.product_code}) ran ${formatNumber(o.total_hits)} hits across ${o.unique_accounts} account${o.unique_accounts === 1 ? "" : "s"}, generating ${formatMoney(o.revenue, { precision: 0 })} MTD.`
    );

    if (o.revenue > 0) {
      const price = `Average price is ₹${o.avg_unit_price.toFixed(2)} per successful hit`;
      // Margin is cost-gated; members get the price sentence without it.
      const lowConfidence =
        o.cost_confirmed_pct != null && o.cost_confirmed_pct < LOW_CONFIDENCE_PCT;
      sentences.push(
        o.margin == null || o.margin_pct == null
          ? `${price}.`
          : lowConfidence
          ? `${price}; margin is not measured — vendor cost is confirmed on ${formatShare(o.cost_confirmed_pct!)} of hits.`
          : `${price}; margin sits at ${formatPercent(o.margin_pct, 0)} (${formatMoney(o.margin, { precision: 0 })}).`
      );
    }

    if (
      o.price_min != null &&
      o.price_max != null &&
      o.price_min > 0 &&
      o.price_max / o.price_min >= 2
    ) {
      sentences.push(
        `Pricing varies widely across customers — ₹${o.price_min.toFixed(2)} to ₹${o.price_max.toFixed(2)} (${(o.price_max / o.price_min).toFixed(1)}× spread).`
      );
    }

    if (o.top_account && o.top_account.revenue_share >= 50) {
      sentences.push(
        `${o.top_account.name} alone contributes ${formatPercent(o.top_account.revenue_share, 0)} of revenue.`
      );
    }

    return sentences.join(" ");
  }
}

// Export the configured composer. v0.2: swap to LlmComposer behind env flag.
export const briefingComposer: BriefingComposer = new DeterministicComposer();
