"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Layers, Pencil } from "lucide-react";
import { FilterPill } from "@/components/ui/FilterPill";
import { PriceCell } from "@/components/PriceCell";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { formatNumber } from "@/lib/format";
import { ROW_BAD } from "@/lib/row-status";
import type { PricingPair } from "@/lib/repos/pricing";

export function PricingMatrix({
  filter,
  rows,
  unpricedCount,
  allCount,
}: {
  filter: "unpriced" | "all";
  rows: PricingPair[];
  unpricedCount: number;
  allCount: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        r.api_name.toLowerCase().includes(q) ||
        r.api_code.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div>
      {/* Filter tabs + search */}
      <div
        className="flex items-center justify-between gap-4 mb-4 dash-enter"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <div className="flex items-center gap-2" role="tablist">
          <FilterPill
            label="Unpriced"
            count={unpricedCount}
            active={filter === "unpriced"}
            href="/admin/pricing?filter=unpriced"
          />
          <FilterPill
            label="All priced"
            count={allCount}
            active={filter === "all"}
            href="/admin/pricing?filter=all"
          />
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search account or API…"
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-ink w-[240px] transition-colors duration-fast ease-expo focus:border-accent focus:bg-bg-raised focus:outline-none placeholder:text-ink-faint"
        />
      </div>

      {/* Table */}
      <div
        className="bg-bg-raised border border-border rounded-lg overflow-hidden dash-enter"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 860, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 220 }} />
              {/* API — unsized so it absorbs all remaining width; names stay legible */}
              <col />
              <col style={{ width: 84 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: filter === "unpriced" ? 96 : 116 }} />
            </colgroup>
            <thead className="bg-bg-sunken text-ink-faint text-[11px] uppercase tracking-wide">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">API</th>
                <th className="px-3 py-3 font-medium text-right">S (₹/hit)</th>
                <th className="px-3 py-3 font-medium text-right">ND (₹/hit)</th>
                <th className="px-3 py-3 font-medium text-right">F (₹/hit)</th>
                <th className="px-3 py-3 font-medium text-right">IP (₹/hit)</th>
                <th className="px-3 py-3 font-medium text-right">
                  {filter === "unpriced" ? "Hits" : "Effective"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-muted text-sm">
                    {query
                      ? "No pairs match your search."
                      : filter === "unpriced"
                      ? "No revenue leak — every billable pair is priced."
                      : "No pricing configured yet."}
                  </td>
                </tr>
              )}

              {filtered.map((row, i) => {
                const isVolume = row.pricing_model !== "flat";
                const volumeLabel = row.pricing_model === "slab" ? "slab" : "tiered";
                return (
                  <tr
                    key={`${row.client_id}:${row.api_code}`}
                    className={`row-enter ${row.unpriced ? ROW_BAD : ""}`}
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  >
                    {/* Account */}
                    <td className="px-4 py-3">
                      {row.slug ? (
                        <Link
                          href={`/accounts/${row.slug}`}
                          className="text-ink hover:text-accent-ink transition-colors duration-fast ease-expo"
                        >
                          <TruncateTooltip as="span" text={row.client_name} />
                        </Link>
                      ) : (
                        <TruncateTooltip as="div" text={row.client_name} className="text-ink" />
                      )}
                    </td>

                    {/* API */}
                    <td className="px-4 py-3">
                      <TruncateTooltip as="div" text={row.api_name} className="text-sm text-ink" />
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-ink-faint font-mono">{row.api_code}</span>
                        {row.unpriced && (
                          <span
                            title={`${formatNumber(row.hits)} hits since ${row.first_used} earn nothing until priced`}
                            className="inline-flex items-center text-[11px] text-bad-ink px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-bad"
                          >
                            unpriced
                          </span>
                        )}
                        {row.billed && (
                          <span
                            title="Billed on a finalized invoice — edits insert a new row effective today"
                            className="inline-flex items-center gap-0.5 text-[11px] text-ink-faint bg-bg-sunken px-1 py-0.5 rounded font-mono uppercase tracking-wider"
                          >
                            <Lock size={9} strokeWidth={1.75} />
                            billed
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Prices — flat rows edit inline; volume rows link out */}
                    {isVolume ? (
                      <td colSpan={4} className="px-3 py-3">
                        <Link
                          href={`/accounts/${row.slug}/pricing`}
                          className="inline-flex items-center gap-2 rounded border border-accent/30 bg-accent-bg/40 px-2.5 py-1.5 hover:bg-accent-bg transition-colors group"
                        >
                          <Layers size={13} strokeWidth={1.75} className="text-accent-ink shrink-0" />
                          <span className="text-xs text-ink">{volumeLabel} pricing</span>
                          <Pencil
                            size={11}
                            strokeWidth={1.75}
                            className="text-ink-faint group-hover:text-accent-ink shrink-0"
                          />
                        </Link>
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-3 text-right">
                          <PriceCell
                            client_id={row.client_id}
                            api_code={row.api_code}
                            field="price_successful"
                            value={row.price_successful}
                            editable
                            size="sm"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <PriceCell
                            client_id={row.client_id}
                            api_code={row.api_code}
                            field="price_successful_no_data"
                            value={row.price_successful_no_data}
                            editable
                            size="sm"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <PriceCell
                            client_id={row.client_id}
                            api_code={row.api_code}
                            field="price_failed"
                            value={row.price_failed}
                            editable
                            size="sm"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <PriceCell
                            client_id={row.client_id}
                            api_code={row.api_code}
                            field="price_in_progress"
                            value={row.price_in_progress}
                            editable
                            size="sm"
                          />
                        </td>
                      </>
                    )}

                    {/* Hits (unpriced) or effective date (all) */}
                    <td className="px-3 py-3 text-right font-mono text-xs text-ink-muted tnum">
                      {filter === "unpriced"
                        ? formatNumber(row.hits)
                        : row.effective_from
                        ? row.effective_from.slice(0, 10)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
