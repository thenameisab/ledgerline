import Link from "next/link";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { SettingsNav } from "@/components/admin/SettingsNav";
import { SystemStatus } from "@/components/SystemStatus";
import { SyncRefreshButton } from "@/components/SyncRefreshButton";
import { listSyncRuns, latestSuccessfulRun, usageGapDates } from "@/lib/repos/sync-runs";
import { getIntegrationStatuses } from "@/lib/repos/integration-status";
import { yesterdayIST } from "@/lib/repos/periods";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { SyncBackfillForm } from "./SyncBackfillForm";

// A 'running' row this old means the function was killed mid-run; the date
// it covered gets re-pulled by the next cron's gap self-heal.
const STALL_MS = 30 * 60 * 1000;

export default async function SyncAdminPage() {
  await requireRole("admin");
  const [runs, latest, integrations, gaps] = await Promise.all([
    listSyncRuns(60),
    latestSuccessfulRun(),
    getIntegrationStatuses(),
    usageGapDates(yesterdayIST()),
  ]);

  return (
    <main>
      <StatusBar
        title="Usage sync"
        subtitle={
          latest
            ? `Data through ${formatDate(latest.target_date)} · pulled ${formatDateTime(latest.finished_at ?? latest.started_at)}`
            : "No successful sync yet"
        }
      />
      <SettingsNav />

      <div className="mx-auto w-full max-w-[1200px] px-7 py-6 space-y-5">
        <SystemStatus integrations={integrations} />

        {gaps.length > 0 && (
          <section
            className="elev-1 rounded-lg p-5 border border-bad-ink/30 bg-bad-ink/5 dash-enter"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} strokeWidth={1.75} className="text-bad-ink mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-medium text-bad-ink">
                  {gaps.length} {gaps.length === 1 ? "day is" : "days are"} missing usage data
                </h2>
                <p className="text-sm text-ink-muted mt-1 max-w-2xl leading-normal">
                  These dates have no usage rows — either never pulled, or pulled while the usage log source had
                  not yet populated the day. Every range spanning them undercounts units and revenue.
                  The next scheduled sync re-pulls them automatically; to fix now, backfill the range
                  below.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {gaps.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-mono bg-bad-bg text-bad-ink"
                    >
                      {formatDate(d)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section
          className="elev-1 bg-bg-raised rounded-lg p-6 dash-enter"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <h2 className="text-xs uppercase tracking-widest text-ink-muted">How this works</h2>
          <p className="text-sm text-ink-muted mt-2 max-w-2xl leading-normal">
            Every morning around 8AM IST a scheduled job pulls the previous day&apos;s usage from
            the usage log source and lands it here, re-checking the last few days for restatements
            and self-healing any missed dates. Unrecognised account or SKU names are kept with
            their raw labels and surface in{" "}
            <Link href="/admin/aliases" className="text-accent-ink hover:text-accent">
              Aliases
            </Link>{" "}
            for resolution — revenue for those rows starts counting the moment they&apos;re mapped.
          </p>
          <div className="mt-4">
            <SyncRefreshButton />
          </div>
          <div className="mt-5 pt-4 border-t border-border">
            <SyncBackfillForm />
          </div>
        </section>

        <div
          className="elev-1 bg-bg-raised rounded-md overflow-hidden dash-enter"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          {runs.length === 0 ? (
            <div className="p-10 text-center">
              <RefreshCw size={20} strokeWidth={1.5} className="text-ink-faint mx-auto mb-3" />
              <div className="font-serif text-lg text-ink">No runs yet</div>
              <div className="text-sm text-ink-muted mt-1">
                The first scheduled pull lands tomorrow morning, or backfill a range above.
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Started</th>
                  <th className="px-3 py-3 font-medium">Data date</th>
                  <th className="px-3 py-3 font-medium">Trigger</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium text-right">Rows</th>
                  <th className="px-3 py-3 font-medium text-right">Units</th>
                  <th className="px-4 py-3 font-medium">Unmapped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((r, i) => {
                  const stalled =
                    r.status === "running" && Date.now() - Date.parse(r.started_at) > STALL_MS;
                  // Succeeded but landed nothing — the empty-pull case that once
                  // hid a missing day. Flag it distinctly from a real success.
                  const emptyPull = r.status === "success" && (r.rows_inserted ?? 0) === 0;
                  return (
                    <tr
                      key={r.id}
                      className="row-enter hover:bg-bg-sunken/40 align-top"
                      style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">
                        {formatDateTime(r.started_at)}
                      </td>
                      <td className="px-3 py-3 text-ink whitespace-nowrap">{formatDate(r.target_date)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-bg-sunken text-ink-muted">
                          {r.trigger}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {emptyPull ? (
                          <span
                            className="inline-flex items-center gap-1 text-warn-ink text-xs font-medium"
                            title="Pull succeeded but returned no usage rows — the usage log source had no data for this date at pull time. Re-pulled until data lands."
                          >
                            <AlertTriangle size={11} strokeWidth={1.75} />
                            no data
                          </span>
                        ) : r.status === "success" ? (
                          <span className="text-success text-xs font-medium">success</span>
                        ) : r.status === "error" || stalled ? (
                          <span
                            className="inline-flex items-center gap-1 text-bad-ink text-xs font-medium"
                            title={r.error ?? "Run never finished — likely killed by the platform timeout."}
                          >
                            <AlertTriangle size={11} strokeWidth={1.75} />
                            {stalled ? "stalled" : "error"}
                          </span>
                        ) : (
                          <span className="text-ink-muted text-xs">running…</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tnum text-ink">
                        {r.rows_inserted != null ? formatNumber(r.rows_inserted) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tnum text-ink">
                        {r.total_hits != null ? formatNumber(Number(r.total_hits)) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {(r.unmapped_clients ?? 0) + (r.unmapped_apis ?? 0) > 0 ? (
                          <Link
                            href="/admin/aliases"
                            className="text-xs text-warn-ink hover:text-accent-ink"
                          >
                            {r.unmapped_clients ?? 0} account{(r.unmapped_clients ?? 0) === 1 ? "" : "s"} ·{" "}
                            {r.unmapped_apis ?? 0} SKU{(r.unmapped_apis ?? 0) === 1 ? "" : "s"}
                          </Link>
                        ) : r.status === "success" ? (
                          <span className="text-xs text-ink-faint">all mapped</span>
                        ) : r.error ? (
                          <span className="text-xs text-bad-ink" title={r.error}>
                            {r.error.length > 60 ? `${r.error.slice(0, 60)}…` : r.error}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
