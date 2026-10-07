import Link from "next/link";
import { generateSlug } from "@/lib/slug";
import { notFound } from "next/navigation";
import { StatusBar } from "@/components/StatusBar";
import { ApiHeadline } from "@/components/apis/ApiHeadline";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import {
  getApi,
  getApiSummaries,
  getApiTopAccounts,
  getApiActivity,
  getApiPriceVariance,
  getApiTopConsumer,
  parseAliases,
} from "@/lib/repos/apis";
import { getSessionUser, can, canViewCost } from "@/lib/access";
import { EditApiButton } from "@/components/apis/EditApiButton";
import { getKpis } from "@/lib/repos/usage";
import { costConfidence } from "@/lib/repos/vendor-cost";
import { confirmedShare } from "@/lib/vendor-confidence";
import { getIncludeSandbox } from "@/lib/repos/settings";
import { prevMonthOf } from "@/lib/repos/periods";
import { resolvePeriod } from "@/lib/period";
import { briefingComposer } from "@/lib/briefing";
import { formatMoney, formatNumber, formatPrice } from "@/lib/format";
import { Users } from "lucide-react";

export default async function ApiProfilePage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams?: { from?: string; to?: string };
}) {
  const api = await getApi(params.code);
  if (!api) notFound();
  const user = await getSessionUser();
  // Margin on this page is the derived figure, not the rate card, so it follows
  // canViewCost rather than an inline admin test.
  const showCost = canViewCost(user?.role ?? "member");
  const canEditApi = can(user?.role ?? "member", "api.update");

  const window = resolvePeriod(searchParams);
  const prev = prevMonthOf(window.from);
  const ninetyDaysAgo = isoDaysBefore(window.to, 89);
  const includeSandbox = await getIncludeSandbox();
  const [allSummaries, topAccounts, variance, topConsumer, activity, prevSummaries, orgKpis, confidence] =
    await Promise.all([
      getApiSummaries({ ...window, includeCost: showCost, includeSandbox }),
      getApiTopAccounts(params.code, { ...window, includeSandbox }),
      getApiPriceVariance(params.code),
      getApiTopConsumer(params.code, { ...window, includeSandbox }),
      getApiActivity(params.code, { from: ninetyDaysAgo, to: window.to, includeSandbox }),
      getApiSummaries({ from: prev.from, to: prev.to, includeCost: showCost, includeSandbox }),
      getKpis({ ...window, includeSandbox }),
      // Scoped to this API and to the same sandbox rule as its margin.
      showCost
        ? costConfidence({ ...window, apiCode: params.code, includeSandbox })
        : Promise.resolve(null),
    ]);
  const summary = allSummaries.find((a) => a.product_code === params.code);
  const prevSummary = prevSummaries.find((a) => a.product_code === params.code);
  const momDelta =
    prevSummary && prevSummary.revenue > 0 && summary && summary.revenue > 0
      ? ((summary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100
      : null;

  const briefing = briefingComposer.composeApiBriefing({
    product_code: api.product_code,
    name: api.name,
    revenue: summary?.revenue ?? 0,
    total_hits: summary?.total_hits ?? 0,
    unique_accounts: summary?.unique_accounts ?? 0,
    avg_unit_price: summary?.avg_unit_price ?? 0,
    margin: summary?.margin ?? null,
    margin_pct:
      summary && summary.revenue > 0 && summary.margin != null
        ? (summary.margin / summary.revenue) * 100
        : null,
    cost_confirmed_pct: confidence ? confirmedShare(confidence) : null,
    price_min: variance?.min ?? null,
    price_max: variance?.max ?? null,
    top_account: topConsumer ? { name: topConsumer.name, revenue_share: topConsumer.share } : null,
  });


  return (
    <main>
      <StatusBar
        title={api.name}
        subtitle={[`Code ${api.product_code}`, `Billed per ${api.unit}`, api.vendor_type]
          .filter(Boolean)
          .join(" · ")}
        actions={
          canEditApi ? (
            <EditApiButton
              api={{
                product_code: api.product_code,
                name: api.name,
                category: api.category,
                unit: api.unit,
                vendor_type: api.vendor_type,
                default_vendor: api.default_vendor,
                log_aliases: parseAliases(api.log_aliases),
                is_active: Number(api.is_active),
              }}
            />
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-[1600px] px-7 py-6 space-y-6">
        <ApiHeadline
          revenue={summary?.revenue ?? 0}
          momDelta={momDelta}
          briefing={briefing}
          orgRevenue={orgKpis.revenue}
          marginPct={
            summary && summary.revenue > 0 && summary.margin != null
              ? (summary.margin / summary.revenue) * 100
              : null
          }
          hits={summary?.total_hits ?? 0}
          accounts={summary?.unique_accounts ?? 0}
          avgPrice={summary?.avg_unit_price ?? 0}
          unit={api.unit}
          spread={variance && variance.min > 0 ? { min: variance.min, max: variance.max } : null}
          confidence={confidence}
          costFixHref={
            api.default_vendor
              ? `/vendors/${encodeURIComponent(api.default_vendor)}`
              : undefined
          }
        />

        <div className="dash-enter" style={{ "--i": 1 } as React.CSSProperties}>
          <ActivityHeatmap data={activity} windowEnd={window.to} windowDays={90} />
        </div>

        {/* Account consumers — the price ladder makes per-customer variance
            visible: each negotiated price drawn as a bar against the highest. */}
        <section className="dash-enter" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-ink" style={{ fontWeight: 600 }}>
              Account consumers
            </h2>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <Users size={12} strokeWidth={1.5} />
              <span>{summary?.unique_accounts ?? 0} accounts</span>
            </div>
          </div>
          <div className="bg-bg-raised border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: 880 }}>
              <colgroup>
                <col style={{ width: "26%" }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 110 }} />
                <col />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead className="bg-bg-sunken text-ink-faint text-[11px] uppercase tracking-wide sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-3 py-3 font-medium text-right">Units</th>
                  <th className="px-3 py-3 font-medium text-right">Negotiated</th>
                  <th className="px-3 py-3 font-medium">Price ladder</th>
                  <th className="px-3 py-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(() => {
                  // SUM()/MAX() come back from the driver as NUMERIC strings —
                  // coerce once here so formatters and comparisons see numbers.
                  const rows = topAccounts.map((c) => ({
                    ...c,
                    hits: Number(c.hits ?? 0),
                    s_hits: Number(c.s_hits ?? 0),
                    revenue: Number(c.revenue ?? 0),
                    p_s: Number(c.p_s ?? 0),
                  }));
                  const maxPrice = rows.reduce((m, c) => Math.max(m, c.p_s), 0);
                  return rows.map((c, i) => {
                    const isStitched = c.bundle_name != null;
                    const isUnpriced = c.p_s === 0 && c.hits > 0 && !isStitched;
                    const ladderPct = maxPrice > 0 && c.p_s > 0 ? (c.p_s / maxPrice) * 100 : 0;
                    return (
                      <tr
                        key={`${c.client_id}-${i}`}
                        className={`row-enter transition-colors duration-instant ease-expo ${
                          isUnpriced ? "bg-bad-bg hover:bg-bad-bg-hover" : "hover:bg-bg-sunken/40"
                        }`}
                        style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                      >
                        <td className="px-4 py-3 min-w-0">
                          <Link
                            href={`/accounts/${generateSlug(c.display_name ?? String(c.client_id))}`}
                            className={`hover:text-accent-ink ${isUnpriced ? "text-bad-ink" : "text-ink"}`}
                          >
                            {c.display_name ?? "—"}
                          </Link>
                          {isUnpriced && (
                            <span className="ml-2 text-[11px] uppercase tracking-wider text-bad-ink px-[6px] py-[2px] rounded border border-bad">
                              Unpriced
                            </span>
                          )}
                          {isStitched && (
                            <span
                              title={`Billed via the stitch "${c.bundle_name}" for this account`}
                              className="ml-2 text-[11px] uppercase tracking-wider text-accent-ink px-[6px] py-[2px] rounded border border-accent/30"
                            >
                              Stitched
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">
                          {formatNumber(c.hits)}
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-mono tabular-nums ${
                            isUnpriced ? "text-bad-ink" : "text-ink"
                          }`}
                        >
                          {isUnpriced ? "—" : formatPrice(c.p_s ?? 0)}
                        </td>
                        <td className="px-3 py-3">
                          <div
                            className={`h-[8px] rounded overflow-hidden ${
                              isUnpriced ? "bg-bad-bg-hover" : "bg-bg-sunken"
                            }`}
                          >
                            {ladderPct > 0 && (
                              <div
                                className="h-full rounded bg-accent bar-grow"
                                style={
                                  {
                                    width: `${Math.max(2, ladderPct)}%`,
                                    "--i": Math.min(i, 12),
                                  } as React.CSSProperties
                                }
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">
                          {formatMoney(c.revenue ?? 0, { precision: 0 })}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            {topAccounts.length === 0 && (
              <div className="px-6 py-10 text-center text-ink-muted">
                No account usage for this SKU in this window.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function isoDaysBefore(end: string, daysBefore: number): string {
  const d = new Date(end + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysBefore);
  return d.toISOString().slice(0, 10);
}
