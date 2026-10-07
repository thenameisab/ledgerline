import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { formatMoney, formatNumber } from "@/lib/format";
import type { GroupSummary } from "@/lib/repos/accounts";
import { generateSlug } from "@/lib/slug";

/** Group roll-up list. Mirrors AccountsTable's register: a revenue-share
 * bar scaled to the largest group in view makes concentration read at a glance. */
export function GroupsTable({ rows }: { rows: GroupSummary[] }) {
  if (rows.length === 0) return null;
  const max = rows.reduce((m, r) => Math.max(m, r.revenue), 0) || 1;

  return (
    <div className="bg-bg-raised border border-border rounded-lg table-scroll">
      <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: 790 }}>
        <colgroup>
          <col style={{ width: "32%" }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 130 }} />
          <col />
          <col style={{ width: 36 }} />
        </colgroup>
        <thead className="bg-bg-sunken text-ink-muted text-[11px] uppercase tracking-wide sticky top-0 z-10">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Group</th>
            <th className="px-3 py-3 font-medium text-right">Accounts</th>
            <th className="px-3 py-3 font-medium text-right">MTD revenue</th>
            <th className="px-3 py-3 font-medium">Share</th>
            <th className="px-2 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((a, i) => {
            const href = `/accounts/groups/${a.id}`;
            return (
              <tr
                key={a.id}
                className="group/row row-enter transition-colors duration-instant ease-expo hover:bg-bg-sunken/40"
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                <td className="px-4 py-3 align-middle min-w-0">
                  <Link
                    href={href}
                    className="block min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      {/* The top member's logo, or the group's initials. */}
                      <AccountLogo
                        name={a.logo_account?.display_name ?? a.name}
                        slug={
                          a.logo_account
                            ? (a.logo_account.slug ?? generateSlug(a.logo_account.display_name))
                            : undefined
                        }
                        hasLogo={a.logo_account != null}
                        size={28}
                      />
                      <TruncateTooltip
                        as="div"
                        text={a.name}
                        className="text-sm leading-tight text-ink min-w-0"
                        style={{ fontWeight: 500 }}
                      />
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-3 align-middle text-right font-mono tnum text-sm text-ink-muted whitespace-nowrap">
                  {a.account_count > 0 ? (
                    <span>
                      {formatNumber(a.account_count)}
                      {a.active_count < a.account_count && (
                        <span className="text-ink-faint"> · {a.active_count} active</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="px-3 py-3 align-middle text-right font-mono tnum text-sm">
                  {a.revenue > 0 ? (
                    <span className="text-ink" style={{ fontWeight: 500 }}>
                      {formatMoney(a.revenue, { compact: true })}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="px-3 py-3 align-middle">
                  {a.revenue > 0 && (
                    <div className="h-[8px] rounded overflow-hidden bg-bg-sunken">
                      <div
                        className="h-full rounded bar-grow bg-accent group-hover/row:opacity-90"
                        style={
                          {
                            width: `${Math.max(2, (a.revenue / max) * 100)}%`,
                            "--i": Math.min(i, 12),
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  )}
                </td>
                <td className="px-2 py-3 align-middle text-right">
                  <Link
                    href={href}
                    aria-label={`Open ${a.name}`}
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded text-ink-faint hover:text-ink hover:bg-bg-sunken"
                  >
                    <span className="inline-flex opacity-0 scale-[0.25] blur-[4px] group-hover/row:opacity-100 group-hover/row:scale-100 group-hover/row:blur-0 transition-[opacity,transform,filter] duration-fast ease-expo">
                      <ChevronRight size={14} strokeWidth={1.5} />
                    </span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
