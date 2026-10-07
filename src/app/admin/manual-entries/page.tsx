import Link from "next/link";
import { requireCan } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { buttonClass } from "@/components/ui/Button";
import { FilterPill } from "@/components/ui/FilterPill";
import { listManualEntries } from "@/lib/repos/manual-entries";
import { resolvePeriod } from "@/lib/period";
import { formatINR, formatNumber, formatDate, formatDateTime } from "@/lib/format";
import { FileEdit, Plus, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { key: undefined, label: "All" },
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "void", label: "Void" },
] as const;

export default async function ManualEntriesPage({
  searchParams,
}: {
  searchParams: { status?: string; from?: string; to?: string };
}) {
  await requireCan("manual_entry.edit");
  const status = (STATUS_TABS.find((t) => t.key === searchParams.status)?.key ?? undefined) as
    | "draft"
    | "pending_approval"
    | "approved"
    | "void"
    | undefined;
  const window = resolvePeriod(searchParams);
  // Fetch everything in the window (plus any pending, which the range never
  // hides), filter by status in memory — pill counts stay honest while a
  // status filter is active (a server-side filter zeroed the other tabs).
  const all = await listManualEntries({ range: window });
  const entries = status ? all.filter((e) => e.status === status) : all;

  const totalRevenue = entries.reduce((s, e) => s + e.total_revenue, 0);
  const approvedRevenue = all
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + e.total_revenue, 0);
  const pending = all.filter((e) => e.status === "pending_approval");
  const pendingRevenue = pending.reduce((s, e) => s + e.total_revenue, 0);
  const maxRevenue = entries.reduce((m, e) => Math.max(m, e.total_revenue), 0) || 1;

  return (
    <main>
      <StatusBar
        title="Manual entries"
        subtitle={`${all.length} ${all.length === 1 ? "entry" : "entries"} logged · ${formatINR(approvedRevenue, { compact: true })} approved revenue`}
        actions={
          <Link href="/admin/manual-entries/new" className={buttonClass({ variant: "primary", size: "md" })}>
            <Plus size={14} strokeWidth={1.5} />
            New entry
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-[1600px] px-7 pt-5">
        <DateRangePicker from={window.from} to={window.to} />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-7 py-6 space-y-5">
        {/* Ops question: how much off-stream revenue is booked — and what's stuck? */}
        <section
          className="elev-1 bg-bg-raised rounded-lg p-6 dash-enter"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <div className="flex flex-wrap gap-x-10 gap-y-5 items-start">
            <div className="min-w-[260px] flex-1">
              <h2 className="text-xs uppercase tracking-widest text-ink-muted">
                Approved off-stream revenue
              </h2>
              <div className="flex items-end gap-3 mt-[6px]">
                <span className="inline-block">
                  <span
                    className="block font-serif text-5xl text-ink leading-none tnum landmark-wipe"
                    style={{ fontWeight: 600 }}
                  >
                    {formatINR(approvedRevenue, { precision: 0 })}
                  </span>
                  <span className="block h-px bg-accent mt-2 landmark-rail" aria-hidden="true" />
                </span>
              </div>
              <p className="text-sm text-ink-muted mt-3 max-w-xl leading-normal">
                Bulk usage raised by email or ticket, booked into revenue once approved.
                Draft and pending entries stay out of KPIs and invoices until then.
              </p>
            </div>
            {pending.length > 0 ? (
              <div className="min-w-[220px] rounded-md bg-warn-bg px-4 py-3 risk-enter" style={{ "--i": 1 } as React.CSSProperties}>
                <div className="flex items-center gap-1.5 text-xs text-warn-ink">
                  <AlertTriangle size={12} strokeWidth={1.5} />
                  <span style={{ fontWeight: 500 }}>Awaiting approval</span>
                </div>
                <div className="font-serif text-2xl text-ink tnum mt-1" style={{ fontWeight: 600 }}>
                  {formatINR(pendingRevenue, { precision: 0 })}
                </div>
                <div className="text-xs text-ink-muted mt-0.5">
                  {pending.length} {pending.length === 1 ? "entry" : "entries"} blocked until an admin signs off
                </div>
              </div>
            ) : (
              <div className="min-w-[220px] rounded-md bg-bg-sunken px-4 py-3 text-xs text-ink-muted self-start">
                Nothing awaiting approval.
              </div>
            )}
          </div>
        </section>

        <div className="flex items-center gap-2 flex-wrap dash-enter" style={{ "--i": 1 } as React.CSSProperties}>
          {STATUS_TABS.map((t) => {
            const count = t.key ? all.filter((e) => e.status === t.key).length : all.length;
            const href = t.key ? `/admin/manual-entries?status=${t.key}` : "/admin/manual-entries";
            return (
              <FilterPill
                key={t.label}
                label={t.label}
                count={count}
                active={(t.key ?? undefined) === status}
                href={href}
              />
            );
          })}
        </div>

        {entries.length === 0 ? (
          <div className="rounded-md border border-border bg-bg-raised p-10 text-center dash-enter" style={{ "--i": 2 } as React.CSSProperties}>
            <FileEdit
              size={28}
              strokeWidth={1.5}
              className="mx-auto text-ink-faint mb-3"
            />
            <div className="font-serif text-xl text-ink" style={{ fontWeight: 600 }}>
              {status ? `No ${status.replace("_", " ")} entries` : "No manual entries yet"}
            </div>
            <div className="text-sm text-ink-muted mt-1 max-w-md mx-auto">
              Off-stream bulk usage that customers raise by email or ticket — log it
              here so revenue, KPIs, and invoices reflect the work done.
            </div>
            <div className="mt-5">
              <Link
                href="/admin/manual-entries/new"
                className={buttonClass({ variant: "primary", size: "md" })}
              >
                <Plus size={14} strokeWidth={1.5} />
                Create first entry
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-bg-raised overflow-x-auto dash-enter" style={{ "--i": 2 } as React.CSSProperties}>
            <table className="w-full text-sm" style={{ minWidth: 880 }}>
              <thead className="bg-bg-sunken text-ink-muted">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Effective date</th>
                  <th className="text-left font-medium px-4 py-2.5">Account</th>
                  <th className="text-left font-medium px-4 py-2.5">Reason</th>
                  <th className="text-right font-medium px-4 py-2.5 tnum">APIs · Hits</th>
                  <th className="text-right font-medium px-4 py-2.5 tnum">Revenue</th>
                  <th className="text-left font-medium px-4 py-2.5 w-[110px]">Share</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th className="text-left font-medium px-4 py-2.5">Created</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-t border-border row-enter transition-colors duration-fast ease-expo ${
                      e.status === "pending_approval"
                        ? "bg-warn-bg hover:bg-warn-bg-hover"
                        : e.status === "void"
                        ? "bg-bad-bg hover:bg-bad-bg-hover"
                        : "hover:bg-bg-sunken"
                    }`}
                    style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-ink">
                      <Link
                        href={`/admin/manual-entries/${e.id}`}
                        className="hover:text-accent transition-colors duration-fast ease-expo"
                      >
                        {formatDate(e.effective_date)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink">{e.client_name}</td>
                    <td className="px-4 py-2.5 text-ink-muted max-w-[26rem]">
                      <div className="truncate" title={e.reason}>
                        {e.reason}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-muted tnum font-mono">
                      {e.api_count} · {formatNumber(e.total_hits)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink tnum font-mono">
                      {formatINR(e.total_revenue, { precision: 2 })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className={`h-[8px] rounded overflow-hidden ${
                        e.status === "pending_approval"
                          ? "bg-warn-bg-hover"
                          : e.status === "void"
                          ? "bg-bad-bg-hover"
                          : "bg-bg-sunken"
                      }`}>
                        {e.total_revenue > 0 && (
                          <div
                            className="h-full rounded bg-accent bar-grow"
                            style={
                              {
                                width: `${Math.max(2, (e.total_revenue / maxRevenue) * 100)}%`,
                                "--i": Math.min(i, 12),
                              } as React.CSSProperties
                            }
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={e.status} />
                    </td>
                    <td className="px-4 py-2.5 text-ink-faint text-xs">
                      <div>{formatDateTime(e.created_at)}</div>
                      <div className="text-[10px] mt-0.5">{e.created_by_email ?? "—"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-xs text-ink-faint">
          Total revenue across visible entries: {formatINR(totalRevenue, { precision: 2 })}.
          Draft and pending entries are excluded from dashboard KPIs and invoices until approved.
        </div>
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: "draft" | "pending_approval" | "approved" | "void" }) {
  const styles: Record<typeof status, { wrap: string; label: string }> = {
    draft: { wrap: "bg-bg-sunken text-ink-muted", label: "Draft" },
    pending_approval: { wrap: "bg-warn-bg text-warn-ink", label: "Pending" },
    approved: { wrap: "bg-ok-bg text-ok-ink", label: "Approved" },
    void: { wrap: "bg-bad-bg text-bad-ink", label: "Void" },
  };
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono ${s.wrap}`}
    >
      {s.label}
    </span>
  );
}
