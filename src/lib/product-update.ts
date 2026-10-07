// Weekly product update snapshot — the data behind the product usage email
// (see lib/emails/product-update-email.ts and /api/cron/product-update-weekly).
// Its recipient list is in lib/repos/settings.ts.
//
// Window: the finished Mon–Sun week before `today`. Baseline: the week before
// that. Usage, not revenue — these emails report volume, health and movement;
// revenue stays in the roundups. Vendor cost and margin are admin-only and are
// never included.
//
// Reads reuse the cached repo layer where one exists, so this must run inside
// a Next request context.

import getSql from "./db";
import { getKpis, getDailySeries, getAlerts } from "./repos/usage";
import { getApiSummaries } from "./repos/apis";
import { getAccountSummaries } from "./repos/accounts";
import { getIncludeSandbox, type UpdateProduct } from "./repos/settings";
import { missingSyncDates } from "./repos/sync-runs";
import { todayIST, shiftISO, monthLabel, type DateRange } from "./repos/periods";

// ── Window ───────────────────────────────────────────────────────────────────

export type WeekWindow = {
  window: DateRange;
  prior: DateRange;
  label: string; // "25 Aug – 31 Aug"
  priorLabel: string; // "18 Aug – 24 Aug"
};

const DAY_SHORT = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const WEEKDAY_SHORT = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });

/** The finished Mon–Sun week before `today`, and the week before that. */
export function lastFullWeek(today: string): WeekWindow {
  const dow = new Date(today + "T00:00:00Z").getUTCDay(); // 0 = Sun
  const thisMonday = shiftISO(today, -((dow + 6) % 7));
  const window = { from: shiftISO(thisMonday, -7), to: shiftISO(thisMonday, -1) };
  const prior = { from: shiftISO(window.from, -7), to: shiftISO(window.to, -7) };
  return {
    window,
    prior,
    label: `${DAY_SHORT(window.from)} – ${DAY_SHORT(window.to)}`,
    priorLabel: `${DAY_SHORT(prior.from)} – ${DAY_SHORT(prior.to)}`,
  };
}

export type Delta = { value: number; prev: number; pct: number | null };

function delta(value: number, prev: number): Delta {
  return { value, prev, pct: prev > 0 ? ((value - prev) / prev) * 100 : null };
}

