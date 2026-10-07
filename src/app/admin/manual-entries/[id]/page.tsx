import { notFound } from "next/navigation";
import { StatusBar } from "@/components/StatusBar";
import { getManualEntry } from "@/lib/repos/manual-entries";
import { requireCan, canApprove } from "@/lib/access";
import { formatINR, formatNumber, formatDate, formatDateTime } from "@/lib/format";
import { ManualEntryActions } from "@/components/ManualEntryActions";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";

export default async function ManualEntryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const session = await requireCan("manual_entry.edit");
  const entry = await getManualEntry(id);
  if (!entry) notFound();
  const mayApprove = canApprove(session.role);

  const statusColor =
    entry.status === "approved"
      ? "bg-ok-bg text-ok-ink"
      : entry.status === "pending_approval"
      ? "bg-warn-bg text-warn-ink"
      : entry.status === "void"
      ? "bg-bad-bg text-bad-ink"
      : "bg-bg-sunken text-ink-muted";

  return (
    <main>
      <StatusBar
        title={`Manual entry · ${entry.client_name}`}
        subtitle={`${entry.line_count} ${entry.line_count === 1 ? "line" : "lines"} · ${formatINR(
          entry.total_revenue,
          { precision: 2 }
        )} · ${formatDate(entry.effective_date)}`}
        chip={
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${statusColor}`}>
            {entry.status.replace("_", " ")}
          </span>
        }
      />

      <div className="mx-auto w-full max-w-[1200px] px-7 py-6 space-y-6">
        <section
          className="rounded-md border border-border bg-bg-raised p-5 dash-enter"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <h2 className="font-serif text-lg text-ink mb-3" style={{ fontWeight: 600 }}>
            Details
          </h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DetailItem label="Reason" value={entry.reason} />
            <DetailItem label="Reference" value={entry.reference ?? "—"} />
            <DetailItem
              label="Created"
              value={`${formatDateTime(entry.created_at)} · ${entry.created_by_email ?? "?"}`}
            />
            <DetailItem
              label="Approved"
              value={
                entry.approved_at
                  ? `${formatDateTime(entry.approved_at)} · ${entry.approved_by_email ?? "?"}`
                  : "—"
              }
            />
            {entry.status === "void" && (
              <>
                <DetailItem
                  label="Voided"
                  value={
                    entry.voided_at
                      ? `${formatDateTime(entry.voided_at)} · ${entry.voided_by_email ?? "?"}`
                      : "—"
                  }
                />
                <DetailItem label="Void reason" value={entry.void_reason ?? "—"} />
              </>
            )}
          </dl>
        </section>

        <section
          className="rounded-md border border-border bg-bg-raised overflow-hidden dash-enter"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <div className="px-5 pt-5 pb-3 flex items-end justify-between gap-4">
            <h2 className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
              Lines
            </h2>
            <span className="inline-block text-right">
              <span
                className="block font-serif text-2xl text-ink leading-none tnum landmark-wipe"
                style={{ fontWeight: 600 }}
              >
                {formatINR(entry.total_revenue, { precision: 2 })}
              </span>
              <span className="block h-px bg-accent mt-1.5 landmark-rail" aria-hidden="true" />
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-bg-sunken text-ink-muted">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">API</th>
                <th className="text-left font-medium px-4 py-2.5">Channel</th>
                <th className="text-left font-medium px-4 py-2.5">Vendor</th>
                <th className="text-right font-medium px-4 py-2.5 tnum">Hits</th>
                <th className="text-right font-medium px-4 py-2.5 tnum">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((l, i) => (
                <tr
                  key={i}
                  className="border-t border-border row-enter"
                  style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                >
                  <td className="px-4 py-2.5 text-ink">
                    <TruncateTooltip as="div" text={l.api_name} />
                    <div className="text-xs text-ink-faint font-mono">{l.api_code}</div>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{l.hits_via}</td>
                  <td className="px-4 py-2.5 text-ink-muted font-mono">{l.vendor ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tnum text-ink-muted font-mono">
                    {formatNumber(l.hits)}
                  </td>
                  <td className="px-4 py-2.5 text-right tnum text-ink font-mono">
                    {l.has_pricing ? (
                      formatINR(l.revenue, { precision: 2 })
                    ) : (
                      <span className="text-warn-ink">no rate</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {entry.status !== "void" && (
          <div className="dash-enter" style={{ "--i": 2 } as React.CSSProperties}>
            <ManualEntryActions id={entry.id} status={entry.status} canApprove={mayApprove} />
          </div>
        )}
      </div>
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="text-ink mt-0.5">{value}</dd>
    </div>
  );
}
