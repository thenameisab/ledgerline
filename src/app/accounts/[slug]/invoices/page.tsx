import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBar } from "@/components/StatusBar";
import { InvoiceReceipt, InvoiceStatusPill } from "@/components/InvoiceReceipt";
import { InvoiceActions } from "./[period]/InvoiceActions";
import { InvoiceExportMenu } from "@/components/invoices/InvoiceExportMenu";
import { FilterPill } from "@/components/ui/FilterPill";
import { getAccount, getAccountBySlug, resolveAccountSlug } from "@/lib/repos/accounts";
import { listAccountStatements, deriveStatement } from "@/lib/repos/statements";
import { getSessionUser, canViewCost } from "@/lib/access";
import { formatMoney, formatNumber, formatDateTime } from "@/lib/format";
import {
  ExternalLink,
  FileText,
  Lock,
  Inbox,
} from "lucide-react";

type StatusFilter = "all" | "draft" | "final" | "issued";

export default async function AccountInvoicesPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { period?: string; status?: string };
}) {
  // Support legacy numeric URLs
  if (/^\d+$/.test(params.slug)) {
    const legacy = await getAccount(Number(params.slug));
    if (!legacy?.slug) notFound();
    redirect(`/accounts/${legacy.slug}/invoices${searchParams.period ? `?period=${searchParams.period}` : ""}`);
  }

  const account = await getAccountBySlug(params.slug);
  if (!account) {
    const current = await resolveAccountSlug(params.slug);
    if (current) {
      redirect(`/accounts/${current}/invoices${searchParams.period ? `?period=${searchParams.period}` : ""}`);
    }
    notFound();
  }
  const accountId = Number(account.id);
  const accountSlug = params.slug;

  const [user, all] = await Promise.all([
    getSessionUser(),
    listAccountStatements(accountId),
  ]);
  const isAdmin = user?.role === "admin";
  // Two different questions on this page. Finalising and issuing an invoice is
  // an admin action; reading the margin on a draft is the derived figure an
  // editor may see.
  const showCost = canViewCost(user?.role ?? "member");
  const sorted = [...all].sort((a, b) =>
    b.period.start_date.localeCompare(a.period.start_date)
  );

  const statusFilter: StatusFilter = (() => {
    const s = searchParams.status;
    if (s === "draft" || s === "final" || s === "issued") return s;
    return "all";
  })();

  const filtered =
    statusFilter === "all" ? sorted : sorted.filter((s) => s.status === statusFilter);

  const counts = {
    all: sorted.length,
    draft: sorted.filter((s) => s.status === "draft").length,
    final: sorted.filter((s) => s.status === "final").length,
    issued: sorted.filter((s) => s.status === "issued").length,
  };

  if (sorted.length === 0) {
    return (
      <main className="min-h-screen bg-bg">
        <StatusBar
          title={`${account.display_name} — Invoices`}
          subtitle="Monthly invoices derived from usage logs"
        />
        <div className="px-7 py-12 text-center">
          <Inbox size={20} strokeWidth={1.5} className="inline text-ink-faint mb-3" />
          <div className="font-serif text-xl text-ink-muted">No billing periods configured.</div>
          <div className="text-sm text-ink-faint mt-1">
            Re-run <span className="font-mono">npm run reseed</span> to bootstrap periods.
          </div>
        </div>
      </main>
    );
  }

  // period.id is BIGINT — the driver returns it as a string; coerce both
  // sides or the find never matches and the page redirect-loops.
  const requestedPeriodId = Number(searchParams.period);
  let selected = filtered.find((s) => Number(s.period.id) === requestedPeriodId);
  if (!selected) {
    selected = filtered[0] ?? sorted[0];
    if (!selected) notFound();
    const qs = new URLSearchParams();
    qs.set("period", String(selected.period.id));
    if (statusFilter !== "all") qs.set("status", statusFilter);
    redirect(`/accounts/${accountSlug}/invoices?${qs.toString()}`);
  }

  // Carries its own coverage figure: computed live on a draft, and on a
  // finalized one the copy frozen at finalize. A live reading
  // beside a frozen cost would describe today's rates against a number
  // computed from the rates in force when the invoice was cut.
  const data = await deriveStatement(accountId, selected.period.id);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-bg">
      <StatusBar
        title={`${account.display_name} — Invoices`}
        subtitle={`${counts.all} period${counts.all === 1 ? "" : "s"} · ${counts.draft} draft · ${counts.final} final · ${counts.issued} issued`}
      />

      <div className="px-4 md:px-7 py-6 max-w-screen-2xl mx-auto">
        <StatusTabs accountSlug={accountSlug} active={statusFilter} counts={counts} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-5 mt-5 items-start">
          <div
            className="bg-bg-raised border border-border rounded-lg overflow-hidden dash-enter"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col />
                <col style={{ width: 80 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead className="bg-bg-sunken text-ink-faint text-[11px] uppercase tracking-wide">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-ink-faint text-sm">
                      No invoices in this view.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const maxRev = filtered.reduce((m, s) => Math.max(m, s.totals.revenue), 0) || 1;
                    return filtered.map((s, i) => {
                    const isSelected = s.period.id === selected!.period.id;
                    const isEmpty = s.totals.revenue === 0 && s.totals.hits === 0;
                    const qs = new URLSearchParams();
                    qs.set("period", String(s.period.id));
                    if (statusFilter !== "all") qs.set("status", statusFilter);
                    return (
                      <tr
                        key={s.period.id}
                        className={`row-enter ${
                          isSelected ? "bg-accent-bg" : "hover:bg-bg-sunken"
                        } transition-colors duration-fast ease-expo`}
                        style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                      >
                        <td className="px-0 py-0">
                          <Link
                            href={`/accounts/${accountSlug}/invoices?${qs.toString()}`}
                            scroll={false}
                            className="block px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                          >
                            <div
                              className={`text-sm leading-tight ${
                                isSelected ? "text-accent-ink" : isEmpty ? "text-ink-muted" : "text-ink"
                              }`}
                              style={{ fontWeight: 500 }}
                            >
                              {s.period.label}
                            </div>
                            <div className="text-[11px] text-ink-faint mt-[2px]">
                              {formatNumber(s.totals.hits)} hit{s.totals.hits === 1 ? "" : "s"}
                              {s.totals.lines > 0 && (
                                <> · {s.totals.lines} API{s.totals.lines === 1 ? "" : "s"}</>
                              )}
                            </div>
                            {s.totals.revenue > 0 && (
                              <div className="h-[4px] rounded bg-bg-sunken overflow-hidden mt-[6px] max-w-[180px]">
                                <div
                                  className="h-full rounded bg-accent bar-grow"
                                  style={
                                    {
                                      width: `${Math.max(2, (s.totals.revenue / maxRev) * 100)}%`,
                                      "--i": Math.min(i, 12),
                                    } as React.CSSProperties
                                  }
                                />
                              </div>
                            )}
                          </Link>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <InvoiceStatusPill status={s.status} />
                        </td>
                        <td
                          className={`px-3 py-3 align-middle text-right font-mono tnum text-sm ${
                            isEmpty ? "text-ink-faint" : isSelected ? "text-accent-ink" : "text-ink"
                          }`}
                          style={{ fontWeight: 500 }}
                        >
                          {s.totals.revenue > 0 ? formatMoney(s.totals.revenue, { compact: true }) : "—"}
                        </td>
                      </tr>
                    );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>

          <div className="min-w-0 dash-enter" style={{ "--i": 1 } as React.CSSProperties}>
            <PreviewActionBar
              accountId={accountId}
              accountSlug={accountSlug}
              periodId={selected.period.id}
              data={data}
              canAct={!!isAdmin}
              showCost={showCost}
            />
            <InvoiceReceipt
              data={data}
              accountId={accountId}
              accountSlug={accountSlug}
              periodId={selected.period.id}
              canEdit={!!isAdmin}
              showCost={showCost}
              confidence={showCost ? (data?.cost_confidence ?? null) : null}
              compact
            />
            <p className="text-xs text-ink-faint text-center mt-3">
              <FileText size={11} strokeWidth={1.5} className="inline mb-0.5 mr-1" />
              The downloaded PDF matches this layout exactly.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusTabs({
  accountSlug,
  active,
  counts,
}: {
  accountSlug: string;
  active: StatusFilter;
  counts: Record<StatusFilter, number>;
}) {
  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "final", label: "Final" },
    { key: "issued", label: "Issued" },
  ];
  return (
    <div role="tablist" className="inline-flex items-center gap-1.5">
      {tabs.map((t) => (
        <FilterPill
          key={t.key}
          label={t.label}
          count={counts[t.key]}
          active={t.key === active}
          href={
            t.key === "all"
              ? `/accounts/${accountSlug}/invoices`
              : `/accounts/${accountSlug}/invoices?status=${t.key}`
          }
        />
      ))}
    </div>
  );
}

function PreviewActionBar({
  accountId,
  accountSlug,
  periodId,
  data,
  canAct,
  showCost,
}: {
  accountId: number;
  accountSlug: string;
  periodId: number;
  data: Awaited<ReturnType<typeof deriveStatement>>;
  canAct: boolean;
  /** Internal (cost/margin) exports follow canViewCost, not the action gate. */
  showCost: boolean;
}) {
  if (!data) return null;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div className="flex items-center gap-3 text-xs text-ink-faint min-w-0">
        <Link
          href={`/accounts/${accountSlug}/invoices/${periodId}`}
          className="inline-flex items-center gap-1 text-ink-muted hover:text-ink transition-colors duration-fast ease-expo"
          title="Open in full view"
        >
          <span className="font-mono text-xs tnum">{data.header.number}</span>
          <ExternalLink size={11} strokeWidth={1.5} />
        </Link>
        <span aria-hidden className="text-ink-faint">·</span>
        {data.header.status === "draft" ? (
          <span>Draft — derives live from usage</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <Lock size={11} strokeWidth={1.75} />
              Numbers locked
            </span>
            <span className="truncate">Generated {formatDateTime(data.header.generated_at)}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <InvoiceActions
          accountId={accountId}
          accountSlug={accountSlug}
          periodId={periodId}
          status={data.header.status}
          hasLines={data.lines.length > 0}
          canAct={canAct}
          draftNumber={data.header.number}
          periodLabel={data.header.period.label}
        />
        <InvoiceExportMenu accountId={accountId} periodId={periodId} showInternal={showCost} size="sm" />
      </div>
    </div>
  );
}
