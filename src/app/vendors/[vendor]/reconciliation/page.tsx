import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { VendorTabs } from "@/components/vendor/VendorTabs";
import { ReconTable, type ReconShow } from "@/components/vendor/ReconTable";
import {
  reconRows,
  summariseRecon,
  vendorDataThrough,
  isOpen,
  DELTA_THRESHOLD_PCT,
  MIN_HITS_FOR_FLAG,
} from "@/lib/repos/vendor-recon";
import { vendorByName } from "@/lib/repos/vendor-cost";
import { resolvePeriod } from "@/lib/period";
import { formatINR, formatNumber, formatPercent, formatDateRange, formatDay } from "@/lib/format";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * One vendor's reconciliation: what it says it served against what Ledgerline
 * counted, for this vendor alone.
 *
 * The rows come from the same cached org-wide read the queue uses and are
 * filtered here rather than re-queried, so the two surfaces cannot disagree
 * about a pair and the second page costs nothing extra to open.
 */
export default async function VendorReconTabPage({
  params,
  searchParams,
}: {
  params: { vendor: string };
  searchParams?: { from?: string; to?: string; show?: string };
}) {
  const requested = decodeURIComponent(params.vendor);
  await requireRole("admin");
  const registry = await vendorByName(requested);
  if (!registry) notFound();
  // A link saved under a former name resolves through the alias and lands on
  // the canonical URL, the way a renamed account's slug does.
  if (registry.canonical_name !== requested) {
    const qs = new URLSearchParams();
    if (searchParams?.from) qs.set("from", searchParams.from);
    if (searchParams?.to) qs.set("to", searchParams.to);
    if (searchParams?.show) qs.set("show", searchParams.show);
    const tail = qs.toString();
    redirect(
      `/vendors/${encodeURIComponent(registry.canonical_name)}/reconciliation${tail ? `?${tail}` : ""}`,
    );
  }
  const vendor = registry.canonical_name;

  const window = resolvePeriod(searchParams);
  const [allRows, syncedThrough] = await Promise.all([
    reconRows(window.from, window.to),
    vendorDataThrough(),
  ]);
  const rows = allRows.filter((r) => r.vendor === vendor);
  const summary = summariseRecon(rows);

  const show: ReconShow =
    searchParams?.show === "all" ? "all" : searchParams?.show === "accepted" ? "accepted" : "open";
  const base = `/vendors/${encodeURIComponent(vendor)}/reconciliation`;
  const qs = (s: ReconShow) =>
    `${base}?from=${window.from}&to=${window.to}${s === "open" ? "" : `&show=${s}`}`;
  const carried = `from=${window.from}&to=${window.to}`;
  const unmatched = rows.filter((r) => r.api_code == null && r.vendor_hits > 0);

  return (
    <main>
      <StatusBar
        title={vendor}
        subtitle={`Reconciliation · ${formatDateRange(window.from, window.to)} · vendor data through ${
          syncedThrough ? formatDay(syncedThrough) : "— not synced"
        }`}
      />

      <div className="mx-auto w-full max-w-[1600px] px-7 pt-5 space-y-4">
        <VendorTabs vendor={vendor} query={carried} />
        <DateRangePicker from={window.from} to={window.to} />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-7 py-6 space-y-5">
        {/* Same framing as the cross-vendor queue: the headline is the
            agreement, not the disagreements. */}
        <section className="elev-1 bg-bg-raised rounded-lg p-6">
          <div className="flex flex-wrap items-start gap-x-12 gap-y-5">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-ink-muted">
                Volume, both sides
              </h2>
              <div className="font-serif text-3xl text-ink tnum mt-1.5" style={{ fontWeight: 600 }}>
                {summary.delta_pct == null
                  ? "—"
                  : `${summary.delta_pct > 0 ? "+" : ""}${formatPercent(summary.delta_pct, 2)}`}
              </div>
              <p className="text-xs text-ink-faint mt-1">
                {formatNumber(summary.our_hits)} ours vs {formatNumber(summary.vendor_hits)}{" "}
                {vendor}&rsquo;s
              </p>
            </div>
            <div>
              <h2 className="text-xs uppercase tracking-widest text-ink-muted">
                Unexplained spend
              </h2>
              <div className="font-serif text-3xl text-ink tnum mt-1.5" style={{ fontWeight: 600 }}>
                {summary.open_delta_cost > 0 ? formatINR(summary.open_delta_cost) : "₹0"}
              </div>
              <p className="text-xs text-ink-faint mt-1">
                volume {vendor} served that Ledgerline never costed
              </p>
            </div>
            <div>
              <h2 className="text-xs uppercase tracking-widest text-ink-muted">Items</h2>
              <div className="font-serif text-3xl text-ink tnum mt-1.5" style={{ fontWeight: 600 }}>
                {formatNumber(rows.filter(isOpen).length)}
              </div>
              <p className="text-xs text-ink-faint mt-1">
                over {DELTA_THRESHOLD_PCT}%, of {formatNumber(rows.length)} pairs
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-muted mt-5 max-w-3xl leading-normal">
            A pair is flagged when the two sides differ by more than{" "}
            {DELTA_THRESHOLD_PCT}% and the larger side carries at least{" "}
            {formatNumber(MIN_HITS_FOR_FLAG)} hits. Sandbox traffic counts on both sides —{" "}
            {vendor} invoices a call whether or not Ledgerline bills a customer for it. In-progress
            hits are excluded on both sides, because the vendor report has no column for them.
          </p>
        </section>

        {unmatched.length > 0 && (
          <section className="elev-1 bg-bg-raised rounded-lg p-6">
            <h2 className="text-xs uppercase tracking-widest text-ink-muted">
              {unmatched.length} name{unmatched.length === 1 ? "" : "s"} match no API in the catalog
            </h2>
            <p className="text-sm text-ink-muted mt-2 max-w-3xl leading-normal">
              {vendor} reports{" "}
              {formatNumber(unmatched.reduce((s, r) => s + r.vendor_hits, 0))} hits under names the
              catalog does not carry. Until each is aliased to a product code, its volume cannot be
              matched to ours or costed.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {unmatched.map((r) => (
                <span
                  key={r.raw_api_name}
                  className="inline-flex items-baseline gap-1.5 rounded border border-border bg-bg-sunken px-2 py-1 text-xs text-ink-muted"
                >
                  <span className="text-ink">{r.raw_api_name}</span>
                  <span className="text-ink-faint">{formatNumber(r.vendor_hits)}</span>
                </span>
              ))}
            </div>
            <Link
              href="/admin/api-review"
              className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline underline-offset-2 mt-4"
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
          syncedThrough={syncedThrough}
          showVendor={false}
        />
      </div>
    </main>
  );
}
