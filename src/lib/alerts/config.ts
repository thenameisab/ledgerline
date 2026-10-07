// Alert rules and their thresholds (usage).
//
// The defaults below are tuned from a backtest over past usage, to keep the
// alert volume low. Admins can override any threshold or switch a rule off; the
// overrides are stored as JSON under the `alerts.config` app setting and merged
// over these defaults.

import type postgres from "postgres";

export type AlertSeverity = "critical" | "high" | "medium" | "info";

export type AlertGroup = "volume" | "failures" | "revenue" | "lifecycle" | "data";

/**
 * `track`: the alert stays open while the condition holds and closes itself
 * when the metric returns to normal. `once`: the alert records an event and
 * is never repeated for the same subject and period.
 */
export type AlertKind = "track" | "once";

export const ALERT_RULES = {
  A1: { group: "volume", kind: "track", label: "Account sent no traffic", desc: "A covered account has 0 units on a weekday on which it normally has traffic." },
  A2d: { group: "volume", kind: "track", label: "Account volume dropped (2 days)", desc: "A covered account's units are far below its same-weekday average on two days in a row." },
  A2w: { group: "volume", kind: "track", label: "Account weekly volume dropped", desc: "A covered account's last 7 days are far below its weekly average over the 4 weeks before." },
  A3: { group: "volume", kind: "track", label: "Account volume spiked", desc: "A covered account's units are a large multiple of its same-weekday average." },
  A4: { group: "volume", kind: "track", label: "Account stopped using a SKU", desc: "A SKU has 0 units for 2 days on which it normally has traffic, while the account's other SKUs continue." },
  A5: { group: "volume", kind: "track", label: "Platform volume dropped", desc: "Total units across all accounts are far below the same-weekday average. Per-account drop alerts are held that day." },
  A6: { group: "volume", kind: "track", label: "SKU volume dropped across accounts", desc: "One SKU's total units are far below average on 2 days in a row, with several accounts down." },
  B1: { group: "failures", kind: "track", label: "Failure rate rose for an account's SKU", desc: "An account's failed share for one SKU rose above its own 28-day rate. Held while the same SKU is failing across accounts (B2)." },
  B2: { group: "failures", kind: "track", label: "Failures rose across accounts (SKU or vendor)", desc: "The failed share for one SKU or one vendor rose in several accounts on the same day. Critical when the rise or the number of accounts is large." },
  B3: { group: "failures", kind: "track", label: "Units stuck in progress", desc: "A large share of an account's units for one SKU are still in progress." },
  B4: { group: "failures", kind: "track", label: "No-data share rose", desc: "The share of successful units that returned no data rose above the 28-day share." },
  B5: { group: "failures", kind: "track", label: "Platform success rate fell", desc: "Successful and no-data units, as a share of all units, fell below the 28-day rate." },
  C1: { group: "revenue", kind: "once", label: "Month behind last month's pace", desc: "A covered account's month-to-date revenue is well below the same days of last month. Once per account per month." },
  C2: { group: "revenue", kind: "once", label: "Month ahead of last month's pace", desc: "A covered account's month-to-date revenue is well above the same days of last month. Once per account per month." },
  C3: { group: "revenue", kind: "track", label: "Revenue fell 4 weeks in a row", desc: "A covered account's weekly revenue fell for 4 weeks in a row. Checked on Mondays." },
  C4: { group: "revenue", kind: "track", label: "Revenue rose 4 weeks in a row", desc: "A covered account's weekly revenue rose for 4 weeks in a row. Checked on Mondays." },
  C5: { group: "revenue", kind: "once", label: "Revenue per unit changed", desc: "A covered account's revenue per unit in the finished month differs from the month before. Checked on the 1st." },
  C6: { group: "revenue", kind: "once", label: "Volume tier reached", desc: "A volume-priced SKU reached a higher tier this month." },
  C7: { group: "revenue", kind: "once", label: "Revenue below vendor cost", desc: "An account's month-to-date revenue for one SKU is below its vendor cost." },
  C8: { group: "revenue", kind: "once", label: "Usage with no price", desc: "Billable units on an account and SKU pair that has no price. Once per pair." },
  D1: { group: "lifecycle", kind: "once", label: "First live traffic", desc: "An account sent billable traffic for the first time." },
  D2: { group: "lifecycle", kind: "once", label: "Started using a new SKU", desc: "An existing account started using a SKU, with enough units to count as real use." },
  D3: { group: "lifecycle", kind: "once", label: "Moved from sandbox to billable", desc: "An account and SKU pair with only sandbox traffic started billable traffic." },
  D4: { group: "lifecycle", kind: "once", label: "Active again after 30 days", desc: "An account sent traffic after a long period with none." },
  D5: { group: "lifecycle", kind: "once", label: "No traffic for 30 days", desc: "An account with real volume before has had no traffic for the whole period." },
  F1: { group: "data", kind: "once", label: "Usage not synced", desc: "Yesterday's usage had not loaded by 17:20 IST. Alerts for that date wait until it loads." },
  F2: { group: "data", kind: "once", label: "New unmapped name", desc: "The sync brought an account or SKU name that is not mapped." },
  F3: { group: "data", kind: "once", label: "Vendor reconciliation mismatches", desc: "At month end, vendor/SKU pairs whose vendor-reported units differ from Ledgerline's." },
} as const satisfies Record<string, { group: AlertGroup; kind: AlertKind; label: string; desc: string }>;

