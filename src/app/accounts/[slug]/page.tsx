import { notFound, redirect } from "next/navigation";
import { StatusBar } from "@/components/StatusBar";
import { DashboardFilters } from "@/components/DashboardFilters";
import { AccountHeadline } from "@/components/accounts/AccountHeadline";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { TrendCard } from "@/components/dashboard/TrendCard";
import { StatusChip } from "@/components/chips/StatusChip";
import { SandboxChip, NoMsaChip } from "@/components/chips/Chips";
import { ApiBreakdownTable } from "@/components/ApiBreakdownTable";
import { AccountTabs } from "@/components/accounts/AccountTabs";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import {
  getAccount,
  getAccountBySlug,
  resolveAccountSlug,
  getAccountSummaries,
  getAccountApiBreakdown,
  getAccountDailySeries,
  getAccountActivity,
  getAccountTopApi,
  getAccountSandboxUsage,
} from "@/lib/repos/accounts";
import { getKpis } from "@/lib/repos/usage";
import { costConfidence } from "@/lib/repos/vendor-cost";
import { getUndoableOpForSource } from "@/lib/repos/account-merge";
import { DeletedAccountBanner } from "@/components/accounts/DeletedAccountBanner";
import { getIncludeSandbox } from "@/lib/repos/settings";
import { prevMonthOf } from "@/lib/repos/periods";
import { resolvePeriod } from "@/lib/period";
import { getSessionUser, canEdit, canViewCost, can } from "@/lib/access";
import { briefingComposer } from "@/lib/briefing";
import { formatMoney, formatNumber, formatDay, formatDateRange } from "@/lib/format";
import { ApiStatusChart } from "@/components/charts/ApiStatusChart";
import { FileText, ArrowRight, Plus, ChevronRight, FlaskConical } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { AutoRefresh } from "@/components/AutoRefresh";
import Link from "next/link";

