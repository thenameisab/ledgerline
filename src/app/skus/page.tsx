import Link from "next/link";
import { StatusBar } from "@/components/StatusBar";
import { SortHeader } from "@/components/SortHeader";
import { applySort } from "@/lib/sort";
import { ApisFilterBar } from "./ApisFilterBar";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { getApiSummaries } from "@/lib/repos/apis";
import { resolvePeriod } from "@/lib/period";
import { formatMoney, formatNumber, formatDateRange } from "@/lib/format";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { ApiHoverCard } from "@/components/ApiHoverCard";
import { getSessionUser, canViewCost } from "@/lib/access";

export default async function ApisPage({
  searchParams,
}: {
  searchParams: { sort?: string; q?: string; filter?: string; from?: string; to?: string };
}) {
  const user = await getSessionUser();
  const showCost = canViewCost(user?.role ?? "member");
  // resolvePeriod() was called with no arguments, so /apis ignored from/to in
  // the URL and had no control to change them — a deep link showed a different
  // window than it named (Fix Register #19). The counts below are stated per
  // period, so the period has to be real.
  const period = resolvePeriod(searchParams);
  const all = await getApiSummaries({ ...period, includeCost: showCost, includeAllCatalog: true });

  // An API with no vendor rate computes ₹0 cost and so reads 100% margin.
  // Both cost chips key off whether any of an API's hits carry a known rate:
  // "Low margin" covers only APIs with measured margin, and "Cost unknown"
  // lists the APIs it cannot cover.
  const measured = (a: (typeof all)[number]) => (a.cost_known_hits ?? 0) > 0;
  const coverage = (a: (typeof all)[number]) =>
    a.total_hits > 0 ? (a.cost_known_hits ?? 0) / a.total_hits : 0;

  // Filter chips: all | high-volume | low-margin | cost-unknown | inactive
  const filtered = all.filter((a) => {
    if (searchParams.q) {
      const q = searchParams.q.toLowerCase();
      const hay = `${a.name} ${a.product_code}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (!searchParams.filter || searchParams.filter === "all") return true;
    if (searchParams.filter === "high-volume") return a.total_hits >= 1000;
    if (searchParams.filter === "low-margin")
      return (
        showCost && measured(a) && a.margin != null && a.revenue > 0 && a.margin / a.revenue < 0.25
      );
    if (searchParams.filter === "cost-unknown")
      return showCost && !measured(a) && a.total_hits > 0;
    if (searchParams.filter === "inactive") return a.total_hits === 0;
    return true;
  });

  // Stated on the page rather than left to be inferred from an empty table.
  const trafficked = all.filter((a) => a.total_hits > 0);
  const measuredCount = trafficked.filter(measured).length;

  const sorted = applySort(filtered, searchParams.sort, "revenue", "desc");

  return (
    <main>
      <StatusBar
        title="APIs"
        subtitle={`${sorted.length} of ${all.length} APIs · ${formatDateRange(period.from, period.to)} · ranked by ${(searchParams.sort ?? "revenue.desc").replace(".", " ")}`}
      />
      <div className="mx-auto w-full max-w-[1600px] px-7 py-6 space-y-4">
        <DateRangePicker from={period.from} to={period.to} />
        <ApisFilterBar active={searchParams} showCost={showCost} />

        <div className="bg-bg-raised border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: 880 }}>
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 110 }} />
              <col />
              {showCost && <col style={{ width: 130 }} />}
            </colgroup>
            <thead className="bg-bg-sunken text-ink-faint text-[11px] uppercase tracking-wide">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium"><SortHeader column="name" label="API" /></th>
                <th className="px-3 py-3 font-medium text-right"><SortHeader column="total_hits" label="Hits" align="right" /></th>
                <th className="px-3 py-3 font-medium text-right"><SortHeader column="unique_accounts" label="Accounts" align="right" /></th>
                <th className="px-3 py-3 font-medium text-right"><SortHeader column="avg_unit_price" label="Avg ₹/hit" align="right" /></th>
                <th className="px-3 py-3 font-medium text-right"><SortHeader column="revenue" label="Revenue" align="right" /></th>
                <th className="px-3 py-3 font-medium">Share</th>
                {showCost && (
                  <th className="px-3 py-3 font-medium text-right"><SortHeader column="margin" label="Margin" align="right" /></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(() => {
                const max = sorted.reduce((m, a) => Math.max(m, a.revenue), 0) || 1;
                return sorted.map((a, i) => {
                  const negative = showCost && a.margin != null && a.margin < 0;
                  const silent = a.revenue === 0 && a.total_hits > 0;
                  const marginPct =
                    showCost && a.margin != null && a.revenue > 0 ? (a.margin / a.revenue) * 100 : null;
                  return (
                    <tr
                      key={a.product_code}
                      className={`row-enter transition-colors duration-instant ease-expo ${
                        negative
                          ? "bg-bad-bg hover:bg-bad-bg-hover"
                          : silent
                          ? "bg-warn-bg hover:bg-warn-bg-hover"
                          : "hover:bg-bg-sunken/40"
                      }`}
                      style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                    >
                      <td className="px-4 py-3 min-w-0">
                        <ApiHoverCard code={a.product_code} side="right">
                        <Link href={`/skus/${a.product_code}`} className="block min-w-0 hover:text-accent-ink">
                          <TruncateTooltip
                            as="div"
                            text={a.name}
                            className="text-sm leading-tight text-ink"
                            style={{ fontWeight: 500 }}
                          />
                          <div className="text-[11px] font-mono text-ink-faint mt-[2px]">
                            {a.product_code}
                            {silent && (
                              <span className="text-warn-ink"> · earns nothing on {formatNumber(a.total_hits)} hits</span>
                            )}
                          </div>
                        </Link>
                        </ApiHoverCard>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">{formatNumber(a.total_hits)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-muted">{a.unique_accounts}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">
                        {a.avg_unit_price > 0 ? `₹${a.avg_unit_price.toFixed(2)}` : <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-ink" style={{ fontWeight: a.revenue > 0 ? 500 : 400 }}>
                        {a.revenue > 0 ? formatMoney(a.revenue, { compact: true }) : <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className={`h-[8px] rounded overflow-hidden ${negative ? "bg-bad-bg-hover" : silent ? "bg-warn-bg-hover" : "bg-bg-sunken"}`}>
                          {a.revenue > 0 && (
                            <div
                              className="h-full rounded bg-accent bar-grow"
                              style={
                                {
                                  width: `${Math.max(2, (a.revenue / max) * 100)}%`,
                                  "--i": Math.min(i, 12),
                                } as React.CSSProperties
                              }
                            />
                          )}
                        </div>
                      </td>
                      {showCost && (
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          {!measured(a) ? (
                            // Revenue minus a cost of zero is not a margin. An
                            // API with no rate says so instead of reading 100%.
                            <span
                              className="text-ink-faint"
                              title={
                                a.total_hits > 0
                                  ? `No vendor rate covers this API's ${formatNumber(a.total_hits)} hits, so its cost computes to ₹0 and a margin cannot be stated.`
                                  : "No traffic in this period."
                              }
                            >
                              {a.total_hits > 0 ? "no rate" : "—"}
                            </span>
                          ) : (
                            <>
                              <span className={negative ? "text-bad-ink" : coverage(a) < 1 ? "text-ink-muted" : "text-ink"}>
                                {formatMoney(a.margin ?? 0, { compact: true })}
                              </span>
                              {marginPct != null && (
                                <span className={`text-[11px] ml-1 ${negative ? "text-bad-ink" : "text-ink-faint"}`}>
                                  {marginPct.toFixed(0)}%
                                </span>
                              )}
                              {coverage(a) < 1 && (
                                <div
                                  className="text-[10px] text-ink-faint mt-[2px]"
                                  title={`A rate covers ${formatNumber(a.cost_known_hits ?? 0)} of ${formatNumber(a.total_hits)} hits; the rest cost ₹0 in this figure.`}
                                >
                                  rate on {(coverage(a) * 100).toFixed(0)}% of hits
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                });
              })()}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={showCost ? 7 : 6} className="px-6 py-12 text-center text-sm text-ink-muted">
                    {searchParams.filter === "low-margin" && showCost ? (
                      // An empty low-margin list reads as "nothing is
                      // unprofitable". At this coverage it means "almost
                      // nothing can be checked", which is a different fact.
                      <>
                        No API with a known vendor rate has margin under 25%.
                        <div className="text-xs text-ink-faint mt-2">
                          A rate covers {measuredCount} of {trafficked.length} APIs with traffic
                          this period, so this filter can only see {measuredCount}
                          {measuredCount === 1 ? " of them" : " of them"}.{" "}
                          <Link href="/skus?filter=cost-unknown" className="text-accent-ink underline">
                            See the {trafficked.length - measuredCount} it cannot
                          </Link>
                          .
                        </div>
                      </>
                    ) : searchParams.filter === "cost-unknown" && showCost ? (
                      <>Every API with traffic this period has a vendor rate.</>
                    ) : (
                      <>No APIs matched your filters.</>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
