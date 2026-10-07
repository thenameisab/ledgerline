// Alert rules: evaluates one usage date against the loaded series.
//
// No I/O. The caller passes the open alerts (`state.open`) and the keys of
// once-only alerts already raised (`state.seen`). evaluateDay updates both
// sets in place and returns what changed, so a caller can evaluate a run of
// dates in order (the backtest) or one date and persist it (the cron).
//
// Baselines: daily rules compare with the average of the same weekday over the
// previous 4 weeks, which absorbs the weekend dip. Rate rules compare with the
// 28 days before.

import { type AlertConfig, type AlertRule, type AlertSeverity } from "./config";
import type { AlertData, Series } from "./data";
import { formatDate, formatMoney, formatNumber } from "../format";

export type AlertDraft = {
  rule: AlertRule;
  severity: AlertSeverity;
  key: string;
  dataDate: string;
  clientId: number | null;
  apiCode: string | null;
  vendor: string | null;
  title: string;
  body: string;
  metrics: Record<string, number | string | null>;
};

export type AlertState = { open: Set<string>; seen: Set<string> };

export type DayResult = {
  date: string;
  opened: AlertDraft[];
  /** dedupe keys of tracked alerts that closed on this date. */
  closed: string[];
  suppressed: Record<string, number>;
};

// ---------- small helpers ----------

