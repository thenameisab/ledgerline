import { getIncludeSandbox } from "@/lib/repos/settings";
import Link from "next/link";
import { StatusBar } from "@/components/StatusBar";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DashboardFilters } from "@/components/DashboardFilters";
import { PeriodBanner } from "@/components/dashboard/PeriodBanner";
import { Headline } from "@/components/dashboard/Headline";
import { MoneyAtRisk } from "@/components/dashboard/MoneyAtRisk";
import { TrendCard } from "@/components/dashboard/TrendCard";
import { TopList, type TopRow } from "@/components/dashboard/TopList";
import { Movers, type MoverRow } from "@/components/dashboard/Movers";
import { VolumeCard } from "@/components/dashboard/VolumeCard";
import { PortfolioMap, type PortfolioCell } from "@/components/dashboard/PortfolioMap";
import { GrowthQuadrant, type QuadrantPoint } from "@/components/dashboard/GrowthQuadrant";
import { getKpis, getDailySeries, getRiskSummary } from "@/lib/repos/usage";
import { listBillingPeriods } from "@/lib/repos/statements";
import { getAccountSummaries, getAccountLogos } from "@/lib/repos/accounts";
import { getApiSummaries } from "@/lib/repos/apis";
import { mtdRange, prevMonthOf, defaultRange, isEarlyMonth } from "@/lib/repos/periods";
import { resolvePeriod } from "@/lib/period";
import { generateSlug } from "@/lib/slug";
import { formatMoney, formatPercent, formatDateRange } from "@/lib/format";
import { getSessionUser, canViewCost } from "@/lib/access";
import { costConfidence } from "@/lib/repos/vendor-cost";
import { confirmedShare, formatShare, isLowConfidence } from "@/lib/vendor-confidence";

