import Link from "next/link";
import { requireRole } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { ReconTable, type ReconShow } from "@/components/vendor/ReconTable";
import {
  reconRows,
  reconSummary,
  isOpen,
  DELTA_THRESHOLD_PCT,
  MIN_HITS_FOR_FLAG,
} from "@/lib/repos/vendor-recon";
import { resolvePeriod } from "@/lib/period";
import { formatINR, formatNumber, formatPercent, formatDateRange, formatDay } from "@/lib/format";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VendorReconPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; show?: string };
}) {
  await requireRole("admin");
  const window = resolvePeriod(searchParams);
  const [rows, summary] = await Promise.all([
    reconRows(window.from, window.to),
    reconSummary(window.from, window.to),
  ]);

  const show: ReconShow =
    searchParams?.show === "all" ? "all" : searchParams?.show === "accepted" ? "accepted" : "open";
  const open = rows.filter(isOpen);
  const unmatched = rows.filter((r) => r.api_code == null && r.vendor_hits > 0);
  const qs = (s: ReconShow) =>
    `/vendors/reconciliation?from=${window.from}&to=${window.to}${s === "open" ? "" : `&show=${s}`}`;

  return (
    <main>
      <StatusBar
        title="Vendor reconciliation"
        subtitle={`${formatDateRange(window.from, window.to)} · vendor data through ${
          summary.vendor_data_through ? formatDay(summary.vendor_data_through) : "— not synced"
        }`}
      />

      <div className="mx-auto w-full max-w-[1600px] px-7 pt-5">
        <DateRangePicker from={window.from} to={window.to} />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-7 py-6 space-y-5">
        {/* The headline is the agreement, not the disagreements. Leading with 85
            open items would read as 85 counting errors; the totals agree to a
            fraction of a percent, and what differs is attribution. */}
        <section className="elev-1 bg-bg-raised rounded-lg p-6">
          <div className="flex flex-wrap items-start gap-x-12 gap-y-5">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-ink-muted">
                Total volume, both sides
              </h2>
              <div className="flex items-baseline gap-3 mt-[6px]">
                <span className="font-serif text-4xl text-ink tnum" style={{ fontWeight: 600 }}>
                  {summary.delta_pct == null
                    ? "—"
                    : `${summary.delta_pct > 0 ? "+" : ""}${formatPercent(summary.delta_pct, 2)}`}
                </span>
                <span className="text-sm text-ink-muted tnum">
                  {formatNumber(summary.our_hits)} ours vs {formatNumber(summary.vendor_hits)}{" "}
                  vendor-side
                </span>
              </div>
            </div>
            <div>
              <h2 className="text-xs uppercase tracking-widest text-ink-muted">
                Unexplained vendor spend
              </h2>
              <div className="font-serif text-4xl text-ink tnum mt-[6px]" style={{ fontWeight: 600 }}>
                {summary.open_delta_cost > 0 ? formatINR(summary.open_delta_cost) : "₹0"}
              </div>
              <div className="text-xs text-ink-faint mt-1">
                priced gaps only — most pairs still have no rate
              </div>
            </div>
            <div>
              <h2 className="text-xs uppercase tracking-widest text-ink-muted">Items</h2>
              <div className="font-serif text-4xl text-ink tnum mt-[6px]" style={{ fontWeight: 600 }}>
                {formatNumber(open.length)}
              </div>
              <div className="text-xs text-ink-faint mt-1">
                over {DELTA_THRESHOLD_PCT}%, of {formatNumber(rows.length)} pairs
              </div>
            </div>
          </div>

          <p className="text-sm text-ink-muted mt-5 max-w-3xl leading-normal">
            The vendor-side table records what each provider served; Ledgerline counts what a customer
            was billed for. The two agree on total volume, so the per-pair gaps below are almost
            never miscounting — they are calls a vendor served with no customer behind them, or
            traffic attributed to the wrong vendor on one side. Where a rate exists, the gap has a
            rupee value; where it does not, the gap is still real and the cost of it is unknown.
          </p>
          <p className="text-xs text-ink-faint mt-3 max-w-3xl leading-snug">
            In-progress hits are excluded on both sides — the vendor table has no such column.
            Sandbox traffic is included, because a vendor bills for a call whether or not Ledgerline
            bills a customer for it. A pair is flagged when the gap exceeds{" "}
            {DELTA_THRESHOLD_PCT}% and either side carries at least {MIN_HITS_FOR_FLAG} hits.
          </p>
        </section>

        {/* Unmatched names come first: they are the one category here that a
            person can actually close, by adding an alias. */}
        {unmatched.length > 0 && (
          <section className="elev-1 bg-bg-raised rounded-lg p-5">
            <h2 className="font-serif text-base text-ink" style={{ fontWeight: 600 }}>
              {unmatched.length} vendor-side name{unmatched.length === 1 ? "" : "s"} match no API in
              the catalog
            </h2>
            <p className="text-sm text-ink-muted mt-1 max-w-3xl leading-normal">
              The vendor table carries no product code, so its API names are matched against each
              API&apos;s name and log aliases. These did not match, so their volume reconciles
              against nothing. Add the name as an alias on the right API, then re-run{" "}
              <span className="font-mono text-xs">npm run vendor-sync</span> to repair history.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {unmatched
                .slice()
                .sort((a, b) => b.vendor_hits - a.vendor_hits)
                .map((r) => (
                  <span
                    key={`${r.vendor}:${r.raw_api_name}`}
                    className="inline-flex items-baseline gap-2 text-xs bg-bg-sunken rounded px-2 py-1"
                  >
                    <span className="text-ink">{r.raw_api_name}</span>
                    <span className="font-mono text-ink-faint tnum">
                      {r.vendor} · {formatNumber(r.vendor_hits)}
                    </span>
                  </span>
                ))}
            </div>
            <Link
              href="/admin/api-review"
              className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline mt-3"
            >
              API review <ArrowRight size={11} strokeWidth={1.75} />
            </Link>
          </section>
        )}

        <ReconTable
          rows={rows}
          show={show}
          hrefFor={qs}
          periodFrom={window.from}
          syncedThrough={summary.vendor_data_through}
        />
      </div>
    </main>
  );
}
