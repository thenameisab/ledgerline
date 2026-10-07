// Revenue roundup snapshots — the data behind the daily / weekly / monthly
// digest emails (see lib/emails/roundup-email.ts and /api/cron/roundup-*).
//
// Comparison semantics: billing periods are calendar months, so every window
// is compared against the SAME slice shifted one month back, day-of-month
// clamped (Jul 31 → Jun 30). Monthly degenerates to "previous full month".
//
// Revenue only — margin/vendor cost are deliberately absent (admin-only data
// stays out of email). Reads reuse the cached repo layer (slab/tier revenue is
// already folded in there), so this must run inside a Next request context.

import { getKpis, getDailySeries } from "./repos/usage";
import { getAccountSummaries } from "./repos/accounts";
import { getIncludeSandbox } from "./repos/settings";
import getSql from "./db";
import {
  todayIST,
  shiftISO,
  lastWeekRange,
  monthLabel,
  type DateRange,
} from "./repos/periods";
import type { RoundupKind } from "./repos/settings";

export type RoundupAccount = {
  name: string;
  slug: string | null;
  revenue: number;
  deltaPct: number | null; // vs the comparison window; null when no base
  domain: string | null; // for logo.dev; null → initials fallback
};

export type RoundupMover = { name: string; delta: number; revenue: number };

/** A revenue comparison against one baseline window. */
export type RoundupCompare = {
  label: string; // "20 June" | "14–20 June"
  revenue: number;
  deltaPct: number | null;
};

/** One account plotted on the growth quadrant (revenue × MoM growth). */
export type QuadrantAccount = {
  name: string;
  revenue: number;
  deltaPct: number | null;
  domain: string | null;
};

/** A slice of the concentration bar (a top account or the pooled remainder). */
export type ConcentrationSegment = {
  name: string;
  revenue: number;
  share: number; // 0–100, % of total window revenue
  domain: string | null;
  isOthers: boolean;
};

export type RoundupData = {
  kind: RoundupKind;
  periodLabel: string; // "Sunday, 20 July 2026" | "14–20 July 2026" | "June 2026"
  compareLabel: string; // "20 June" | "14–20 June" | "May 2026"
  window: DateRange;
  compare: DateRange;
  revenue: number;
  prevRevenue: number;
  deltaPct: number | null; // vs the month-ago window (primary baseline)
  /** Day-over-day / week-over-week baseline. Null for monthly (already period-over-period). */
  prior: RoundupCompare | null;
  hits: number;
  activeAccounts: number;
  avgPerHit: number;
  /** Successful (+ no-data) share of all hits, with the month-ago baseline. */
  successRate: { pct: number; prevPct: number | null };
  /** Daily only: month-to-date running total vs the same span last month. */
  mtd: { revenue: number; prevRevenue: number; deltaPct: number | null; label: string } | null;
  /** Bar-chart series. Daily: trailing 14 days. Weekly: the 7 days. Monthly: per week. */
  series: { label: string; revenue: number }[];
  topAccounts: RoundupAccount[];
  gainers: RoundupMover[];
  decliners: RoundupMover[];
  /** Revenue concentration: top accounts as shares of the window total + pooled remainder. */
  concentration: { segments: ConcentrationSegment[]; topShare: number };
  /** Growth quadrant points (revenue × MoM growth) + the median-revenue divide. */
  quadrant: { points: QuadrantAccount[]; median: number };
};

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Shift an ISO date by whole months, clamping the day (Jul 31 → Jun 30). */
export function shiftMonthClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const mm = String(first.getUTCMonth() + 1).padStart(2, "0");
  return `${first.getUTCFullYear()}-${mm}-${String(day).padStart(2, "0")}`;
}

const shiftRangeMonth = (r: DateRange, months: number): DateRange => ({
  from: shiftMonthClamped(r.from, months),
  to: shiftMonthClamped(r.to, months),
});

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

const DAY_SHORT = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const DAY_FULL = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

// ── Window resolution ────────────────────────────────────────────────────────

