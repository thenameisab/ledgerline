import Link from "next/link";
import { getIncludeSandbox } from "@/lib/repos/settings";
import { StatusBar } from "@/components/StatusBar";
import { AccountsTable } from "@/components/AccountsTable";
import { AccountFilterBar } from "@/components/AccountFilterBar";
import { AccountsViewToggle } from "@/components/AccountsViewToggle";
import { AccountCreateModal } from "@/components/AccountCreateModal";
import { bucketMatches } from "@/lib/account-buckets";
import { applySort } from "@/lib/sort";
import {
  getAccountSummaries,
  listGroups,
} from "@/lib/repos/accounts";
import { getSessionUser, can } from "@/lib/access";
import { resolvePeriod } from "@/lib/period";
import { formatMoney } from "@/lib/format";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: { bucket?: string; group?: string; q?: string; sort?: string; from?: string; to?: string };
}) {
  const includeSandbox = await getIncludeSandbox();
  const { from, to } = resolvePeriod(searchParams);
  const [all, groups, user] = await Promise.all([
    getAccountSummaries({ from, to, includeSandbox }),
    listGroups(),
    getSessionUser(),
  ]);

  const filtered = all.filter((c) => {
    if (!bucketMatches(searchParams.bucket, c.status_pill)) return false;
    if (searchParams.group && String(c.account_id) !== searchParams.group) return false;
    if (searchParams.q) {
      const q = searchParams.q.toLowerCase();
      const hay = `${c.display_name} ${c.group_name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Default order: who matters first (revenue desc), sandbox parked last.
  // Leak status reads via the row tint + sublabel instead of forcing flagged
  // rows to the top — with most accounts flagged, leak-first ordering buried
  // the biggest accounts under a wall of small flagged ones.
  const sorted = searchParams.sort
    ? applySort(filtered, searchParams.sort, "revenue", "desc")
    : filtered.sort((a, b) => {
        const sandboxRank = (k: string) => (k === "sandbox" ? 1 : 0);
        const ra = sandboxRank(a.status_pill);
        const rb = sandboxRank(b.status_pill);
        if (ra !== rb) return ra - rb;
        return b.revenue - a.revenue;
      });

  const groupedByGroup: Map<string | null, typeof sorted> = new Map();
  const useGrouping = !searchParams.group && !searchParams.sort;
  if (useGrouping) {
    for (const c of sorted) {
      const key = c.group_name ?? null;
      if (!groupedByGroup.has(key)) groupedByGroup.set(key, []);
      groupedByGroup.get(key)!.push(c);
    }
  }

  const totalRev = sorted.reduce((s, c) => s + c.revenue, 0);
  const flagged = sorted.filter((c) => c.status_pill === "leak").length;

  return (
    <main>
      <StatusBar
        title="Accounts"
        subtitle={`${sorted.length} account${sorted.length === 1 ? "" : "s"} · ${formatMoney(totalRev, { compact: true })} MTD revenue · ${flagged} flagged`}
        actions={can(user?.role ?? "member", "account.create") ? <AccountCreateModal groups={groups} /> : undefined}
      />

      <div className="mx-auto w-full max-w-[1600px] px-7 py-6">
        <div className="mb-5">
          <AccountsViewToggle active="accounts" />
        </div>
        <AccountFilterBar groups={groups} active={searchParams} from={from} to={to} />

        {sorted.length === 0 ? (
          <div className="bg-bg-raised border border-border rounded-lg p-12 text-center text-ink-muted">
            No accounts match this filter.
            <div className="mt-2">
              <Link href="/accounts" className="text-accent-ink text-sm hover:underline">
                Clear filters
              </Link>
            </div>
          </div>
        ) : useGrouping ? (
          <div className="space-y-7">
            {Array.from(groupedByGroup.entries()).map(([groupName, group], gi) => {
              const groupRev = group.reduce((s, c) => s + c.revenue, 0);
              const share = totalRev > 0 ? (groupRev / totalRev) * 100 : 0;
              return (
                <section
                  key={groupName ?? "_standalone"}
                  className="dash-enter"
                  style={{ "--i": Math.min(gi, 6) } as React.CSSProperties}
                >
                  <h2 className="text-xs text-ink-muted uppercase tracking-widest mb-3 flex items-baseline gap-2">
                    <span>{groupName ?? "Standalone accounts"}</span>
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] px-[6px] h-5 rounded-full bg-bg-sunken text-ink-muted tabular-nums normal-case tracking-normal">
                      {group.length}
                    </span>
                    <span className="font-mono tnum text-ink-muted normal-case tracking-normal">
                      {formatMoney(groupRev, { compact: true })}
                      {share >= 1 && (
                        <span className="text-ink-muted"> · {share.toFixed(0)}% of visible</span>
                      )}
                    </span>
                  </h2>
                  <AccountsTable rows={group} />
                </section>
              );
            })}
          </div>
        ) : (
          <AccountsTable rows={sorted} />
        )}
      </div>
    </main>
  );
}
