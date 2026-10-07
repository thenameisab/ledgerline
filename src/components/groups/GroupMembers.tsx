"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Combobox } from "@/components/ui/Combobox";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { formatMoney, formatNumber } from "@/lib/format";
import { generateSlug } from "@/lib/slug";
import type { GroupMember } from "@/lib/repos/accounts";

type Group = { id: number; name: string };

export function GroupMembers({
  groupId,
  members,
  groups,
  canManage,
}: {
  groupId: number;
  members: GroupMember[];
  groups: Group[];
  canManage: boolean;
}) {
  if (members.length === 0) {
    return (
      <div className="bg-bg-raised border border-border rounded-lg p-10 text-center text-ink-muted">
        <div className="font-serif text-lg text-ink">No accounts in this group</div>
        <div className="text-sm mt-1">
          File an account here from the <Link href="/admin/aliases" className="text-accent-ink hover:underline">alias mapper</Link>, or move one in from the accounts list.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-raised border border-border rounded-lg overflow-x-auto">
      <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: 720 }}>
        <colgroup>
          <col style={{ width: "30%" }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
          {canManage && <col style={{ width: "26%" }} />}
        </colgroup>
        <thead className="bg-bg-sunken text-ink-muted text-[11px] uppercase tracking-wide">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium text-right">MTD revenue</th>
            <th className="px-3 py-3 font-medium text-right">Hits</th>
            {canManage && <th className="px-4 py-3 font-medium">Group</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((m) => (
            <MemberRow key={m.id} groupId={groupId} member={m} groups={groups} canManage={canManage} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberRow({
  groupId,
  member,
  groups,
  canManage,
}: {
  groupId: number;
  member: GroupMember;
  groups: Group[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const href = `/accounts/${generateSlug(member.display_name)}`;

  async function reassign(value: string) {
    const next = value === "" ? null : Number(value);
    if (next === groupId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Couldn't move account.");
        return;
      }
      const targetName = next == null ? "Standalone accounts" : groups.find((a) => a.id === next)?.name;
      toast.success(`${member.display_name} moved`, { description: `Now under ${targetName}.` });
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="hover:bg-bg-sunken/40 transition-colors duration-instant ease-expo">
      <td className="px-4 py-3 align-middle min-w-0">
        <Link href={href} className="flex items-center gap-[10px] min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-accent rounded-sm">
          <AccountLogo
            name={member.display_name}
            slug={member.slug ?? generateSlug(member.display_name)}
            hasLogo={member.has_logo}
            size={26}
          />
          <TruncateTooltip as="div" text={member.display_name} className="text-sm text-ink" style={{ fontWeight: 500 }} />
        </Link>
      </td>
      <td className="px-3 py-3 align-middle">
        <span className="text-xs text-ink-muted capitalize">
          {member.is_sandbox ? "sandbox" : member.status}
        </span>
      </td>
      <td className="px-3 py-3 align-middle text-right font-mono tnum text-sm">
        {member.revenue > 0 ? (
          <span className="text-ink" style={{ fontWeight: 500 }}>{formatMoney(member.revenue, { compact: true })}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
      <td className="px-3 py-3 align-middle text-right font-mono tnum text-sm text-ink-muted">
        {member.hits > 0 ? formatNumber(member.hits) : <span className="text-ink-faint">—</span>}
      </td>
      {canManage && (
        <td className="px-4 py-3 align-middle">
          <Combobox
            options={groups}
            value={String(groupId)}
            onChange={reassign}
            getValue={(a) => String(a.id)}
            getLabel={(a) => a.name}
            keys={["name"]}
            noneLabel="(None) — remove from group"
            searchPlaceholder="Move to group…"
            disabled={saving}
          />
        </td>
      )}
    </tr>
  );
}