function resolveWindows(kind: RoundupKind, today: string): {
  window: DateRange;
  compare: DateRange; // primary (month-ago) baseline
  periodLabel: string;
  compareLabel: string;
  /** Day-over-day / week-over-week baseline; null for monthly. */
  prior: { range: DateRange; label: string } | null;
} {
  if (kind === "daily") {
    const day = shiftISO(today, -1);
    const window = { from: day, to: day };
    const compare = shiftRangeMonth(window, -1);
    const priorDay = shiftISO(day, -1);
    return {
      window,
      compare,
      periodLabel: DAY_FULL(day),
      compareLabel: DAY_SHORT(compare.from),
      prior: { range: { from: priorDay, to: priorDay }, label: DAY_SHORT(priorDay) },
    };
  }
  if (kind === "weekly") {
    // Previous full Mon–Sun week relative to `today`. lastWeekRange() is
    // anchored on the real clock; recompute here so a passed-in `today`
    // (tests, dry runs) behaves consistently.
    const dow = new Date(today + "T00:00:00Z").getUTCDay(); // 0 = Sun
    const daysSinceMonday = (dow + 6) % 7;
    const thisMonday = shiftISO(today, -daysSinceMonday);
    const window = { from: shiftISO(thisMonday, -7), to: shiftISO(thisMonday, -1) };
    const compare = shiftRangeMonth(window, -1);
    const priorWeek = { from: shiftISO(window.from, -7), to: shiftISO(window.to, -7) };
    return {
      window,
      compare,
      periodLabel: `${DAY_SHORT(window.from)} – ${DAY_SHORT(window.to)}`,
      compareLabel: `${DAY_SHORT(compare.from)} – ${DAY_SHORT(compare.to)}`,
      prior: { range: priorWeek, label: `${DAY_SHORT(priorWeek.from)} – ${DAY_SHORT(priorWeek.to)}` },
    };
  }
  // monthly: the finished month before `today`
  const firstOfThisMonth = `${today.slice(0, 7)}-01`;
  const from = shiftMonthClamped(firstOfThisMonth, -1);
  const to = shiftISO(firstOfThisMonth, -1);
  const window = { from, to };
  const compareFrom = shiftMonthClamped(firstOfThisMonth, -2);
  const compare = { from: compareFrom, to: shiftISO(from, -1) };
  return { window, compare, periodLabel: monthLabel(from), compareLabel: monthLabel(compareFrom), prior: null };
}

// ── Snapshot assembly ────────────────────────────────────────────────────────

