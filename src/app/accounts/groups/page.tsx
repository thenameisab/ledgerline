import Link from "next/link";
import { getIncludeSandbox } from "@/lib/repos/settings";
import { Building2 } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { GroupsTable } from "@/components/GroupsTable";
import { GroupCreateModal } from "@/components/GroupCreateModal";
import { AccountsViewToggle } from "@/components/AccountsViewToggle";
import { getGroupSummaries } from "@/lib/repos/accounts";
import { getSessionUser, can } from "@/lib/access";
import { resolvePeriod } from "@/lib/period";
import { formatINR, formatDateRange } from "@/lib/format";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const includeSandbox = await getIncludeSandbox();
  const { from, to } = resolvePeriod(searchParams);

  const [groups, user] = await Promise.all([
    getGroupSummaries({ from, to, includeSandbox }),
    getSessionUser(),
  ]);
  const canCreate = can(user?.role ?? "member", "group.create");

  const totalRev = groups.reduce((s, a) => s + a.revenue, 0);

  return (
    <main>
      <StatusBar
        title="Groups"
        subtitle={`${groups.length} group${groups.length === 1 ? "" : "s"} · ${formatINR(totalRev, { compact: true })} revenue · ${formatDateRange(from, to)}`}
        actions={canCreate ? <GroupCreateModal /> : undefined}
      />

      <div className="mx-auto w-full max-w-[1600px] px-7 py-6 space-y-6">
        <AccountsViewToggle active="groups" />

        {groups.length === 0 ? (
          <div className="bg-bg-raised border border-border rounded-lg p-12 text-center text-ink-muted">
            <Building2 size={20} strokeWidth={1.5} className="mx-auto mb-3 text-ink-faint" />
            <div className="font-serif text-lg text-ink">No groups yet</div>
            <div className="text-sm mt-1">
              Groups roll several accounts into one parent.{" "}
              {canCreate ? "Create one above, or file an account under a new group from the alias mapper." : null}
            </div>
            <div className="mt-3">
              <Link href="/accounts" className="text-accent-ink text-sm hover:underline">
                Back to accounts
              </Link>
            </div>
          </div>
        ) : (
          <GroupsTable rows={groups} />
        )}
      </div>
    </main>
  );
}