export default async function AccountProfilePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { from?: string; to?: string };
}) {
  // Support legacy numeric URLs — redirect to slug
  if (/^\d+$/.test(params.slug)) {
    const legacy = await getAccount(Number(params.slug));
    if (!legacy?.slug) notFound();
    redirect(`/accounts/${legacy.slug}`);
  }

  const account = await getAccountBySlug(params.slug);
  if (!account) {
    const current = await resolveAccountSlug(params.slug);
    if (current) redirect(`/accounts/${current}`);
    notFound();
  }

  const id = Number(account.id);
  const user = await getSessionUser();

  // Soft-deleted / merged-away account: surface the undo banner instead of
  // pretending the account is live.
  const deletedOp = account.deleted_at ? await getUndoableOpForSource(id) : null;
  const mergedIntoName = account.merged_into ? (await getAccount(Number(account.merged_into)))?.display_name ?? null : null;
  const editable = canEdit(user?.role ?? "member");
  const canEditProfile = can(user?.role ?? "member", "account.update");
  const showCost = canViewCost(user?.role ?? "member");

  const { from, to } = resolvePeriod(searchParams);
  const prev = prevMonthOf(from);
  const window = { from, to };
  const ninetyDaysAgo = isoDaysBefore(to, 89);
  const includeSandbox = await getIncludeSandbox();
  const [summaries, breakdown, series, topApi, activity, prevSummaries, orgKpis, sandboxUsage, confidence] =
    await Promise.all([
      getAccountSummaries({ ...window, includeSandbox }),
      getAccountApiBreakdown(id, { ...window, includeSandbox }),
      getAccountDailySeries(id, { ...window, includeCost: showCost, includeSandbox }),
      getAccountTopApi(id, { ...window, includeSandbox }),
      getAccountActivity(id, { from: ninetyDaysAgo, to, includeSandbox }),
      getAccountSummaries({ from: prev.from, to: prev.to, includeSandbox }),
      getKpis(window),
      getAccountSandboxUsage(id, window),
      // Same account, window and sandbox rule as the margin series above.
      showCost
        ? costConfidence({ ...window, clientId: id, includeSandbox })
        : Promise.resolve(null),
    ]);
  const summary = summaries.find((s) => s.client_id === id);

  const prevSummary = prevSummaries.find((s) => s.client_id === id);
  const momDelta =
    prevSummary && prevSummary.revenue > 0 && summary && summary.revenue > 0
      ? ((summary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100
      : null;

  const briefing = briefingComposer.composeAccountBriefing({
    display_name: account.display_name,
    is_sandbox: account.is_sandbox,
    revenue: summary?.revenue ?? 0,
    hits: summary?.hits ?? 0,
    apis_used: summary?.apis_used ?? 0,
    unpriced_pairs: summary?.unpriced_pairs ?? 0,
    unpriced_hits: summary?.unpriced_hits ?? 0,
    top_api: topApi ? { name: topApi.name, revenue_share: topApi.share } : null,
    mom_revenue_delta_pct: momDelta,
  });

  const successRate =
    summary && summary.hits > 0
      ? (computeSuccessHits(breakdown) / summary.hits) * 100
      : 0;
  const avgPrice =
    breakdown.reduce((s, b) => s + b.successful, 0) > 0
      ? (summary?.revenue ?? 0) / breakdown.reduce((s, b) => s + b.successful, 0)
      : 0;

  // Tiered (slab) revenue is a per-month total priced at ₹0 in the daily view,
  // so the chart bars exclude it and won't sum to the account total. Flag it.
  const tieredRevenue = (summary?.revenue ?? 0) - series.reduce((s, d) => s + d.revenue, 0);
  const chartCaption =
    tieredRevenue >= 1
      ? `Excludes ${formatMoney(tieredRevenue, { compact: true })} tiered revenue (billed per calendar month, not per day) — daily bars won't sum to the total.`
      : undefined;

  // Leak state (per-day truth, dismissal-aware) comes from the summary. Active
  // (no current price) outranks historical (priced now, residual past hits).
  const activePairs = summary?.active_unpriced_pairs ?? 0;
  const historicalPairs = summary?.historical_unpriced_pairs ?? 0;
  const leakProp =
    activePairs > 0
      ? {
          kind: "active" as const,
          pairs: activePairs,
          hits: summary?.active_unpriced_hits ?? 0,
          amount: avgPrice > 0 ? (summary?.active_unpriced_hits ?? 0) * avgPrice : 0,
          href: `/accounts/${params.slug}/pricing`,
          editable,
        }
      : historicalPairs > 0
        ? {
            kind: "historical" as const,
            pairs: historicalPairs,
            hits: summary?.historical_unpriced_hits ?? 0,
            amount: avgPrice > 0 ? (summary?.historical_unpriced_hits ?? 0) * avgPrice : 0,
            href: `/accounts/${params.slug}/pricing`,
            editable,
          }
        : null;

  const statusBreakdown = {
    successful: breakdown.reduce((s, b) => s + b.successful, 0),
    successful_no_data: breakdown.reduce((s, b) => s + b.successful_no_data, 0),
    failed: breakdown.reduce((s, b) => s + b.failed, 0),
    in_progress: breakdown.reduce((s, b) => s + b.in_progress, 0),
  };

  return (
    <main>
      <AutoRefresh intervalMs={30_000} />
      {account.deleted_at ? (
        <DeletedAccountBanner
          opId={deletedOp?.id ?? null}
          kind={deletedOp?.kind ?? (account.merged_into ? "merge" : "delete")}
          mergedIntoName={mergedIntoName}
          deadline={deletedOp?.reverse_deadline ?? null}
          canUndo={user?.role === "admin"}
        />
      ) : null}
      <StatusBar
        title={account.display_name}
        leading={
          <AccountLogo
            name={account.display_name}
            logoUrl={account.logo_data_url}
            size={32}
          />
        }
        subtitle={[
          account.group_name ? `${account.group_name}` : null,
          account.billing_entity ?? null,
          account.gstin ? `GSTIN ${account.gstin}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        chip={
          account.is_sandbox ? (
            <SandboxChip />
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {summary ? <StatusChip kind={summary.status_pill} /> : null}
              {summary?.msa_missing ? <NoMsaChip /> : null}
            </span>
          )
        }
        actions={
          editable ? (
            <>
              <Link
                href={`/accounts/${params.slug}/manual-entry/new`}
                className={buttonClass({ variant: "secondary", size: "md" })}
              >
                <Plus size={14} strokeWidth={1.75} />
                <span>Manual entry</span>
              </Link>
              <Link
                href={`/accounts/${params.slug}/invoices`}
                className={`group ${buttonClass({ variant: "primary", size: "md" })}`}
              >
                <FileText size={14} strokeWidth={1.75} />
                <span>Invoices</span>
                <ArrowRight
                  size={12}
                  strokeWidth={2}
                  className="opacity-70 transition-transform duration-fast ease-expo group-hover:translate-x-0.5"
                />
              </Link>
            </>
          ) : (
            <Link
              href={`/accounts/${params.slug}/invoices`}
              className={`group ${buttonClass({ variant: "primary", size: "md" })}`}
            >
              <FileText size={14} strokeWidth={1.75} />
              <span>Invoices</span>
              <ArrowRight
                size={12}
                strokeWidth={2}
                className="opacity-70 transition-transform duration-fast ease-expo group-hover:translate-x-0.5"
              />
            </Link>
          )
        }
      />

      <div className="mx-auto w-full max-w-[1600px] px-7">
        <div
          className={`flex flex-wrap items-center gap-3 pt-4 ${
            editable ? "justify-between" : "justify-start"
          }`}
        >
          {editable && (
            <AccountTabs slug={params.slug} showProfile={canEditProfile} showPricing={editable} />
          )}
          <DashboardFilters from={from} to={to} />
        </div>

        <div className="py-6 space-y-6">
        <AccountHeadline
          revenue={summary?.revenue ?? 0}
          momDelta={momDelta}
          briefing={briefing}
          orgRevenue={orgKpis.revenue}
          hits={summary?.hits ?? 0}
          avgPrice={avgPrice}
          successRate={summary?.hits ? successRate : null}
          apisUsed={summary?.apis_used ?? 0}
          topApiLabel={topApi && topApi.share > 0 ? `${topApi.share.toFixed(0)}%` : undefined}
          leak={leakProp}
        />

        {/* Chart band: the trend plot flexes; a fixed rail holds the compact
            call-status donut and the ~250px-wide heatmap, which drowned in a
            full-width card of its own. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] gap-6 items-start">
          <TrendCard
            data={series}
            title={showCost ? "Daily revenue & margin" : "Daily revenue"}
            caption={chartCaption}
            height={380}
            confidence={confidence}
          />
          <div className="flex flex-col gap-6">
            <section
              className="elev-1 bg-bg-raised rounded-lg p-5 dash-enter"
              style={{ "--i": 5 } as React.CSSProperties}
            >
              <h2 className="font-serif text-base text-ink mb-3" style={{ fontWeight: 600 }}>
                Call status
              </h2>
              <ApiStatusChart breakdown={statusBreakdown} size="md" />
            </section>
            <div className="dash-enter" style={{ "--i": 6 } as React.CSSProperties}>
              <ActivityHeatmap data={activity} windowEnd={to} windowDays={90} />
            </div>
          </div>
        </div>

        <section className="dash-enter" style={{ "--i": 7 } as React.CSSProperties}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-ink" style={{ fontWeight: 600 }}>
              API breakdown
            </h2>
            {editable && (
              <Link
                href={`/accounts/${params.slug}/pricing`}
                className="group flex items-center gap-0.5 text-sm text-accent-ink hover:text-accent transition-colors duration-fast ease-expo"
              >
                Manage pricing
                <ChevronRight
                  size={14}
                  strokeWidth={1.75}
                  className="transition-transform duration-fast ease-expo group-hover:translate-x-0.5"
                />
              </Link>
            )}
          </div>
          <ApiBreakdownTable
            breakdown={breakdown}
            accountId={id}
            editable={false}
            slug={params.slug}
            canDismiss={editable}
          />
        </section>

        <section className="dash-enter" style={{ "--i": 8 } as React.CSSProperties}>
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical size={18} strokeWidth={1.75} className="text-ink-muted" />
            <h2 className="font-serif text-xl text-ink" style={{ fontWeight: 600 }}>
              Sandbox usage
            </h2>
            {sandboxUsage.length > 0 && (
              <span className="text-sm text-ink-muted">
                {formatMoney(
                  sandboxUsage.reduce((s, r) => s + r.suppressed_revenue, 0),
                  { compact: true }
                )}{" "}
                excluded from billing
              </span>
            )}
          </div>
          {sandboxUsage.length === 0 ? (
            <div className="bg-bg-raised border border-border rounded-lg p-5 text-sm text-ink-muted">
              No usage is classified as sandbox in this window. Sandbox usage is excluded from
              revenue, dashboards, and invoices.
            </div>
          ) : (
            <div className="bg-bg-raised border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-bg-sunken text-ink-faint text-[11px] uppercase tracking-wide">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">API</th>
                      <th className="px-3 py-3 font-medium">Active</th>
                      <th className="px-3 py-3 font-medium text-right">Hits</th>
                      <th className="px-3 py-3 font-medium text-right">Excluded revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sandboxUsage.map((r) => (
                      <tr key={r.api_code}>
                        <td className="px-4 py-3">
                          <TruncateTooltip as="div" text={r.api_name} className="text-ink" />
                          <span className="text-ink-faint font-mono tnum text-xs">{r.api_code}</span>
                        </td>
                        <td className="px-3 py-3 text-ink-muted text-xs whitespace-nowrap">
                          {r.first_day === r.last_day
                            ? formatDay(r.first_day)
                            : formatDateRange(r.first_day, r.last_day)}
                        </td>
                        <td className="px-3 py-3 text-right text-ink font-mono tnum">
                          {formatNumber(r.hits)}
                        </td>
                        <td className="px-3 py-3 text-right text-ink font-mono tnum">
                          {formatMoney(r.suppressed_revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
        </div>
      </div>
    </main>
  );
}

function isoDaysBefore(end: string, daysBefore: number): string {
  const d = new Date(end + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysBefore);
  return d.toISOString().slice(0, 10);
}

function computeSuccessHits(
  breakdown: { successful: number; successful_no_data: number }[]
): number {
  return breakdown.reduce((s, b) => s + b.successful + b.successful_no_data, 0);
}