export async function buildRoundupData(kind: RoundupKind, todayOverride?: string): Promise<RoundupData> {
  const today = todayOverride ?? todayIST();
  const { window, compare, periodLabel, compareLabel, prior } = resolveWindows(kind, today);
  const includeSandbox = await getIncludeSandbox();

  const [kpis, prevKpis, accounts, prevAccounts, priorKpis] = await Promise.all([
    getKpis({ ...window, includeSandbox }),
    getKpis({ ...compare, includeSandbox }),
    getAccountSummaries({ ...window, includeSandbox }),
    getAccountSummaries({ ...compare, includeSandbox }),
    prior ? getKpis({ ...prior.range, includeSandbox }) : Promise.resolve(null),
  ]);

  // Day-over-day / week-over-week baseline (daily + weekly only).
  const priorCompare: RoundupCompare | null =
    prior && priorKpis
      ? { label: prior.label, revenue: priorKpis.revenue, deltaPct: deltaPct(kpis.revenue, priorKpis.revenue) }
      : null;

  // Success rate = (successful + no-data) / all hits, matching ApiStatusChart.
  const successOf = (k: typeof kpis) => {
    const b = k.hit_breakdown;
    const total = b.successful + b.successful_no_data + b.failed + b.in_progress;
    return total > 0 ? ((b.successful + b.successful_no_data) / total) * 100 : null;
  };
  const successRate = {
    pct: successOf(kpis) ?? 0,
    prevPct: successOf(prevKpis),
  };

  // Daily gets extra context: the month so far vs the same span last month.
  let mtd: RoundupData["mtd"] = null;
  if (kind === "daily") {
    const mtdRangeWin = { from: `${window.to.slice(0, 7)}-01`, to: window.to };
    const [mtdKpis, prevMtdKpis] = await Promise.all([
      getKpis({ ...mtdRangeWin, includeSandbox }),
      getKpis({ ...shiftRangeMonth(mtdRangeWin, -1), includeSandbox }),
    ]);
    mtd = {
      revenue: mtdKpis.revenue,
      prevRevenue: prevMtdKpis.revenue,
      deltaPct: deltaPct(mtdKpis.revenue, prevMtdKpis.revenue),
      label: `${monthLabel(window.to)} so far`,
    };
  }

  // Bar-chart series.
  let series: { label: string; revenue: number }[];
  if (kind === "monthly") {
    // Bucket the month's days into calendar weeks (Mon-anchored).
    const days = await getDailySeries({ ...window, includeSandbox });
    const buckets = new Map<string, { label: string; revenue: number }>();
    for (const d of days) {
      const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
      const monday = shiftISO(d.date, -((dow + 6) % 7));
      const b = buckets.get(monday) ?? { label: `wk of ${DAY_SHORT(monday)}`, revenue: 0 };
      b.revenue += d.revenue;
      buckets.set(monday, b);
    }
    series = Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, v]) => v);
  } else {
    const from = kind === "daily" ? shiftISO(window.to, -13) : window.from;
    const days = await getDailySeries({ from, to: window.to, includeSandbox });
    const byDate = new Map(days.map((d) => [d.date, d.revenue]));
    series = [];
    for (let d = from; d <= window.to; d = shiftISO(d, 1)) {
      series.push({ label: DAY_SHORT(d), revenue: byDate.get(d) ?? 0 });
    }
  }

  // Top accounts (by window revenue) with per-account deltas + logo domains.
  const prevByAccount = new Map(prevAccounts.map((c) => [c.client_id, c.revenue]));
  const active = accounts.filter((c) => c.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  const top = active.slice(0, 5);
  // Growth quadrant plots the top-revenue accounts; cap for a readable email.
  const quadTop = active.slice(0, 12);

  // Fetch logo domains for every account we render (top list ∪ quadrant points).
  const domainIds = Array.from(new Set([...top, ...quadTop].map((c) => c.client_id)));
  const domains = new Map<number, string | null>();
  if (domainIds.length > 0) {
    const sql = getSql();
    const rows = await sql`SELECT id, website FROM clients WHERE id = ANY(${domainIds})`;
    for (const r of rows as any[]) {
      const site = (r.website as string | null) ?? "";
      const domain = site
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .trim();
      domains.set(Number(r.id), domain || null);
    }
  }

  const topAccounts: RoundupAccount[] = top.map((c) => ({
    name: c.display_name,
    slug: c.slug ?? null,
    revenue: c.revenue,
    deltaPct: deltaPct(c.revenue, prevByAccount.get(c.client_id) ?? 0),
    domain: domains.get(c.client_id) ?? null,
  }));

  // Concentration: top 5 as shares of the window total, remainder pooled.
  const totalRev = kpis.revenue;
  const concentrationSegments: ConcentrationSegment[] = top.map((c) => ({
    name: c.display_name,
    revenue: c.revenue,
    share: totalRev > 0 ? (c.revenue / totalRev) * 100 : 0,
    domain: domains.get(c.client_id) ?? null,
    isOthers: false,
  }));
  const topSum = top.reduce((s, c) => s + c.revenue, 0);
  const othersRev = Math.max(0, totalRev - topSum);
  if (othersRev > 0 && active.length > top.length) {
    concentrationSegments.push({
      name: `${active.length - top.length} other accounts`,
      revenue: othersRev,
      share: totalRev > 0 ? (othersRev / totalRev) * 100 : 0,
      domain: null,
      isOthers: true,
    });
  }
  const concentration = {
    segments: concentrationSegments,
    topShare: active.length > 0 && totalRev > 0 ? (active[0].revenue / totalRev) * 100 : 0,
  };

  // Growth quadrant: revenue × MoM growth. Divide on median revenue.
  const quadRevs = quadTop.map((c) => c.revenue).sort((a, b) => a - b);
  const quadMedian = quadRevs.length ? quadRevs[Math.floor(quadRevs.length / 2)] : 0;
  const quadrant = {
    median: quadMedian,
    points: quadTop.map((c) => ({
      name: c.display_name,
      revenue: c.revenue,
      deltaPct: deltaPct(c.revenue, prevByAccount.get(c.client_id) ?? 0),
      domain: domains.get(c.client_id) ?? null,
    })),
  };

  // Movers: biggest absolute revenue swings vs the comparison window.
  const MOVER_FLOOR = 100; // ignore sub-₹100 noise
  const moves: RoundupMover[] = [];
  const seen = new Set<number>();
  for (const c of accounts) {
    seen.add(c.client_id);
    const delta = c.revenue - (prevByAccount.get(c.client_id) ?? 0);
    if (Math.abs(delta) >= MOVER_FLOOR) moves.push({ name: c.display_name, delta, revenue: c.revenue });
  }
  for (const p of prevAccounts) {
    if (seen.has(p.client_id) || p.revenue < MOVER_FLOOR) continue;
    moves.push({ name: p.display_name, delta: -p.revenue, revenue: 0 });
  }
  const gainers = moves.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const decliners = moves.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);

  return {
    kind,
    periodLabel,
    compareLabel,
    window,
    compare,
    revenue: kpis.revenue,
    prevRevenue: prevKpis.revenue,
    deltaPct: deltaPct(kpis.revenue, prevKpis.revenue),
    prior: priorCompare,
    hits: kpis.total_hits,
    activeAccounts: kpis.active_accounts,
    avgPerHit: kpis.hit_breakdown.successful > 0 ? kpis.revenue / kpis.hit_breakdown.successful : 0,
    successRate,
    mtd,
    series,
    topAccounts,
    gainers,
    decliners,
    concentration,
    quadrant,
  };
}
