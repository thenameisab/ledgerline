import Link from "next/link";
import { Sparkline } from "@/components/Sparkline";
import { StatusChip } from "@/components/chips/StatusChip";
import { NoMsaChip } from "@/components/chips/Chips";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { AccountHoverCard } from "@/components/AccountHoverCard";
import { formatMoney, formatNumber } from "@/lib/format";
import { ROW_BAD, ROW_WARN } from "@/lib/row-status";
import type { AccountSummary } from "@/lib/repos/accounts";
import { generateSlug } from "@/lib/slug";
import { ChevronRight, Building2 } from "lucide-react";

// Reimagined list rows. Concentration is the headline: every row carries a
// revenue-share bar scaled to the largest account in view, so "who matters"
// reads at a glance. Leak rows get a red left border and historical rows an
// amber one; the row itself stays neutral and the StatusChip carries the label.
export function AccountsTable({ rows }: { rows: AccountSummary[] }) {
  if (rows.length === 0) return null;
  const max = rows.reduce((m, r) => Math.max(m, r.revenue), 0) || 1;

  return (
    <div className="bg-bg-raised border border-border rounded-lg table-scroll">
      <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: 920 }}>
        <colgroup>
          <col style={{ width: "26%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: 136 }} />
          <col style={{ width: 110 }} />
          <col />
          <col style={{ width: 96 }} />
          <col style={{ width: 36 }} />
        </colgroup>
        <thead className="bg-bg-sunken text-ink-muted text-[11px] uppercase tracking-wide sticky top-0 z-10">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-3 py-3 font-medium">Group</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium text-right">MTD revenue</th>
            <th className="px-3 py-3 font-medium">Share</th>
            <th className="px-3 py-3 font-medium text-right">14d</th>
            <th className="px-2 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((c, i) => {
            const leak = c.status_pill === "leak";
            const historical = c.status_pill === "historical";
            const href = `/accounts/${generateSlug(c.display_name)}`;
            return (
              <tr
                key={c.client_id}
                className={`group/row row-enter transition-colors duration-instant ease-expo ${
                  leak ? ROW_BAD : historical ? ROW_WARN : "hover:bg-bg-sunken/40"
                }`}
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                <td className="px-4 py-3 align-middle min-w-0">
                  <AccountHoverCard slug={c.slug ?? generateSlug(c.display_name)} side="right">
                  <Link
                    href={href}
                    className="block min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <AccountLogo
                        name={c.display_name}
                        slug={c.slug ?? generateSlug(c.display_name)}
                        hasLogo={c.has_logo}
                        size={28}
                      />
                      <div className="min-w-0">
                        <TruncateTooltip
                          as="div"
                          text={c.display_name}
                          className="text-sm leading-tight text-ink"
                          style={{ fontWeight: 500 }}
                        />
                        {c.active_unpriced_pairs > 0 ? (
                          <div className="text-[11px] text-bad-ink mt-[2px] truncate">
                            {c.active_unpriced_pairs} unpriced · {formatNumber(c.active_unpriced_hits)} units
                          </div>
                        ) : c.historical_unpriced_pairs > 0 ? (
                          <div className="text-[11px] text-warn-ink mt-[2px] truncate">
                            {c.historical_unpriced_pairs} historical · {formatNumber(c.historical_unpriced_hits)} units
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                  </AccountHoverCard>
                </td>
                <td className="px-3 py-3 align-middle">
                  {c.group_name ? (
                    <span className="inline-flex items-center gap-[6px] text-xs text-ink-muted min-w-0">
                      <Building2 size={11} strokeWidth={1.5} className="shrink-0" />
                      <TruncateTooltip as="span" text={c.group_name} className="truncate" />
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">—</span>
                  )}
                </td>
                <td className="px-3 py-3 align-middle">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusChip kind={c.status_pill} />
                    {c.msa_missing ? <NoMsaChip compact /> : null}
                  </span>
                </td>
                <td className="px-3 py-3 align-middle text-right font-mono tnum text-sm">
                  {c.revenue > 0 ? (
                    <span className="text-ink" style={{ fontWeight: 500 }}>
                      {formatMoney(c.revenue, { compact: true })}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="px-3 py-3 align-middle">
                  <div
                    className="h-[8px] rounded overflow-hidden bg-bg-sunken"
                  >
                    <div
                      className={`h-full rounded bar-grow ${leak ? "bg-bad" : historical ? "bg-warn" : "bg-accent"} group-hover/row:opacity-90`}
                      style={
                        {
                          width: `${Math.max(c.revenue > 0 ? 2 : 0, (c.revenue / max) * 100)}%`,
                          "--i": Math.min(i, 12),
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </td>
                <td className="px-3 py-3 align-middle text-right">
                  <Sparkline
                    data={c.spark}
                    width={72}
                    height={20}
                    stroke={leak ? "var(--color-bad)" : historical ? "var(--color-warn)" : "var(--color-accent)"}
                  />
                </td>
                <td className="px-2 py-3 align-middle text-right">
                  <Link
                    href={href}
                    aria-label={`Open ${c.display_name}`}
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded text-ink-faint hover:text-ink hover:bg-bg-sunken after:absolute after:left-1/2 after:top-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2"
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
