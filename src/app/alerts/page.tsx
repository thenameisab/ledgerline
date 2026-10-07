import Link from "next/link";
import { BellRing, ChevronRight, Layers, SlidersHorizontal } from "lucide-react";
import { requireCan } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { FilterPill } from "@/components/ui/FilterPill";
import { buttonClass } from "@/components/ui/Button";
import { AcknowledgeAll, AlertItem } from "@/components/alerts/AlertItem";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { Sparkline } from "@/components/Sparkline";
import { SEVERITY_DOT, SEVERITY_LABEL } from "@/components/alerts/severity";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { shiftISO, todayIST } from "@/lib/repos/periods";
import { ALERT_GROUPS, ALERT_RULES, ONCE_EXPIRY_DAYS, type AlertGroup, type AlertSeverity } from "@/lib/alerts/config";
import { accountDailyHits, alertFacetCounts, alertViewCounts, lastAlertRun, listAlerts, type AlertRow, type AlertView } from "@/lib/repos/alerts";

export const dynamic = "force-dynamic";

// Alerts raised by the daily usage check (lib/alerts). Admins
// and editors work the "Needs attention" list: acknowledge what they have seen,
// or snooze it. Tracked conditions close themselves when the metric recovers.

const VIEWS: { id: AlertView; label: string }[] = [
  { id: "attention", label: "Needs attention" },
  { id: "snoozed", label: "Snoozed" },
  { id: "acknowledged", label: "Acknowledged" },
  { id: "closed", label: "Closed" },
];

/** Days of daily hits in each account block's trend line. */
const TREND_DAYS = 28;

const SEVERITIES: AlertSeverity[] = ["critical", "high", "medium", "info"];

const EMPTY: Record<AlertView, string> = {
  attention: "Nothing needs attention.",
  snoozed: "No snoozed alerts.",
  acknowledged: "No acknowledged alerts are waiting to recover.",
  closed: "No alerts closed in the last 60 days.",
};