export const ALERT_GROUPS: { id: AlertGroup; label: string }[] = [
  { id: "volume", label: "Volume" },
  { id: "failures", label: "Failures" },
  { id: "revenue", label: "Revenue and trends" },
  { id: "lifecycle", label: "Account lifecycle" },
  { id: "data", label: "Data and operations" },
];

export type AlertRule = keyof typeof ALERT_RULES;

/**
 * The app setting that holds one group's email recipients, as a JSON array.
 * An empty or missing list turns that group's alert emails off.
 */
export const alertRecipientsKey = (group: AlertGroup) => `alerts.${group}.recipients`;

/** Once-only events close as expired when their usage date is this many days old. */
export const ONCE_EXPIRY_DAYS = 14;

export const ONCE_RULES = (Object.keys(ALERT_RULES) as AlertRule[]).filter(
  (r) => ALERT_RULES[r].kind === "once"
);

/** Ratios are fractions (0.5 = 50%). "Pts" values are fractions of a percentage (0.05 = 5 points). */
export const DEFAULT_THRESHOLDS = {
  /** Volume and revenue rules cover the largest accounts making up this share of last month's revenue. */
  coverageShare: 0.95,

  // A1 account sent no traffic
  silentMinBaseline: 20,
  silentMinActiveWeekdays: 3,
  // A2d account volume dropped, 2 days in a row
  dropDailyMinBaseline: 50,
  dropDailyRatio: 0.5,
  dropDailyClearRatio: 0.8,
  // A2w account weekly volume dropped
  dropWeeklyMinWeekly: 350,
  dropWeeklyRatio: 0.7,
  dropWeeklyClearRatio: 0.85,
  // A3 account volume spiked
  spikeMinBaseline: 20,
  spikeRatio: 3,
  spikeMinExtraHits: 500,
  spikeClearRatio: 2,
  // A4 account stopped using an API (2 days on which it normally has traffic)
  apiStopMinBaseline: 10,
  apiStopMinActiveWeekdays: 3,
  // A5 platform volume dropped
  platformDropRatio: 0.7,
  platformDropClearRatio: 0.85,
  // A6 API volume dropped across accounts, 2 days in a row
  apiDropMinBaseline: 200,
  apiDropRatio: 0.5,
  apiDropClearRatio: 0.8,
  apiDropMinAccounts: 3,
  apiDropAccountMinBaseline: 20,

  // B1 failure rate rose for an account's API (against its own 28-day rate)
  failRiseMinHits: 200,
  failRiseMinBaselineHits: 500,
  failRisePts: 0.05,
  failRiseClearPts: 0.02,
  // B2 failures rose across accounts, per API and per vendor
  outageMinBaselineHits: 1000,
  outageMinAccounts: 3,
  outageAccountMinHits: 50,
  outageAccountMinBaselineHits: 200,
  outageRisePts: 0.05,
  outageClearPts: 0.02,
  /** B2 is critical at this rise or at outageCriticalAccounts accounts; otherwise high. */
  outageCriticalPts: 0.2,
  outageCriticalAccounts: 5,
  // B3 hits stuck in progress
  stuckMinHits: 200,
  stuckShare: 0.05,
  stuckClearShare: 0.02,
  // B4 no-data share rose
  noDataMinHits: 200,
  noDataMinBaselineHits: 500,
  noDataRisePts: 0.15,
  noDataClearPts: 0.05,
  // B5 platform success rate fell
  successDropPts: 0.03,
  successClearPts: 0.01,

  // C1 / C2 month-to-date revenue against the same days last month
  paceFromDay: 10,
  paceDropRatio: 0.75,
  paceSpikeRatio: 1.5,
  // C3 / C4 weekly revenue fell or rose 4 weeks in a row
  trendMinChange: 0.2,
  // C5 revenue per hit, completed month against the month before
  revPerHitChange: 0.2,
  revPerHitMinHits: 1000,
  // C7 revenue below vendor cost, month to date
  belowCostFromDay: 7,
  belowCostMinCost: 5,
  // C8 billable usage with no price
  unpricedMinHits7d: 50,

  // D2 existing account started using a new API
  newApiMinHits: 100,
  newApiWithinDays: 14,
  newApiAccountAgeDays: 14,
  // D4 / D5 30 days without traffic
  silentDays: 30,
  inactivePriorMinHits: 1000,

  // F3 vendor reconciliation, per completed month
  reconMinHits: 500,
  reconMaxDiff: 0.02,
};