function domainOf(site: string | null): string | null {
  const d = (site ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
  return d || null;
}

// ── Usage update ──────────────────────────────────────────────────────────────

export type UsageUpdate = {
  product: "usage";
  week: WeekWindow;
  hits: Delta;
  successRate: { pct: number; prevPct: number | null };
  activeAccounts: Delta;
  apisUsed: Delta;
  outcomes: { successful: number; successful_no_data: number; failed: number; in_progress: number };
  /** One bar per day of the week. */
  daily: { label: string; hits: number }[];
  /** Bulk / Integration / Console split, with the prior week for comparison. */
  channels: { name: string; hits: number; prevHits: number; share: number }[];
  topApis: { code: string; name: string; hits: number; pct: number | null; accounts: number }[];
  topAccounts: { name: string; slug: string | null; domain: string | null; hits: number; pct: number | null }[];
  /** Traffic this week, none the week before. */
  newAccounts: { name: string; hits: number }[];
  /** Meaningful traffic last week, none this week. */
  quietAccounts: { name: string; prevHits: number }[];
  dataQuality: { unmappedAccounts: number; unmappedApis: number; unpricedPairs: number };
  /** Days in the window with no synced usage — the numbers above undercount if non-empty. */
  missingDays: string[];
};

const QUIET_FLOOR = 100; // ignore sub-100-hit accounts when calling "went quiet"

export async function buildUsageUpdate(todayOverride?: string): Promise<UsageUpdate> {
  const today = todayOverride ?? todayIST();
  const week = lastFullWeek(today);
  const includeSandbox = await getIncludeSandbox();
  const cur = { ...week.window, includeSandbox };
  const prev = { ...week.prior, includeSandbox };

  const [kpis, prevKpis, days, apis, prevApis, accounts, prevAccounts, alerts, missingDays] =
    await Promise.all([
      getKpis(cur),
      getKpis(prev),
      getDailySeries(cur),
      getApiSummaries(cur),
      getApiSummaries(prev),
      getAccountSummaries(cur),
      getAccountSummaries(prev),
      getAlerts(week.window),
      missingSyncDates({ ...week.window, cap: 7 }),
    ]);

  const successOf = (k: typeof kpis) => {
    const b = k.hit_breakdown;
    const total = b.successful + b.successful_no_data + b.failed + b.in_progress;
    return total > 0 ? ((b.successful + b.successful_no_data) / total) * 100 : null;
  };

  // Daily bars — fill every day so a missing day shows as 0, not a gap.
  const byDate = new Map(days.map((d) => [d.date, d.hits]));
  const daily: UsageUpdate["daily"] = [];
  for (let d = week.window.from; d <= week.window.to; d = shiftISO(d, 1)) {
    daily.push({ label: `${WEEKDAY_SHORT(d)} ${DAY_SHORT(d)}`, hits: byDate.get(d) ?? 0 });
  }

  // Channel mix (hits_via) — the revenue view carries the column; same sandbox rule.
  const sql = getSql();
  const sandboxCond = includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const channelRows = async (r: DateRange) =>
    (await sql`
      SELECT COALESCE(NULLIF(TRIM(v.hits_via), ''), 'Unknown') AS channel,
             SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits
      FROM usage_daily_with_revenue v
      WHERE v.date BETWEEN ${r.from} AND ${r.to}
      ${sandboxCond}
      GROUP BY 1
    `) as unknown as { channel: string; hits: string | number }[];
  const [chanCur, chanPrev] = await Promise.all([channelRows(week.window), channelRows(week.prior)]);
  const prevByChannel = new Map(chanPrev.map((r) => [r.channel, Number(r.hits)]));
  const channelTotal = chanCur.reduce((s, r) => s + Number(r.hits), 0);
  const channels = chanCur
    .map((r) => ({
      name: r.channel,
      hits: Number(r.hits),
      prevHits: prevByChannel.get(r.channel) ?? 0,
      share: channelTotal > 0 ? (Number(r.hits) / channelTotal) * 100 : 0,
    }))
    .sort((a, b) => b.hits - a.hits);

  // Top APIs by volume, week over week.
  const prevApiHits = new Map(prevApis.map((a) => [a.product_code, a.total_hits]));
  const topApis = apis
    .filter((a) => a.total_hits > 0)
    .sort((a, b) => b.total_hits - a.total_hits)
    .slice(0, 5)
    .map((a) => ({
      code: a.product_code,
      name: a.name,
      hits: a.total_hits,
      pct: delta(a.total_hits, prevApiHits.get(a.product_code) ?? 0).pct,
      accounts: a.unique_accounts,
    }));

  // Accounts: top by volume, newly active, and gone quiet.
  const prevByAccount = new Map(prevAccounts.map((c) => [c.client_id, c.hits]));
  const active = accounts.filter((c) => c.hits > 0).sort((a, b) => b.hits - a.hits);
  const top = active.slice(0, 5);
  const domains = new Map<number, string | null>();
  if (top.length > 0) {
    const rows = await sql`SELECT id, website FROM clients WHERE id = ANY(${top.map((c) => c.client_id)})`;
    for (const r of rows as any[]) domains.set(Number(r.id), domainOf(r.website));
  }
  const topAccounts = top.map((c) => ({
    name: c.display_name,
    slug: c.slug ?? null,
    domain: domains.get(c.client_id) ?? null,
    hits: c.hits,
    pct: delta(c.hits, prevByAccount.get(c.client_id) ?? 0).pct,
  }));
  const newAccounts = active
    .filter((c) => (prevByAccount.get(c.client_id) ?? 0) === 0)
    .slice(0, 5)
    .map((c) => ({ name: c.display_name, hits: c.hits }));
  const curByAccount = new Map(accounts.map((c) => [c.client_id, c.hits]));
  const quietAccounts = prevAccounts
    .filter((c) => c.hits >= QUIET_FLOOR && (curByAccount.get(c.client_id) ?? 0) === 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5)
    .map((c) => ({ name: c.display_name, prevHits: c.hits }));

  const alertCount = (kind: string) => alerts.find((a) => a.kind === kind)?.count ?? 0;

  return {
    product: "usage",
    week,
    hits: delta(kpis.total_hits, prevKpis.total_hits),
    successRate: { pct: successOf(kpis) ?? 0, prevPct: successOf(prevKpis) },
    activeAccounts: delta(kpis.active_accounts, prevKpis.active_accounts),
    apisUsed: delta(
      apis.filter((a) => a.total_hits > 0).length,
      prevApis.filter((a) => a.total_hits > 0).length
    ),
    outcomes: kpis.hit_breakdown,
    daily,
    channels,
    topApis,
    topAccounts,
    newAccounts,
    quietAccounts,
    dataQuality: {
      unmappedAccounts: alertCount("unmapped_account"),
      unmappedApis: alertCount("unmapped_api"),
      unpricedPairs: alertCount("unpriced"),
    },
    missingDays,
  };
}

export type ProductUpdate = UsageUpdate;

export async function buildProductUpdate(_product: UpdateProduct, todayOverride?: string): Promise<ProductUpdate> {
  return buildUsageUpdate(todayOverride);
}
