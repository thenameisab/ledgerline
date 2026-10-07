// Shared domain types returned by repo functions. Kept thin: each type
// describes a row a UI consumer should be able to render without re-querying.

export type DailySeriesRow = {
  date: string;
  revenue: number;
  // Null for viewers without cost access — see canViewCost().
  margin: number | null;
  vendor_cost: number | null;
  hits: number;
};

export type ActivityDay = {
  date: string;
  hits: number;
  revenue: number;
};

// Data-quality counts for the weekly product-update email. Vendor cost is not
// among them: `missing_vendor_cost` counted distinct APIs whose four cost
// columns were all zero, which after #119 could not tell an absent rate from a
// confirmed "not charged", and no surface ever read it. The corrected split —
// unrouted APIs vs unrated (vendor, API) pairs — lives in
// repos/vendor-cost.ts `costWorklist()`, beside the rate card that fixes them.
export type Alert = {
  kind: "unmapped_account" | "unmapped_api" | "unpriced";
  count: number;
  detail?: string;
};

// Quantified "money at risk" — health issues reframed as rupees, for the
// dashboard triage panel. `amount` is positive rupees at stake (a loss the
// business is incurring). `estimated` flags figures derived from an assumed
// rate rather than booked numbers (unpriced/unmapped traffic has no price by
// definition, so its value is modelled from the org's avg revenue-per-hit).
export type RiskItem = {
  kind: "revenue_leak" | "silent_loss" | "margin_watch";
  /** Primary count: pairs (leak/margin) or distinct raw names (silent loss). */
  count: number;
  /** Secondary count, used by silent_loss to split accounts vs APIs. */
  count2?: number;
  /** At-risk hit volume backing the figure. */
  hits: number;
  /** Rupees at risk (always positive). */
  amount: number;
  /** True when `amount` is modelled from avg rate, not booked. */
  estimated: boolean;
  /** Admin route that resolves this class of issue. */
  href: string;
};

export type RiskSummary = {
  items: RiskItem[];
  /** Sum of all item amounts. */
  total: number;
  /** True if any contributing item is estimated. */
  estimated: boolean;
  /** Avg revenue per billable hit used for estimates (for tooltip honesty). */
  rate: number;
};
