import Link from "next/link";
import { requireRole } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { ConfidenceBar } from "@/components/vendor/ConfidenceBar";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { costWorklist, listVendors } from "@/lib/repos/vendor-cost";
import { resolvePeriod } from "@/lib/period";
import { formatINR, formatNumber, formatPercent, formatDateRange } from "@/lib/format";
import { Truck } from "lucide-react";

export default async function VendorLibraryPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string };
}) {
  await requireRole("admin");
  const period = resolvePeriod(searchParams);
  const [vendors, worklist] = await Promise.all([
    listVendors(period.from, period.to),
    costWorklist(period.from, period.to),
  ]);

  const totalCost = vendors.reduce((s, v) => s + v.total_cost, 0);
  const totalHits = vendors.reduce((s, v) => s + v.total_hits, 0);
  const totalApis = vendors.reduce((s, v) => s + v.api_count, 0);
  const pricedApis = vendors.reduce((s, v) => s + v.priced_apis, 0);
  const knownHits = vendors.reduce(
    (s, v) =>
      s +
      v.confidence.contracted +
      v.confidence.quoted +
      v.confidence.estimated +
      v.confidence.not_billed,
    0,
  );
  const withTraffic = vendors.filter((v) => v.total_hits > 0).length;
  const coverage = totalHits > 0 ? (knownHits / totalHits) * 100 : 0;

  return (
    <main>
      <StatusBar
        title="Vendors"
        subtitle={`${vendors.length} vendors · ${formatDateRange(period.from, period.to)} · open a vendor for its rate card and reconciliation`}
      />
        <div className="mx-auto w-full max-w-[1600px] px-7 pt-5">
        <DateRangePicker from={period.from} to={period.to} />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-7 py-6 space-y-5">
        {/* The COO question: what are we paying vendors, and how much of that
            figure do we actually know? The second half is the point — a cost
            total with no coverage figure beside it invites false confidence. */}
        <section
          className="elev-1 bg-bg-raised rounded-lg p-6 dash-enter"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <h2 className="text-xs uppercase tracking-widest text-ink-muted">Vendor cost</h2>
          <div className="flex items-end gap-3 mt-[6px]">
            <span className="inline-block">
              <span
                className="block font-serif text-5xl text-ink leading-none tnum landmark-wipe"
                style={{ fontWeight: 600 }}
              >
                {formatINR(totalCost, { precision: 0 })}
              </span>
              <span className="block h-px bg-accent mt-2 landmark-rail" aria-hidden="true" />
            </span>
          </div>
          <p className="text-sm text-ink-muted mt-3 max-w-2xl leading-normal">
            Across {withTraffic} vendor{withTraffic === 1 ? "" : "s"} serving {totalApis} API
            {totalApis === 1 ? "" : "s"} in this period.{" "}
            {totalHits === 0 ? (
              "No traffic in this period."
            ) : coverage >= 99.5 ? (
              "Every hit is costed at a known rate."
            ) : (
              <span className="text-warn-ink">
                Cost is known on {formatPercent(coverage, 1)} of hits — {pricedApis} of {totalApis}{" "}
                APIs with traffic have a rate. This total counts only those; the rest are
                unknown, not free.
              </span>
            )}
          </p>
          {/* Coverage says how much is unknown; this says what to do about it.
              Two different jobs: an API with no vendor needs routing, a pair
              with a vendor and no rate needs a contract. Counted as
              pairs, because one API served by three vendors is three rates. */}
          {(worklist.unrouted_apis > 0 || worklist.unrated_pairs > 0) && (
            <p className="text-sm text-ink-muted mt-2 max-w-2xl leading-normal">
              {worklist.unrated_pairs > 0 && (
                <>
                  <span className="text-ink">{formatNumber(worklist.unrated_pairs)}</span>{" "}
                  vendor–API pair{worklist.unrated_pairs === 1 ? "" : "s"} carry{" "}
                  {formatNumber(worklist.unrated_hits)} hits with a vendor but no rate.{" "}
                </>
              )}
              {worklist.unrouted_apis > 0 && (
                <>
                  <span className="text-ink">{formatNumber(worklist.unrouted_apis)}</span> API
                  {worklist.unrouted_apis === 1 ? "" : "s"} carry{" "}
                  {formatNumber(worklist.unrouted_hits)} hits with no vendor at all.{" "}
                </>
              )}
              Sandbox traffic is excluded
              {worklist.unrouted_apis > 0 && worklist.unrated_pairs > 0 ? " from both" : ""}.
              {worklist.sandbox_only_pairs > 0 && (
                <>
                  {" "}
                  A further {formatNumber(worklist.sandbox_only_pairs)} unrated pair
                  {worklist.sandbox_only_pairs === 1 ? "" : "s"} appear only in sandbox
                  ({formatNumber(worklist.sandbox_only_hits)} hits) — still vendor spend, unless
                  the vendor&rsquo;s page says it does not charge for sandbox calls.
                </>
              )}
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vendors.map((v, idx) => {
            // The bar and the number must say the same thing: both are the
            // vendor's share of total cost.
            const share = totalCost > 0 ? (v.total_cost / totalCost) * 100 : 0;
            return (
              <Link
                key={v.vendor_name}
                href={`/vendors/${encodeURIComponent(v.vendor_name)}`}
                className="block bg-bg-raised rounded-md p-5 row-enter border border-border hover:border-accent transition-colors duration-fast ease-expo"
                style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Truck size={14} strokeWidth={1.5} className="text-ink-muted" />
                      <div className="font-serif text-2xl text-ink leading-tight" style={{ fontWeight: 600 }}>
                        {v.vendor_name}
                      </div>
                      {v.status === "inactive" && (
                        <span
                          className="text-[10px] uppercase tracking-widest text-ink-faint border border-border rounded px-1.5 py-0.5"
                          title="We no longer send this vendor work. Its rates and history are unchanged."
                        >
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="text-xs text-ink-faint">Vendor cost</div>
                    <div className="font-serif text-3xl text-ink tnum leading-none mt-1" style={{ fontWeight: 600 }}>
                      {formatINR(v.total_cost, { compact: true })}
                    </div>
                    {/* A total larger than the sum of this vendor's APIs is not
                        an error — it is the floor binding. Say which part. */}
                    {v.minimum_top_up > 0 && (
                      <div
                        className="text-[10px] text-warn-ink mt-1"
                        title="A monthly minimum topped light months up to the contracted floor. It belongs to no API, so the rate card rows sum to less than this."
                      >
                        incl. {formatINR(v.minimum_top_up, { compact: true })} minimum
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wide text-ink-faint">
                      Share of total cost
                    </span>
                    <span className="text-xs font-mono tnum text-accent-ink">
                      {totalCost > 0 ? formatPercent(share, 0) : "—"}
                    </span>
                  </div>
                  <div className="h-[6px] rounded bg-bg-sunken overflow-hidden">
                    {v.total_cost > 0 && (
                      <div
                        className="h-full rounded bg-accent bar-grow"
                        style={
                          { width: `${Math.max(1, share)}%`, "--i": Math.min(idx, 12) } as React.CSSProperties
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-wide text-ink-faint mb-1">
                    Cost confidence
                  </div>
                  <ConfidenceBar confidence={v.confidence} />
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs hairline pt-3">
                  <div>
                    <dt className="text-ink-faint text-[10px] uppercase tracking-wide">
                      APIs priced
                    </dt>
                    <dd className="font-mono tnum mt-0.5 text-ink">
                      {v.api_count > 0 ? `${v.priced_apis} of ${v.api_count}` : `${v.rated_pairs} on card`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint text-[10px] uppercase tracking-wide">Hits</dt>
                    <dd className="font-mono tnum mt-0.5 text-ink">
                      {v.total_hits > 0 ? formatNumber(v.total_hits) : "—"}
                    </dd>
                  </div>
                </dl>

                {v.total_hits === 0 && (
                  <div className="text-xs text-ink-faint mt-3">
                    No traffic this period — rates can still be set.
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