export type AlertThresholds = typeof DEFAULT_THRESHOLDS;

/**
 * How each threshold is shown and checked on the Settings page.
 *   share   a fraction shown as a percentage (0.5 → 50%)
 *   points  a fraction shown as percentage points (0.05 → 5 points)
 *   times   a multiple (3 → 3×)
 *   hits, rupees, count, days, dayOfMonth   plain numbers
 * `rules` lists every rule that reads the threshold; the page shows it under
 * the first one.
 */
export type ThresholdUnit = "share" | "points" | "times" | "hits" | "rupees" | "count" | "days" | "dayOfMonth";

export const THRESHOLD_META: Record<keyof typeof DEFAULT_THRESHOLDS, { rules: AlertRule[]; label: string; unit: ThresholdUnit }> = {
  coverageShare: { rules: ["A1", "A2d", "A2w", "A3", "A4", "C1", "C2", "C3", "C4", "C5"], label: "Covered accounts: the largest accounts making up this share of last month's revenue", unit: "share" },
  silentMinBaseline: { rules: ["A1"], label: "Minimum same-weekday average", unit: "hits" },
  silentMinActiveWeekdays: { rules: ["A1"], label: "Minimum same weekdays with traffic, of the last 4", unit: "count" },
  dropDailyMinBaseline: { rules: ["A2d"], label: "Minimum same-weekday average", unit: "hits" },
  dropDailyRatio: { rules: ["A2d"], label: "Opens at or below this share of the average", unit: "share" },
  dropDailyClearRatio: { rules: ["A2d"], label: "Closes at or above this share of the average", unit: "share" },
  dropWeeklyMinWeekly: { rules: ["A2w"], label: "Minimum weekly average", unit: "hits" },
  dropWeeklyRatio: { rules: ["A2w"], label: "Opens at or below this share of the weekly average", unit: "share" },
  dropWeeklyClearRatio: { rules: ["A2w"], label: "Closes at or above this share of the weekly average", unit: "share" },
  spikeMinBaseline: { rules: ["A3"], label: "Minimum same-weekday average", unit: "hits" },
  spikeRatio: { rules: ["A3"], label: "Opens at this multiple of the average", unit: "times" },
  spikeMinExtraHits: { rules: ["A3"], label: "Minimum units above the average", unit: "hits" },
  spikeClearRatio: { rules: ["A3"], label: "Closes below this multiple of the average", unit: "times" },
  apiStopMinBaseline: { rules: ["A4"], label: "Minimum same-weekday average for the SKU", unit: "hits" },
  apiStopMinActiveWeekdays: { rules: ["A4"], label: "Minimum same weekdays with traffic, of the last 4", unit: "count" },
  platformDropRatio: { rules: ["A5"], label: "Opens at or below this share of the average", unit: "share" },
  platformDropClearRatio: { rules: ["A5"], label: "Closes at or above this share of the average", unit: "share" },
  apiDropMinBaseline: { rules: ["A6"], label: "Minimum same-weekday average for the SKU", unit: "hits" },
  apiDropRatio: { rules: ["A6"], label: "Opens at or below this share of the average", unit: "share" },
  apiDropClearRatio: { rules: ["A6"], label: "Closes at or above this share of the average", unit: "share" },
  apiDropMinAccounts: { rules: ["A6"], label: "Minimum accounts down by the same share", unit: "count" },
  apiDropAccountMinBaseline: { rules: ["A6"], label: "Minimum same-weekday average for each of those accounts", unit: "hits" },
  failRiseMinHits: { rules: ["B1"], label: "Minimum units on the day", unit: "hits" },
  failRiseMinBaselineHits: { rules: ["B1"], label: "Minimum units in the 28 days before", unit: "hits" },
  failRisePts: { rules: ["B1"], label: "Opens at this rise over the 28-day rate", unit: "points" },
  failRiseClearPts: { rules: ["B1"], label: "Closes when the rise is below", unit: "points" },
  outageMinBaselineHits: { rules: ["B2"], label: "Minimum units for the SKU or vendor in the 28 days before", unit: "hits" },
  outageMinAccounts: { rules: ["B2"], label: "Minimum accounts with a rise", unit: "count" },
  outageAccountMinHits: { rules: ["B2"], label: "Minimum units for each account on the day", unit: "hits" },
  outageAccountMinBaselineHits: { rules: ["B2"], label: "Minimum units for each account in the 28 days before", unit: "hits" },
  outageRisePts: { rules: ["B2"], label: "Opens at this rise over the 28-day rate", unit: "points" },
  outageClearPts: { rules: ["B2"], label: "Closes when the rise is below", unit: "points" },
  outageCriticalPts: { rules: ["B2"], label: "Critical at this rise (otherwise high)", unit: "points" },
  outageCriticalAccounts: { rules: ["B2"], label: "Critical at this many accounts (otherwise high)", unit: "count" },
  stuckMinHits: { rules: ["B3"], label: "Minimum units on the day", unit: "hits" },
  stuckShare: { rules: ["B3"], label: "Opens at this share of units in progress", unit: "share" },
  stuckClearShare: { rules: ["B3"], label: "Closes below this share", unit: "share" },
  noDataMinHits: { rules: ["B4"], label: "Minimum units on the day", unit: "hits" },
  noDataMinBaselineHits: { rules: ["B4"], label: "Minimum units in the 28 days before", unit: "hits" },
  noDataRisePts: { rules: ["B4"], label: "Opens at this rise over the 28-day share", unit: "points" },
  noDataClearPts: { rules: ["B4"], label: "Closes when the rise is below", unit: "points" },
  successDropPts: { rules: ["B5"], label: "Opens at this fall below the 28-day rate", unit: "points" },
  successClearPts: { rules: ["B5"], label: "Closes when the fall is below", unit: "points" },
  paceFromDay: { rules: ["C1", "C2"], label: "First day of the month to check", unit: "dayOfMonth" },
  paceDropRatio: { rules: ["C1"], label: "Opens at or below this share of last month", unit: "share" },
  paceSpikeRatio: { rules: ["C2"], label: "Opens at this multiple of last month", unit: "times" },
  trendMinChange: { rules: ["C3", "C4"], label: "Minimum total change over the 4 weeks", unit: "share" },
  revPerHitChange: { rules: ["C5"], label: "Minimum change in revenue per unit", unit: "share" },
  revPerHitMinHits: { rules: ["C5"], label: "Minimum units in each month", unit: "hits" },
  belowCostFromDay: { rules: ["C7"], label: "First day of the month to check", unit: "dayOfMonth" },
  belowCostMinCost: { rules: ["C7"], label: "Minimum vendor cost, month to date", unit: "rupees" },
  unpricedMinHits7d: { rules: ["C8"], label: "Minimum unpriced units in 7 days", unit: "hits" },
  newApiMinHits: { rules: ["D2"], label: "Minimum units since first use", unit: "hits" },
  newApiWithinDays: { rules: ["D2"], label: "Reached within this many days of first use", unit: "days" },
  newApiAccountAgeDays: { rules: ["D2"], label: "Account active at least this many days before", unit: "days" },
  silentDays: { rules: ["D4", "D5"], label: "Days without traffic", unit: "days" },
  inactivePriorMinHits: { rules: ["D5"], label: "Minimum units in the 60 days before the silence", unit: "hits" },
  reconMinHits: { rules: ["F3"], label: "Minimum units for a vendor/SKU pair in the month", unit: "hits" },
  reconMaxDiff: { rules: ["F3"], label: "Allowed difference", unit: "share" },
};