const dayCount = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string };
}) {
  const includeSandbox = await getIncludeSandbox();
  const user = await getSessionUser();
  const includeCost = canViewCost(user?.role ?? "member");
  const mtd = mtdRange();
  const def = defaultRange();
  const { from, to } = resolvePeriod(searchParams);
  const prev = prevMonthOf(from);
  const window = { from, to, includeSandbox, includeCost };

  const [kpis, series, allAccounts, apis, prior, risk, prevAccounts, periods, confidence] =
    await Promise.all([
    getKpis(window),
    getDailySeries(window),
    getAccountSummaries(window),
    getApiSummaries(window),
    getKpis({ from: prev.from, to: prev.to, includeSandbox, includeCost }),
    getRiskSummary(window),
    getAccountSummaries({ from: prev.from, to: prev.to, includeSandbox }),
    listBillingPeriods(),
    // Same window and sandbox rule as getKpis, so the coverage figure describes
    // the rows the margin was computed from. Not read at all for viewers who
    // never see cost.
    includeCost ? costConfidence({ from, to, includeSandbox }) : Promise.resolve(null),
  ]);

  // Tiered (slab) revenue is a per-month total the daily view prices at ₹0, so
  // the chart bars exclude it and won't sum to the KPI. A vendor's monthly
  // minimum is the same shape on the cost side, and worse: it belongs to no day
  // at all, so no allocation would put it on a bar honestly. Surface both gaps
  // rather than letting the chart quietly disagree with the headline.
  const seriesRevenue = series.reduce((s, d) => s + d.revenue, 0);
  const tieredRevenue = kpis.revenue - seriesRevenue;
  const minimumTopUp = kpis.minimum_top_up ?? 0;
  const excluded = [
    tieredRevenue >= 1
      ? `${formatMoney(tieredRevenue, { compact: true })} tiered revenue (billed per calendar month, not per day)`
      : null,
    minimumTopUp >= 1
      ? `${formatMoney(minimumTopUp, { compact: true })} of vendor monthly minimums (owed per month, not per day)`
      : null,
  ].filter(Boolean);
  const chartCaption =
    excluded.length > 0
      ? `Excludes ${excluded.join(" and ")} — daily bars won't sum to the headline.`
      : undefined;

  // Revenue past the last billing period is live run-rate, not yet invoiced.
  const coveredEnd = periods.reduce((m, p) => (p.end_date > m ? p.end_date : m), "");
  const runRateNote =
    to > coveredEnd
      ? `Includes live run-rate after ${coveredEnd || "the last billing period"} — not yet invoiced.`
      : undefined;

  // A window inside one calendar month that starts on the 1st (month to date,
  // or a whole month) projects to the end of that month, not to `to`.
  const monthEnd = (() => {
    const [y, m] = from.split("-").map(Number);
    return `${from.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  })();
  const total = from.endsWith("-01") && to.slice(0, 7) === from.slice(0, 7) ? dayCount(from, monthEnd) : dayCount(from, to);
  const priorDays = dayCount(prev.from, prev.to);
  const elapsed = series.length; // days that actually carry data

  // MoM delta, normalised so a partial current month compares fairly to a full
  // prior month (scale the prior down to the elapsed day count).
  const revenueDelta = (() => {
    if (prior.revenue <= 0 || elapsed <= 0) return null;
    const prevScaled = (prior.revenue * elapsed) / priorDays;
    return prevScaled > 0 ? ((kpis.revenue - prevScaled) / prevScaled) * 100 : null;
  })();

  const ahead = revenueDelta != null && revenueDelta > 0;
  const briefing = (
    <>
      {ahead ? "Pacing ahead of" : revenueDelta != null ? "Tracking behind" : "Compared with"} last
      month
      {/* Prose has no room for a coverage bar, so a margin it cannot qualify is
          left out rather than asserted. The Headline states the figure with its
          confidence beside it. */}
      {kpis.margin_pct != null
        ? isLowConfidence(confidence)
          ? `; margin not measured — vendor cost is confirmed on ${formatShare(
              confirmedShare(confidence!)
            )} of hits`
          : `; margin holding at ${formatPercent(kpis.margin_pct, 0)}`
        : ""}
      .{" "}
      {risk.total > 0 ? (
        <>
          <span className="text-bad-ink" style={{ fontWeight: 500 }}>
            {risk.estimated ? "~" : ""}
            {formatMoney(risk.total, { compact: true })}
          </span>{" "}
          is at risk this month.
        </>
      ) : (
        "Nothing flagged at risk this month."
      )}
    </>
  );

  const accountRows: TopRow[] = [...allAccounts]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7)
    .map((c) => ({
      key: String(c.client_id),
      name: c.display_name,
      sub: c.group_name ?? undefined,
      value: c.revenue,
      display: formatMoney(c.revenue, { compact: true }),
      href: `/accounts/${generateSlug(c.display_name)}`,
    }));

  // Movers: revenue change vs last month, prior scaled to elapsed days (same
  // normalisation as the headline delta). Includes accounts that went silent.
  const moverRows: MoverRow[] = (() => {
    if (elapsed <= 0 || prevAccounts.length === 0) return [];
    const scale = priorDays > 0 ? elapsed / priorDays : 1;
    const names = new Map<number, string>();
    const currentRev = new Map<number, number>();
    const priorRev = new Map<number, number>();
    for (const c of allAccounts) {
      names.set(c.client_id, c.display_name);
      currentRev.set(c.client_id, c.revenue);
    }
    for (const c of prevAccounts) {
      if (!names.has(c.client_id)) names.set(c.client_id, c.display_name);
      priorRev.set(c.client_id, c.revenue * scale);
    }
    return Array.from(names.entries())
      .map(([id, name]) => {
        const cur = currentRev.get(id) ?? 0;
        const prev_ = priorRev.get(id) ?? 0;
        return {
          key: String(id),
          name,
          href: `/accounts/${generateSlug(name)}`,
          delta: cur - prev_,
          delta_pct: prev_ > 0 ? ((cur - prev_) / prev_) * 100 : null,
          current: cur,
        };
      })
      .filter((m) => Math.abs(m.delta) >= 1)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6);
  })();

  const apiRows: TopRow[] = [...apis]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7)
    .map((a) => ({
      key: a.product_code,
      name: a.name,
      sub: a.product_code,
      value: a.revenue,
      display: formatMoney(a.revenue, { compact: true }),
      href: `/skus/${a.product_code}`,
    }));

  // Per-account revenue + MoM growth for the portfolio visuals (treemap +
  // quadrant). Same day-scaled prior-month normalisation as the headline/movers.
  const portfolioBase = (() => {
    const scale = priorDays > 0 ? elapsed / priorDays : 1;
    const priorRev = new Map<number, number>();
    for (const c of prevAccounts) priorRev.set(c.client_id, c.revenue * scale);
    return allAccounts
      .filter((c) => !c.is_sandbox && c.revenue > 0)
      .map((c) => {
        const prior_ = priorRev.get(c.client_id) ?? 0;
        return {
          client_id: c.client_id,
          name: c.display_name,
          href: `/accounts/${generateSlug(c.display_name)}`,
          revenue: c.revenue,
          delta_pct: prior_ > 0 ? ((c.revenue - prior_) / prior_) * 100 : null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  })();

  // Treemap: top 12 accounts individually, the rest pooled into one "Others" tile.
  const TOP_N = 12;
  const treemapTop = portfolioBase.slice(0, TOP_N);
  const treemapRest = portfolioBase.slice(TOP_N);
  // Quadrant: accounts with a computable growth rate (prior-month revenue), capped
  // so the plot stays legible.
  const quadrantBase = portfolioBase
    .filter((c) => c.delta_pct != null)
    .slice(0, 24) as Array<(typeof portfolioBase)[number] & { delta_pct: number }>;

  // Fetch logos only for the accounts actually rendered (kept off the cached
  // summary read so base64 blobs don't bloat the cache).
  const logoIds = Array.from(
    new Set([...treemapTop, ...quadrantBase].map((c) => c.client_id))
  );
  const logos = await getAccountLogos(logoIds);

  const portfolioCells: PortfolioCell[] = [
    ...treemapTop.map((c) => ({ ...c, logoUrl: logos.get(c.client_id) ?? null })),
    ...(treemapRest.length > 0
      ? [
          {
            client_id: -1,
            name: `Others (${treemapRest.length})`,
            href: "/accounts",
            revenue: treemapRest.reduce((s, c) => s + c.revenue, 0),
            delta_pct: null,
          } as PortfolioCell,
        ]
      : []),
  ];

  const quadrantPoints: QuadrantPoint[] = quadrantBase.map((c) => ({
    ...c,
    logoUrl: logos.get(c.client_id) ?? null,
  }));

  return (
    <main>
      <AutoRefresh intervalMs={30_000} />
      <StatusBar
        title="Dashboard"
        subtitle={`${formatDateRange(from, to)} · sandbox ${includeSandbox ? "included" : "excluded"}`}
      />
      <div className="mx-auto w-full max-w-[1600px] px-7 pt-5 flex items-center justify-end gap-4 flex-wrap">
        <DashboardFilters from={from} to={to} />
      </div>

      {isEarlyMonth() &&
        ((from === def.from && to === def.to) ||
          (from === mtd.from && to === mtd.to)) && (
          <div className="mx-auto w-full max-w-[1600px] px-7 pt-3">
            <PeriodBanner
              viewingCurrent={from === mtd.from && to === mtd.to}
              currentRange={mtd}
            />
          </div>
        )}

      <div className="mx-auto w-full max-w-[1600px] px-7 pt-4 pb-8 space-y-5">
        <Headline
          kpis={kpis}
          revenueDelta={revenueDelta}
          benchmark={prior.revenue}
          elapsed={elapsed}
          total={total}
          briefing={briefing}
          runRateNote={runRateNote}
          confidence={confidence}
        />

        <MoneyAtRisk summary={risk} />

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div className="space-y-5">
            <TrendCard
              data={series}
              title={includeCost ? "Daily revenue & margin" : "Daily revenue"}
              caption={chartCaption}
            />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
              <Movers rows={moverRows} />
              <VolumeCard data={series} />
            </div>
          </div>

          <div
            className="elev-1 bg-bg-raised rounded-lg p-5 dash-enter space-y-6"
            style={{ "--i": 5 } as React.CSSProperties}
          >
            <TopList title="Top accounts by revenue" rows={accountRows} />
            <div className="hairline pt-5">
              <TopList title="Top APIs by revenue" rows={apiRows} />
            </div>
            <Link
              href="/accounts"
              className="block text-xs text-accent-ink hover:text-accent transition-colors duration-fast ease-expo"
            >
              All accounts →
            </Link>
          </div>
        </div>

        {portfolioBase.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <PortfolioMap cells={portfolioCells} />
            {quadrantPoints.length > 0 && <GrowthQuadrant points={quadrantPoints} />}
          </div>
        )}
      </div>
    </main>
  );
}