/** The view an alert belongs to now, so its card offers the right actions. */
function rowView(a: AlertRow, today: string): AlertView {
  if (a.status === "closed") return "closed";
  if (a.acknowledged_at) return "acknowledged";
  if (a.snoozed_until && a.snoozed_until > today) return "snoozed";
  return "attention";
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: { view?: string; severity?: string; group?: string; id?: string };
}) {
  const user = await requireCan("alert.act");

  const view = (VIEWS.find((v) => v.id === searchParams.view)?.id ?? "attention") as AlertView;
  const severity = SEVERITIES.find((s) => s === searchParams.severity);
  const group = ALERT_GROUPS.find((g) => g.id === searchParams.group)?.id as AlertGroup | undefined;
  const id = searchParams.id && /^\d+$/.test(searchParams.id) ? Number(searchParams.id) : undefined;

  const [alerts, counts, facets, lastRun] = await Promise.all([
    listAlerts({ view, severity, group, id }),
    alertViewCounts(),
    alertFacetCounts(view),
    lastAlertRun(),
  ]);
  const today = todayIST();

  const href = (p: { view?: AlertView; severity?: AlertSeverity | null; group?: AlertGroup | null }) => {
    const q = new URLSearchParams();
    const v = p.view ?? view;
    const s = p.severity === undefined ? severity : p.severity;
    const g = p.group === undefined ? group : p.group;
    if (v !== "attention") q.set("view", v);
    if (s) q.set("severity", s);
    if (g) q.set("group", g);
    const qs = q.toString();
    return qs ? `/alerts?${qs}` : "/alerts";
  };

  const ruleGroup = (rule: string) => ALERT_RULES[rule as keyof typeof ALERT_RULES]?.group;

  // Each filter's counts apply the other filter, so a count is what a click shows.
  const severityCount = (s: AlertSeverity) =>
    facets.filter((f) => f.severity === s && (!group || ruleGroup(f.rule) === group)).reduce((n, f) => n + f.n, 0);
  const groupCount = (g: AlertGroup | null) =>
    facets.filter((f) => (!g || ruleGroup(f.rule) === g) && (!severity || f.severity === severity)).reduce((n, f) => n + f.n, 0);

  // One block per account, in the order the list query returns them, so the
  // account with the most severe alert comes first. Alerts about the whole
  // platform, an API across accounts, a vendor or the data go in one block.
  type Block = { key: string; clientId: number | null; name: string | null; slug: string | null; hasLogo: boolean; rows: AlertRow[] };
  const toBlocks = (rows: AlertRow[]): Block[] => {
    const m = new Map<string, Block>();
    for (const a of rows) {
      const key = a.client_id == null ? "none" : String(a.client_id);
      if (!m.has(key))
        m.set(key, { key, clientId: a.client_id, name: a.account_name, slug: a.account_slug, hasLogo: a.account_has_logo, rows: [] });
      m.get(key)!.rows.push(a);
    }
    return [...m.values()];
  };
  const accountsIn = (bs: Block[]) => bs.filter((b) => b.clientId != null).length;

  // Good news (Info) needs no decision, so "Needs attention" folds it into a
  // closed section after the problems, unless the Info filter is on.
  const splitGoodNews = view === "attention" && id == null && severity == null;
  const problems = splitGoodNews ? alerts.filter((a) => a.severity !== "info") : alerts;
  const goodNews = splitGoodNews ? alerts.filter((a) => a.severity === "info") : [];
  const problemBlocks = toBlocks(problems);
  const goodBlocks = toBlocks(goodNews);
  const filtered = severity != null || group != null;

  const hitsTo = lastRun?.data_date ?? shiftISO(today, -1);
  const clientIds = [...problemBlocks, ...goodBlocks].flatMap((b) => (b.clientId != null ? [b.clientId] : []));
  const hits = await accountDailyHits(clientIds, hitsTo, TREND_DAYS);

  const renderBlock = (b: Block) => {
    const series = b.clientId != null ? hits.get(b.clientId) : undefined;
    const avg = series ? series.reduce((n, v) => n + v, 0) / series.length : 0;
    const name = b.clientId == null ? "Across accounts" : (b.name ?? "Account");
    return (
      <section key={b.key} className="overflow-hidden rounded-md border border-border bg-bg-raised" aria-label={name}>
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-bg-sunken px-4 py-2.5">
          {b.clientId != null ? (
            <AccountLogo name={name} slug={b.slug ?? undefined} hasLogo={b.hasLogo} size={28} />
          ) : (
            <span
              className="flex shrink-0 items-center justify-center rounded-md border border-border bg-bg-raised text-ink-muted"
              style={{ width: 28, height: 28 }}
              aria-hidden
            >
              <Layers size={14} strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink break-words">
              {b.slug ? (
                <Link href={`/accounts/${b.slug}`} className="hover:underline">
                  {name}
                </Link>
              ) : (
                name
              )}
            </h2>
            <p className="text-xs text-ink-faint">
              <span className="font-mono tnum">{b.rows.length}</span> alert{b.rows.length === 1 ? "" : "s"}
            </p>
          </div>
          {series && (
            <span
              className="hidden items-center gap-2 sm:inline-flex"
              title={`Daily hits, ${formatDate(shiftISO(hitsTo, -(TREND_DAYS - 1)))} to ${formatDate(hitsTo)}. Last day ${formatNumber(series[series.length - 1])}, daily average ${formatNumber(Math.round(avg))}.`}
            >
              <span className="text-xs text-ink-faint">Hits, {TREND_DAYS} days</span>
              <Sparkline data={series} width={96} height={24} stroke="var(--color-ink-muted)" />
            </span>
          )}
          {view === "attention" && id == null && b.rows.length > 1 && <AcknowledgeAll ids={b.rows.map((r) => r.id)} />}
        </header>
        <div className="divide-y divide-border">
          {b.rows.map((a) => (
            <AlertItem
              key={a.id}
              alert={a}
              view={rowView(a, today)}
              kind={ALERT_RULES[a.rule]?.kind ?? "track"}
              isNew={view === "attention" && a.data_date === lastRun?.data_date}
              expiryDays={ONCE_EXPIRY_DAYS}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <main>
      <StatusBar title="Alerts" subtitle="Changes in usage, failures and revenue, checked each day after the usage sync" />
      <div className="mx-auto w-full max-w-[960px] px-4 sm:px-7 py-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-bg-sunken p-1" aria-label="Alert views">
            {VIEWS.map((v) => {
              const active = id == null && v.id === view;
              return (
                <Link
                  key={v.id}
                  href={href({ view: v.id })}
                  aria-current={active ? "page" : undefined}
                  title={v.id === "closed" ? "Closed in the last 60 days" : undefined}
                  className={[
                    "inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-expo",
                    active ? "bg-bg-raised text-ink shadow-low" : "text-ink-muted hover:text-ink",
                  ].join(" ")}
                >
                  {v.label}
                  <span className={`font-mono tnum text-xs ${active ? "text-ink-muted" : "text-ink-faint"}`}>{counts[v.id]}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <p className="text-xs text-ink-faint" title={lastRun ? `Run ${formatDateTime(lastRun.finished_at)}` : undefined}>
              {lastRun ? `Last check: usage for ${formatDate(lastRun.data_date)}` : "The daily check has not run yet"}
            </p>
            {user.role === "admin" && (
              <Link
                href="/admin/settings/alerts"
                className={buttonClass({ variant: "ghost", size: "sm" })}
                title="Rules and thresholds"
              >
                <SlidersHorizontal strokeWidth={2} aria-hidden />
                Settings
              </Link>
            )}
          </div>
        </div>

        {id == null && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Filter by severity">
              {SEVERITIES.map((s) => {
                const n = severityCount(s);
                const active = severity === s;
                return (
                  <Link
                    key={s}
                    href={href({ severity: active ? null : s })}
                    aria-current={active ? "true" : undefined}
                    className={[
                      "rounded-md border px-4 py-3 transition-colors duration-fast ease-expo",
                      active ? "border-accent bg-accent-bg" : "border-border bg-bg-raised hover:bg-bg-sunken",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                      <span className={`size-2 rounded-full ${SEVERITY_DOT[s]}`} aria-hidden />
                      {SEVERITY_LABEL[s]}
                    </span>
                    <span className={`mt-1 block text-2xl font-semibold tnum ${n === 0 ? "text-ink-faint" : "text-ink"}`}>{n}</span>
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Group">
              <FilterPill label="All groups" active={!group} count={groupCount(null)} href={href({ group: null })} />
              {ALERT_GROUPS.map((g) => (
                <FilterPill key={g.id} label={g.label} active={group === g.id} count={groupCount(g.id)} href={href({ group: g.id })} />
              ))}
            </div>
          </div>
        )}

        {id != null && (
          <div className="rounded-md border border-border bg-bg-sunken px-4 py-2 text-sm text-ink-muted">
            Showing one alert.{" "}
            <Link href="/alerts" className="text-accent-ink hover:underline">
              Show all alerts
            </Link>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="rounded-md border border-border bg-bg-raised p-10 text-center">
            <BellRing size={28} strokeWidth={1.5} className="mx-auto text-ink-faint" aria-hidden />
            <p className="mt-3 text-sm text-ink-muted">
              {id != null ? "This alert no longer exists." : filtered ? "No alerts match these filters." : EMPTY[view]}
            </p>
            {filtered && id == null ? (
              <Link href={href({ severity: null, group: null })} className="mt-1 inline-block text-xs text-accent-ink hover:underline">
                Clear filters
              </Link>
            ) : (
              view === "attention" && id == null && <p className="mt-1 text-xs text-ink-faint">New alerts appear here after the daily check.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {id == null && problems.length > 0 && (
              <p className="text-xs text-ink-muted">
                {problems.length} alert{problems.length === 1 ? "" : "s"}
                {accountsIn(problemBlocks) > 0 &&
                  ` on ${accountsIn(problemBlocks)} account${accountsIn(problemBlocks) === 1 ? "" : "s"}`}
                {view === "closed" && ", closed in the last 60 days"}
                {filtered && (
                  <>
                    {" · "}
                    <Link href={href({ severity: null, group: null })} className="text-accent-ink hover:underline">
                      Clear filters
                    </Link>
                  </>
                )}
              </p>
            )}
            {problemBlocks.map(renderBlock)}
            {goodNews.length > 0 && (
              <details className="group" open={problems.length === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-bg-raised px-4 py-3 text-sm text-ink-muted hover:bg-bg-sunken [&::-webkit-details-marker]:hidden">
                  <ChevronRight size={16} strokeWidth={2} className="shrink-0 transition-transform duration-fast group-open:rotate-90" aria-hidden />
                  <span className={`size-2 shrink-0 rounded-full ${SEVERITY_DOT.info}`} aria-hidden />
                  <span className="font-medium text-ink">Good news</span>
                  <span>
                    {goodNews.length} alert{goodNews.length === 1 ? "" : "s"}
                    {accountsIn(goodBlocks) > 0 && ` on ${accountsIn(goodBlocks)} account${accountsIn(goodBlocks) === 1 ? "" : "s"}`}
                  </span>
                  <span className="ms-auto hidden text-xs text-ink-faint sm:inline">Growth, new APIs and tiers reached. No action needed.</span>
                </summary>
                <div className="mt-3 space-y-3">{goodBlocks.map(renderBlock)}</div>
              </details>
            )}
          </div>
        )}
        {alerts.length >= 200 && <p className="text-xs text-ink-faint">Showing the first 200 alerts. Use the filters to narrow the list.</p>}
      </div>
    </main>
  );
}
