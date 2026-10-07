import Link from "next/link";
import { Scale } from "lucide-react";
import { FilterPill } from "@/components/ui/FilterPill";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { ReconDismissButton } from "@/components/vendor/ReconDismissButton";
import { isOpen, DELTA_THRESHOLD_PCT, type ReconRow } from "@/lib/repos/vendor-recon";
import { formatINR, formatNumber, formatPercent } from "@/lib/format";

// The reconciliation worklist: filter strip, empty states, table.
//
// One component for two pages. The cross-vendor queue asks "which vendor do I
// look at first" and the tab on a vendor's own page asks "what is wrong with
// this one" — the same rows, the same actions, the same rules about what
// counts as open, so the same table. The vendor column is the only difference,
// and it is dropped on the per-vendor page where every row would repeat it.

export type ReconShow = "open" | "accepted" | "all";

/** A six-digit percentage delta is not a number anyone reads. Past 999% the sign is the message. */
function deltaPct(r: ReconRow): string {
  if (r.delta_pct == null) return "—";
  const a = Math.abs(r.delta_pct);
  if (a > 999) return r.delta_pct > 0 ? ">+999%" : "<−999%";
  return `${r.delta_pct > 0 ? "+" : ""}${formatPercent(r.delta_pct, a < 10 ? 1 : 0)}`;
}

export function ReconTable({
  rows,
  show,
  hrefFor,
  periodFrom,
  syncedThrough,
  showVendor = true,
}: {
  /** Every row in scope. The strip filters it; the counts describe all of it. */
  rows: ReconRow[];
  show: ReconShow;
  /** Link builder for the filter strip, so each page keeps its own URL shape. */
  hrefFor: (show: ReconShow) => string;
  /** The window's first day — what a dismissal is scoped to. */
  periodFrom: string;
  /** Last day of vendor-side data, or null when nothing has been synced. */
  syncedThrough: string | null;
  showVendor?: boolean;
}) {
  const open = rows.filter(isOpen);
  const accepted = rows.filter((r) => r.dismissed);
  const shown = show === "all" ? rows : show === "accepted" ? accepted : open;

  return (
    <>
      <div className="flex items-center gap-2" role="tablist">
        <FilterPill label="Open" active={show === "open"} count={open.length} href={hrefFor("open")} />
        <FilterPill
          label="Accepted"
          active={show === "accepted"}
          count={accepted.length}
          href={hrefFor("accepted")}
        />
        <FilterPill label="All pairs" active={show === "all"} count={rows.length} href={hrefFor("all")} />
      </div>

      {shown.length === 0 ? (
        <section className="elev-1 bg-bg-raised rounded-lg p-8 text-center">
          <Scale size={20} strokeWidth={1.5} className="text-ink-faint mx-auto mb-2" />
          <div className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
            {syncedThrough == null
              ? "No vendor-side data yet"
              : show === "open"
                ? "Every pair reconciles within " + DELTA_THRESHOLD_PCT + "%"
                : show === "accepted"
                  ? "Nothing accepted this month"
                  : "No traffic on either side this period"}
          </div>
          {syncedThrough == null && (
            <p className="text-sm text-ink-muted mt-1">
              Run <span className="font-mono text-xs">npm run vendor-sync</span> to pull it.
            </p>
          )}
        </section>
      ) : (
        <div className="elev-1 bg-bg-raised rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted border-b border-border bg-bg-sunken">
                {showVendor && <th className="px-4 py-2.5 font-medium">Vendor</th>}
                <th className="px-4 py-2.5 font-medium">API</th>
                <th className="px-4 py-2.5 font-medium text-right">Vendor served</th>
                <th className="px-4 py-2.5 font-medium text-right">Ledgerline counted</th>
                <th className="px-4 py-2.5 font-medium text-right">Difference</th>
                <th className="px-4 py-2.5 font-medium text-right">Gap at our rate</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const key = `${r.vendor}:${r.api_code ?? r.raw_api_name}`;
                // delta_cost prices (vendor − ours), so POSITIVE is volume the
                // vendor served and Ledgerline never costed: money owed. Negative
                // means we counted more than the vendor served, which is a
                // discrepancy but not money at stake.
                const owed = (r.delta_cost ?? 0) > 0;
                return (
                  <tr
                    key={key}
                    className={`border-b border-border last:border-0 ${
                      r.dismissed ? "opacity-55" : ""
                    }`}
                  >
                    {showVendor && (
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/vendors/${encodeURIComponent(r.vendor)}`}
                          className="text-ink hover:text-accent-ink"
                        >
                          {r.vendor}
                        </Link>
                      </td>
                    )}
                    <td className="px-4 py-2.5 max-w-[320px]">
                      <div className="flex items-baseline gap-2">
                        {r.api_code ? (
                          <Link
                            href={`/apis/${r.api_code}`}
                            className="font-mono text-xs text-ink-muted hover:text-accent-ink"
                          >
                            {r.api_code}
                          </Link>
                        ) : (
                          <span
                            className="bg-warn-bg text-warn-ink tracking-wide px-1.5 rounded shrink-0"
                            style={{ fontSize: 9, fontWeight: 500 }}
                            title="This vendor-side API name matches no API in the catalog"
                          >
                            No match
                          </span>
                        )}
                        <TruncateTooltip
                          text={r.api_name}
                          className="text-ink truncate block min-w-0"
                        />
                      </div>
                      {/* The vendor's own name, shown when it differs — it is
                          what to add as an alias. */}
                      {r.raw_api_name !== r.api_name && (
                        <div className="text-[11px] text-ink-faint mt-[2px]">
                          vendor calls it &ldquo;{r.raw_api_name}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-ink">
                      {formatNumber(r.vendor_hits)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-ink">
                      {formatNumber(r.our_hits)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum whitespace-nowrap">
                      <span className={r.delta_hits < 0 ? "text-bad-ink" : "text-ink"}>
                        {r.delta_hits > 0 ? "+" : ""}
                        {formatNumber(r.delta_hits)}
                      </span>
                      <span className="text-ink-faint text-xs"> · {deltaPct(r)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum">
                      {r.delta_cost == null ? (
                        <span
                          className="text-ink-faint"
                          title="No rate on this pair — the gap is real, its cost is unknown"
                        >
                          no rate
                        </span>
                      ) : owed ? (
                        <span
                          className="text-bad-ink"
                          title="Volume the vendor served that Ledgerline never costed, at this vendor's rate for this API"
                        >
                          {formatINR(r.delta_cost, { precision: 0 })}
                        </span>
                      ) : (
                        // Shown, not blanked: the reader needs to see that a
                        // rate exists here and which way the gap runs.
                        <span
                          className="text-ink-faint"
                          title="Ledgerline counted more hits than the vendor reports serving — a discrepancy, but no money at stake"
                        >
                          −{formatINR(Math.abs(r.delta_cost), { precision: 0 })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ReconDismissButton
                        vendor={r.vendor}
                        apiCode={r.api_code}
                        rawApiName={r.api_code ? null : r.raw_api_name}
                        periodFrom={periodFrom}
                        dismissed={r.dismissed}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
