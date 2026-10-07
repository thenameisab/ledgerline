import { getIncludeSandbox } from "@/lib/repos/settings";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { GroupMembers } from "@/components/groups/GroupMembers";
import { GroupManageControls } from "@/components/groups/GroupManageControls";
import { getGroupDetail, listGroups } from "@/lib/repos/accounts";
import { getSessionUser, can } from "@/lib/access";
import { resolvePeriod } from "@/lib/period";
import { formatINR, formatDateRange } from "@/lib/format";

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { from, to } = resolvePeriod(searchParams);
  const includeSandbox = await getIncludeSandbox();

  const [detail, groups, user] = await Promise.all([
    getGroupDetail(id, { from, to, includeSandbox }),
    listGroups(),
    getSessionUser(),
  ]);
  if (!detail) notFound();

  const canManage = can(user?.role ?? "member", "group.update");
  const totalRev = detail.members.reduce((s, m) => s + m.revenue, 0);
  const otherGroups = (groups as { id: number; name: string }[]).filter((a) => a.id !== id);

  return (
    <main>
      <StatusBar
        title={detail.name}
        subtitle={`${detail.members.length} account${detail.members.length === 1 ? "" : "s"} · ${formatINR(totalRev, { compact: true })} revenue · ${formatDateRange(from, to)}`}
        actions={
          canManage ? (
            <GroupManageControls
              groupId={id}
              groupName={detail.name}
              memberCount={detail.members.length}
              otherGroups={otherGroups}
            />
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-[1600px] px-7 py-6 space-y-5">
        <Link
          href="/accounts/groups"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors duration-fast ease-expo"
        >
          <ChevronLeft size={14} strokeWidth={1.75} /> All groups
        </Link>

        <GroupMembers
          groupId={id}
          members={detail.members}
          groups={groups as { id: number; name: string }[]}
          canManage={canManage}
        />
      </div>
    </main>
  );
}