const sum = (a: Series, lo: number, hi: number) => {
  let s = 0;
  for (let i = Math.max(0, lo); i <= hi; i++) s += a[i];
  return s;
};
const wkBase = (a: Series, i: number) => (i < 28 ? NaN : (a[i - 7] + a[i - 14] + a[i - 21] + a[i - 28]) / 4);
const wkActive = (a: Series, i: number) => (i < 28 ? 0 : [7, 14, 21, 28].filter((k) => a[i - k] > 0).length);
const int = (x: number) => formatNumber(Math.round(x));
const inr = (x: number) => formatMoney(Math.round(x));
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const signedPct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`;
const monthName = (iso: string) =>
  new Date(iso.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = formatDate;
const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
};
const daysInMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};

/** Accounts that together make up `share` of `month`'s revenue, largest first. */
export function coveredAccounts(data: AlertData, month: string, share: number): Set<number> {
  const lo = data.index.get(`${month}-01`);
  const set = new Set<number>();
  if (lo == null) return set;
  const hi = Math.min(lo + daysInMonth(month) - 1, data.dates.length - 1);
  const rows = [...data.accounts.values()]
    .map((a) => [a.id, sum(a.rev, lo, hi)] as const)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  let run = 0;
  for (const [id, v] of rows) {
    if (run >= share * total) break;
    set.add(id);
    run += v;
  }
  return set;
}

// ---------- evaluation ----------

export function evaluateDay(
  data: AlertData,
  i: number,
  cfg: AlertConfig,
  state: AlertState,
  coverageCache = new Map<string, Set<number>>()
): DayResult {
  const t = cfg.t;
  const d = data.dates[i];
  const m = d.slice(0, 7);
  const dom = Number(d.slice(8, 10));
  const result: DayResult = { date: d, opened: [], closed: [], suppressed: {} };
  const suppress = (rule: string) => (result.suppressed[rule] = (result.suppressed[rule] ?? 0) + 1);

  const pm = prevMonth(m);
  if (!coverageCache.has(pm)) coverageCache.set(pm, coveredAccounts(data, pm, t.coverageShare));
  const covered = coverageCache.get(pm)!;

  const accountName = (c: number) => data.accounts.get(c)?.name ?? `Account ${c}`;
  const apiName = (a: string) => data.apis.get(a)?.name ?? a;

  type Subject = { clientId?: number | null; apiCode?: string | null; vendor?: string | null };
  const draft = (
    rule: AlertRule,
    severity: AlertSeverity,
    key: string,
    subject: Subject,
    title: string,
    body: string,
    metrics: AlertDraft["metrics"]
  ): AlertDraft => ({
    rule,
    severity,
    key: `${rule}:${key}`,
    dataDate: d,
    clientId: subject.clientId ?? null,
    apiCode: subject.apiCode ?? null,
    vendor: subject.vendor ?? null,
    title,
    body,
    metrics,
  });

  /** Tracked condition: opens on `trig`, stays open (no repeat) until `clear`. */
  const track = (
    rule: AlertRule,
    severity: AlertSeverity,
    key: string,
    trig: boolean,
    clear: boolean,
    make: () => AlertDraft
  ) => {
    const k = `${rule}:${key}`;
    if (state.open.has(k)) {
      if (clear) {
        state.open.delete(k);
        result.closed.push(k);
      }
      return;
    }
    if (trig && cfg.enabled[rule]) {
      const a = make();
      a.severity = severity;
      state.open.add(k);
      result.opened.push(a);
    }
  };
  /** Once-only event. */
  const once = (rule: AlertRule, key: string, make: () => AlertDraft) => {
    const k = `${rule}:${key}`;
    if (!cfg.enabled[rule] || state.seen.has(k)) return;
    state.seen.add(k);
    result.opened.push(make());
  };

  // ---- A5 platform volume. First: a platform-wide drop holds per-account drops. ----
  const P = data.platform;
  const pBase = wkBase(P.t, i);
  const platDrop = P.t[i] <= t.platformDropRatio * pBase;
  track("A5", "critical", "platform", platDrop, P.t[i] >= t.platformDropClearRatio * pBase, () =>
    draft("A5", "critical", "platform", {}, `Platform volume dropped ${pct(1 - P.t[i] / pBase)}`,
      `${int(P.t[i])} hits on ${dayLabel(d)} across all accounts, against a same-weekday average of ${int(pBase)}. Per-account drop alerts are held for this day.`,
      { hits: P.t[i], baseline: Math.round(pBase) })
  );

  // ---- account rules ----
  for (const a of data.accounts.values()) {
    const c = a.id;
    const h = a.hits;
    const name = a.name;
    const base = wkBase(h, i);

    if (covered.has(c)) {
      // A1 no traffic / A2d two low days
      const a1 = base >= t.silentMinBaseline && wkActive(h, i) >= t.silentMinActiveWeekdays && h[i] === 0;
      const lowDay = (j: number) => {
        const b = wkBase(h, j);
        return b >= t.dropDailyMinBaseline && h[j] <= t.dropDailyRatio * b;
      };
      const a2 = h[i] > 0 && lowDay(i) && lowDay(i - 1);
      if (platDrop && (a1 || a2)) suppress(a1 ? "A1" : "A2d");
      else {
        track("A1", "critical", `${c}`, a1, h[i] > 0, () =>
          draft("A1", "critical", `${c}`, { clientId: c }, `${name} sent no traffic`,
            `0 hits on ${dayLabel(d)}. On the same weekday over the last 4 weeks it averaged ${int(base)} hits.`,
            { hits: 0, baseline: Math.round(base) })
        );
        track("A2d", "high", `${c}`, a2, h[i] >= t.dropDailyClearRatio * base, () => {
          const b1 = wkBase(h, i - 1);
          return draft("A2d", "high", `${c}`, { clientId: c }, `${name} volume dropped ${pct(1 - h[i] / base)}`,
            `${int(h[i])} hits on ${dayLabel(d)} and ${int(h[i - 1])} the day before, against same-weekday averages of ${int(base)} and ${int(b1)}.`,
            { hits: h[i], baseline: Math.round(base), prevHits: h[i - 1], prevBaseline: Math.round(b1) });
        });
      }
      // A2w weekly volume
      if (i >= 35) {
        const l7 = sum(h, i - 6, i);
        const p4 = sum(h, i - 34, i - 7) / 4;
        track("A2w", "high", `${c}`, p4 >= t.dropWeeklyMinWeekly && l7 <= t.dropWeeklyRatio * p4, l7 >= t.dropWeeklyClearRatio * p4, () =>
          draft("A2w", "high", `${c}`, { clientId: c }, `${name} weekly volume dropped ${pct(1 - l7 / p4)}`,
            `${int(l7)} hits in the 7 days to ${dayLabel(d)}, against a weekly average of ${int(p4)} over the 4 weeks before.`,
            { hits7d: l7, weeklyBaseline: Math.round(p4) })
        );
      }
      // A3 spike
      track("A3", "medium", `${c}`, base >= t.spikeMinBaseline && h[i] >= t.spikeRatio * base && h[i] - base >= t.spikeMinExtraHits,
        h[i] < t.spikeClearRatio * base, () =>
          draft("A3", "medium", `${c}`, { clientId: c }, `${name} volume spiked ${(h[i] / base).toFixed(1)}×`,
            `${int(h[i])} hits on ${dayLabel(d)}, against a same-weekday average of ${int(base)}.`,
            { hits: h[i], baseline: Math.round(base) })
      );
      // A4 one API stopped, on 2 days on which it normally has traffic
      for (const k of a.pairs) {
        const p = data.pairs.get(k)!;
        const ph = p.hits;
        const normal = (j: number) => wkBase(ph, j) >= t.apiStopMinBaseline && wkActive(ph, j) >= t.apiStopMinActiveWeekdays;
        const trig = normal(i) && normal(i - 1) && ph[i] === 0 && ph[i - 1] === 0 && h[i] - ph[i] > 0 && h[i - 1] - ph[i - 1] > 0;
        if (platDrop && trig) {
          suppress("A4");
          continue;
        }
        track("A4", "high", k, trig, ph[i] > 0, () => {
          const avg = sum(ph, i - 29, i - 2) / 28;
          return draft("A4", "high", k, { clientId: c, apiCode: p.api }, `${name} stopped using ${apiName(p.api)}`,
            `0 hits on ${dayLabel(data.dates[i - 1])} and ${dayLabel(d)}, while its other APIs had traffic on both days. Before that it averaged ${int(avg)} hits a day.`,
            { avgDaily: Math.round(avg) });
        });
      }
      // C1 / C2 month-to-date pace against the same days last month
      if (dom >= t.paceFromDay) {
        const ms = data.index.get(`${m}-01`);
        const pms = data.index.get(`${pm}-01`);
        if (ms != null && pms != null) {
          const span = Math.min(dom, daysInMonth(pm));
          const mtd = sum(a.rev, ms, i);
          const last = sum(a.rev, pms, pms + span - 1);
          const metrics = { mtd: Math.round(mtd), lastMonthSameDays: Math.round(last) };
          if (last > 0 && mtd <= t.paceDropRatio * last)
            once("C1", `${c}:${m}`, () =>
              draft("C1", "high", `${c}:${m}`, { clientId: c }, `${name} is ${pct(1 - mtd / last)} behind last month`,
                `Revenue ${inr(mtd)} from 1 to ${dayLabel(d)}, against ${inr(last)} for the same days of ${monthName(`${pm}-01`)}.`, metrics)
            );
          if (last > 0 && mtd >= t.paceSpikeRatio * last)
            once("C2", `${c}:${m}`, () =>
              draft("C2", "info", `${c}:${m}`, { clientId: c }, `${name} is ${pct(mtd / last - 1)} ahead of last month`,
                `Revenue ${inr(mtd)} from 1 to ${dayLabel(d)}, against ${inr(last)} for the same days of ${monthName(`${pm}-01`)}.`, metrics)
            );
        }
      }
      // C3 / C4 weekly revenue trend, on Mondays over the 5 completed Mon–Sun weeks
      if (new Date(d + "T00:00:00Z").getUTCDay() === 1 && i >= 35) {
        const w = [0, 1, 2, 3, 4].map((k) => sum(a.rev, i - 7 * (k + 1), i - 7 * k - 1)); // w[0] = last full week
        const down = w[4] > w[3] && w[3] > w[2] && w[2] > w[1] && w[1] > w[0] && w[0] <= (1 - t.trendMinChange) * w[4];
        const up = w[4] > 0 && w[4] < w[3] && w[3] < w[2] && w[2] < w[1] && w[1] < w[0] && w[0] >= (1 + t.trendMinChange) * w[4];
        const series = w.slice().reverse().map(inr).join(" → ");
        const metrics = { w1: Math.round(w[4]), w2: Math.round(w[3]), w3: Math.round(w[2]), w4: Math.round(w[1]), w5: Math.round(w[0]) };
        track("C3", "high", `${c}`, down, w[0] > w[1], () =>
          draft("C3", "high", `${c}`, { clientId: c }, `${name} revenue fell 4 weeks in a row`, `Weekly revenue: ${series}.`, metrics)
        );
        track("C4", "info", `${c}`, up, w[0] < w[1], () =>
          draft("C4", "info", `${c}`, { clientId: c }, `${name} revenue rose 4 weeks in a row`, `Weekly revenue: ${series}.`, metrics)
        );
      }
      // C5 revenue per hit, on the 1st, for the completed month against the one before
      if (dom === 1) {
        const cm = pm;
        const bm = prevMonth(cm);
        const cs = data.index.get(`${cm}-01`);
        const bs = data.index.get(`${bm}-01`);
        if (cs != null && bs != null) {
          const ce = cs + daysInMonth(cm) - 1;
          const be = bs + daysInMonth(bm) - 1;
          const rc = sum(a.rev, cs, ce), hc = sum(h, cs, ce) + sum(a.manualHits, cs, ce);
          const rb = sum(a.rev, bs, be), hb = sum(h, bs, be) + sum(a.manualHits, bs, be);
          if (hc >= t.revPerHitMinHits && hb >= t.revPerHitMinHits && rb > 0) {
            const x = rc / hc, y = rb / hb;
            if (Math.abs(x / y - 1) >= t.revPerHitChange)
              once("C5", `${c}:${cm}`, () =>
                draft("C5", "medium", `${c}:${cm}`, { clientId: c }, `${name} revenue per hit changed ${signedPct(x / y - 1)}`,
                  `${monthName(`${cm}-01`)}: ₹${x.toFixed(2)} per hit. ${monthName(`${bm}-01`)}: ₹${y.toFixed(2)} per hit.`,
                  { revPerHit: +x.toFixed(4), prevRevPerHit: +y.toFixed(4) })
              );
          }
        }
      }
    }

    // ---- lifecycle rules: all accounts ----
    if (data.accountFirst.get(c) === d)
      once("D1", `${c}`, () =>
        draft("D1", "info", `${c}`, { clientId: c }, `${name} sent its first traffic`, `${int(h[i])} hits on ${dayLabel(d)}.`, { hits: h[i] })
      );
    const S = t.silentDays;
    const first = data.accountFirst.get(c);
    if (h[i] > 0 && i >= S && first != null && first < data.dates[i - S] && sum(h, i - S, i - 1) === 0)
      once("D4", `${c}:${d}`, () =>
        draft("D4", "info", `${c}:${d}`, { clientId: c }, `${name} is active again`,
          `${int(h[i])} hits on ${dayLabel(d)} after ${S} or more days with none.`, { hits: h[i] })
      );
    if (i >= S && h[i - S] > 0 && sum(h, i - S + 1, i) === 0 && sum(h, i - S - 60, i - S) >= t.inactivePriorMinHits)
      once("D5", `${c}:${d}`, () =>
        draft("D5", "high", `${c}:${d}`, { clientId: c }, `${name} has had no traffic for ${S} days`,
          `The last traffic was on ${dayLabel(data.dates[i - S])}.`, { priorHits: sum(h, i - S - 60, i - S) })
      );
  }

  // ---- pair rules (B1 waits until B2 has been evaluated for this date) ----
  const deferredB1: (() => void)[] = [];
  for (const [k, p] of data.pairs) {
    const c = p.client;
    const label = `${accountName(c)}: ${apiName(p.api)}`;
    const tt = p.hits[i];
    let bt = 0, bf = 0, bsnd = 0;
    for (let j = i - 28; j <= i - 1; j++) {
      if (j < 0) continue;
      bt += p.hits[j];
      bf += p.f[j];
      bsnd += p.snd[j];
    }
    if (bt >= t.failRiseMinBaselineHits) {
      const fs = tt > 0 ? p.f[i] / tt : 0, fb = bf / bt;
      deferredB1.push(() => {
        const trig = tt >= t.failRiseMinHits && fs - fb >= t.failRisePts;
        if (trig && !state.open.has(`B1:${k}`) && state.open.has(`B2:api:${p.api}`)) {
          suppress("B1");
          return;
        }
        track("B1", "high", k, trig, fs - fb < t.failRiseClearPts, () =>
          draft("B1", "high", k, { clientId: c, apiCode: p.api }, `${label} failures rose to ${pct(fs)}`,
            `${int(p.f[i])} of ${int(tt)} hits failed on ${dayLabel(d)}. The rate over the 28 days before was ${pct(fb)}.`,
            { failed: p.f[i], hits: tt, rate: +fs.toFixed(4), baselineRate: +fb.toFixed(4) })
        );
      });
    }
    if (bt >= t.noDataMinBaselineHits) {
      const ss = tt > 0 ? p.snd[i] / tt : 0, sb = bsnd / bt;
      track("B4", "medium", k, tt >= t.noDataMinHits && ss - sb >= t.noDataRisePts, ss - sb < t.noDataClearPts, () =>
        draft("B4", "medium", k, { clientId: c, apiCode: p.api }, `${label} no-data share rose to ${pct(ss)}`,
          `${int(p.snd[i])} of ${int(tt)} hits on ${dayLabel(d)} returned no data. The share over the 28 days before was ${pct(sb)}.`,
          { noData: p.snd[i], hits: tt, share: +ss.toFixed(4), baselineShare: +sb.toFixed(4) })
      );
    }
    const ips = tt > 0 ? p.ip[i] / tt : 0;
    track("B3", "medium", k, tt >= t.stuckMinHits && ips >= t.stuckShare, ips < t.stuckClearShare, () =>
      draft("B3", "medium", k, { clientId: c, apiCode: p.api }, `${label} has ${pct(ips)} of hits in progress`,
        `${int(p.ip[i])} of ${int(tt)} hits on ${dayLabel(d)} were still in progress.`,
        { inProgress: p.ip[i], hits: tt, share: +ips.toFixed(4) })
    );

    // C7 and C8 apply to all accounts, not only the covered ones.
    // C7 revenue below vendor cost, month to date
    if (dom >= t.belowCostFromDay) {
      const ms = data.index.get(`${m}-01`);
      if (ms != null) {
        const r = sum(p.rev, ms, i), v = sum(p.vc, ms, i);
        if (v >= t.belowCostMinCost && r < v)
          once("C7", `${k}:${m}`, () =>
            draft("C7", "high", `${k}:${m}`, { clientId: c, apiCode: p.api }, `${label} revenue is below vendor cost`,
              `From 1 to ${dayLabel(d)}: revenue ${inr(r)}, vendor cost ${inr(v)}.`, { revenue: Math.round(r), vendorCost: Math.round(v) })
          );
      }
    }
    // C8 billable usage with no price
    const unp7 = sum(p.unpriced, i - 6, i);
    if (p.unpriced[i] > 0 && unp7 >= t.unpricedMinHits7d)
      once("C8", k, () =>
        draft("C8", "high", k, { clientId: c, apiCode: p.api }, `${label} has usage with no price`,
          `${int(unp7)} billable hits in the 7 days to ${dayLabel(d)} had no price.`, { unpricedHits7d: unp7 })
      );
    // D2 existing account started using a new API
    const pf = data.pairFirst.get(k);
    const af = data.accountFirst.get(c);
    const pfi = pf != null ? data.index.get(pf) : undefined;
    if (pf && af && pfi != null && i - pfi <= t.newApiWithinDays && af <= shiftDate(pf, -t.newApiAccountAgeDays)) {
      const since = sum(p.hits, pfi, i);
      if (since >= t.newApiMinHits)
        once("D2", k, () =>
          draft("D2", "info", k, { clientId: c, apiCode: p.api }, `${accountName(c)} started using ${apiName(p.api)}`,
            `${int(since)} hits since its first use on ${dayLabel(pf)}.`, { hitsSinceFirst: since })
        );
    }
    // D3 sandbox to billable
    if (tt > 0 && sum(p.hits, i - 28, i - 1) === 0 && sum(p.sandbox, i - 28, i - 1) > 0)
      once("D3", k, () =>
        draft("D3", "info", k, { clientId: c, apiCode: p.api }, `${label} moved from sandbox to billable`,
          `${int(tt)} billable hits on ${dayLabel(d)}, after only sandbox traffic in the 28 days before.`, { hits: tt })
      );
    // C6 volume tier reached this month
    const sched = data.volumeSchedules.get(k);
    if (sched && tt > 0) {
      const monthEnd = `${m}-${String(daysInMonth(m)).padStart(2, "0")}`;
      const sc = sched.filter((x) => x.eff <= monthEnd).pop();
      const ms = data.index.get(`${m}-01`);
      if (sc && ms != null) {
        const before = sum(p.hits, ms, i - 1), after = before + tt;
        const mins = [...sc.mins].sort((x, y) => x - y);
        const tier = (x: number) => mins.filter((mn) => x > mn).length - 1;
        const tb = tier(before), ta = tier(after);
        if (ta > tb && ta >= 1)
          once("C6", `${k}:${m}:${ta}`, () =>
            draft("C6", "info", `${k}:${m}:${ta}`, { clientId: c, apiCode: p.api }, `${label} reached tier ${ta + 1}`,
              `${int(after)} hits in ${monthName(d)}. Tier ${ta + 1} starts after ${int(mins[ta])} hits.`, { monthHits: after, tier: ta + 1 })
          );
      }
    }
  }

  // ---- A6 / B2 per API across accounts ----
  for (const ap of data.apis.values()) {
    const ah = ap.hits;
    const base = wkBase(ah, i);
    let nDrop = 0, nFail = 0, bt = 0, bf = 0;
    for (let j = Math.max(0, i - 28); j <= i - 1; j++) {
      bt += ah[j];
      bf += ap.f[j];
    }
    for (const k of ap.pairs) {
      const p = data.pairs.get(k)!;
      const pb = wkBase(p.hits, i);
      if (pb >= t.apiDropAccountMinBaseline && p.hits[i] <= t.apiDropRatio * pb) nDrop++;
      let pt = 0, pf = 0;
      for (let j = Math.max(0, i - 28); j <= i - 1; j++) {
        pt += p.hits[j];
        pf += p.f[j];
      }
      if (p.hits[i] >= t.outageAccountMinHits && pt >= t.outageAccountMinBaselineHits && p.f[i] / p.hits[i] - pf / pt >= t.outageRisePts) nFail++;
    }
    const b1 = wkBase(ah, i - 1);
    const trigA6 =
      base >= t.apiDropMinBaseline && ah[i] <= t.apiDropRatio * base &&
      b1 >= t.apiDropMinBaseline && ah[i - 1] <= t.apiDropRatio * b1 && nDrop >= t.apiDropMinAccounts;
    if (platDrop && trigA6) suppress("A6");
    else
      track("A6", "high", ap.code, trigA6, ah[i] >= t.apiDropClearRatio * base, () =>
        draft("A6", "high", ap.code, { apiCode: ap.code }, `${ap.name} volume dropped ${pct(1 - ah[i] / base)} across accounts`,
          `${int(ah[i])} hits on ${dayLabel(d)}, against a same-weekday average of ${int(base)}. ${nDrop} accounts are down by half or more.`,
          { hits: ah[i], baseline: Math.round(base), accounts: nDrop })
      );
    const fsh = ah[i] > 0 ? ap.f[i] / ah[i] : 0, fb = bt > 0 ? bf / bt : 0;
    const sev: AlertSeverity = fsh - fb >= t.outageCriticalPts || nFail >= t.outageCriticalAccounts ? "critical" : "high";
    track("B2", sev, `api:${ap.code}`, bt >= t.outageMinBaselineHits && nFail >= t.outageMinAccounts && fsh - fb >= t.outageRisePts,
      fsh - fb < t.outageClearPts, () =>
        draft("B2", sev, `api:${ap.code}`, { apiCode: ap.code }, `${ap.name} failures rose across ${nFail} accounts`,
          `${pct(fsh)} of hits failed on ${dayLabel(d)}. The rate over the 28 days before was ${pct(fb)}.`,
          { rate: +fsh.toFixed(4), baselineRate: +fb.toFixed(4), accounts: nFail })
    );
  }
  for (const [vn, v] of data.vendors) {
    let bt = 0, bf = 0, nFail = 0;
    for (let j = Math.max(0, i - 28); j <= i - 1; j++) {
      bt += v.t[j];
      bf += v.f[j];
    }
    for (const va of v.byAccount.values()) {
      let pt = 0, pf = 0;
      for (let j = Math.max(0, i - 28); j <= i - 1; j++) {
        pt += va.t[j];
        pf += va.f[j];
      }
      if (va.t[i] >= t.outageAccountMinHits && pt >= t.outageAccountMinBaselineHits && va.f[i] / va.t[i] - pf / pt >= t.outageRisePts) nFail++;
    }
    const fsh = v.t[i] > 0 ? v.f[i] / v.t[i] : 0, fb = bt > 0 ? bf / bt : 0;
    const sev: AlertSeverity = fsh - fb >= t.outageCriticalPts || nFail >= t.outageCriticalAccounts ? "critical" : "high";
    track("B2", sev, `vendor:${vn}`, bt >= t.outageMinBaselineHits && nFail >= t.outageMinAccounts && fsh - fb >= t.outageRisePts,
      fsh - fb < t.outageClearPts, () =>
        draft("B2", sev, `vendor:${vn}`, { vendor: vn }, `Vendor ${vn}: failures rose across ${nFail} accounts`,
          `${pct(fsh)} of hits failed on ${dayLabel(d)}. The rate over the 28 days before was ${pct(fb)}.`,
          { rate: +fsh.toFixed(4), baselineRate: +fb.toFixed(4), accounts: nFail })
    );
  }
  for (const f of deferredB1) f();

  // ---- B5 platform success rate ----
  {
    let bt = 0, bo = 0;
    for (let j = Math.max(0, i - 28); j <= i - 1; j++) {
      bt += P.t[j];
      bo += P.ok[j];
    }
    const sr = P.t[i] > 0 ? P.ok[i] / P.t[i] : 0, sb = bt > 0 ? bo / bt : 0;
    track("B5", "high", "platform", sb - sr >= t.successDropPts, sb - sr < t.successClearPts, () =>
      draft("B5", "high", "platform", {}, `Platform success rate fell to ${pct(sr)}`,
        `Successful and no-data hits were ${pct(sr)} of all hits on ${dayLabel(d)}. The rate over the 28 days before was ${pct(sb)}.`,
        { rate: +sr.toFixed(4), baselineRate: +sb.toFixed(4) })
    );
  }

  // ---- F2 unmapped names first seen on this date ----
  for (const u of data.unmappedFirst) {
    if (u.first !== d) continue;
    const key = `${u.kind}:${u.name}`;
    once("F2", key, () =>
      draft("F2", "medium", key, {}, `New unmapped ${u.kind === "account" ? "account" : "API"} name: ${u.name}`,
        `First seen in the usage for ${dayLabel(d)}. Map it in Review so its usage counts.`, { kind: u.kind })
    );
  }

  // ---- F3 vendor reconciliation, on the last day of a month ----
  if (dom === daysInMonth(m) && data.reconFrom && data.reconFrom <= `${m}-01`) {
    const lo = data.index.get(`${m}-01`);
    if (lo != null) {
      let nBad = 0, gap = 0;
      for (const e of data.recon.values()) {
        const v = sum(e.vendor, lo, i), o = sum(e.ours, lo, i);
        if (Math.max(v, o) >= t.reconMinHits && (v === 0 || Math.abs(o - v) / v > t.reconMaxDiff)) {
          nBad++;
          gap += Math.abs(o - v);
        }
      }
      if (nBad)
        once("F3", m, () =>
          draft("F3", "medium", m, {}, `${nBad} vendor/API pairs did not reconcile in ${monthName(d)}`,
            `Each differs by more than ${pct(t.reconMaxDiff)} between the hits the vendor reported and the hits Ledgerline recorded (${int(gap)} hits in total).`,
            { pairs: nBad, gapHits: gap })
        );
    }
  }

  return result;
}

function shiftDate(iso: string, days: number): string {
  const x = new Date(iso + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}