/** Returns an error message for an out-of-range value, or null. Values are in stored form. */
export function thresholdError(key: keyof typeof DEFAULT_THRESHOLDS, v: number): string | null {
  const { unit } = THRESHOLD_META[key];
  if (!Number.isFinite(v) || v < 0) return "Enter a number of 0 or more.";
  if ((unit === "share" || unit === "points") && v > 1) return "Enter a value from 0 to 100.";
  if (unit === "times" && v <= 0) return "Enter a multiple above 0.";
  if ((unit === "count" || unit === "days" || unit === "dayOfMonth") && !Number.isInteger(v)) return "Enter a whole number.";
  if (unit === "dayOfMonth" && (v < 1 || v > 28)) return "Enter a day from 1 to 28.";
  if (unit === "days" && v < 1) return "Enter at least 1 day.";
  // The loader keeps 95 days of history, and D5 reads 60 days before the silence.
  if (unit === "days" && v > 30 && key === "silentDays") return "Enter at most 30 days.";
  if (unit === "days" && v > 60) return "Enter at most 60 days.";
  return null;
}

export type AlertConfig = {
  enabled: Record<AlertRule, boolean>;
  t: AlertThresholds;
};

export const ALERT_CONFIG_KEY = "alerts.config";

export function defaultAlertConfig(): AlertConfig {
  const enabled = {} as Record<AlertRule, boolean>;
  for (const r of Object.keys(ALERT_RULES) as AlertRule[]) enabled[r] = true;
  return { enabled, t: { ...DEFAULT_THRESHOLDS } };
}

/**
 * Defaults merged with the admin overrides. Reads the setting directly rather
 * than through the cached settings helper, so the backtest script can run it
 * outside Next.
 */
export async function loadAlertConfig(sql: postgres.Sql): Promise<AlertConfig> {
  const cfg = defaultAlertConfig();
  const [row] = await sql`SELECT value FROM app_settings WHERE key = ${ALERT_CONFIG_KEY}`;
  if (!row) return cfg;
  let saved: { enabled?: Partial<Record<string, boolean>>; thresholds?: Partial<Record<string, number>> };
  try {
    saved = JSON.parse(row.value as string);
  } catch {
    return cfg;
  }
  for (const [r, on] of Object.entries(saved.enabled ?? {})) {
    if (r in cfg.enabled && typeof on === "boolean") cfg.enabled[r as AlertRule] = on;
  }
  for (const [k, v] of Object.entries(saved.thresholds ?? {})) {
    if (k in cfg.t && typeof v === "number" && Number.isFinite(v)) (cfg.t as Record<string, number>)[k] = v;
  }
  return cfg;
}
