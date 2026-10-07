import { Lock, FileEdit, Layers } from "lucide-react";
import { PriceCell } from "@/components/PriceCell";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { LeakDismissButton } from "@/components/accounts/LeakDismissButton";
import { SlabBandsDisclosure } from "@/components/accounts/SlabBandsDisclosure";
import { formatMoney, formatNumber, formatPrice } from "@/lib/format";
import type { AccountApiBreakdown } from "@/lib/repos/accounts";

// v0.1: vendor cost + margin columns deliberately omitted at the per-(account, api)
// level. Margin requires vendor allocation we don't have yet — see V0.1_PLAN.md §3.1.
// Aggregate margin is shown only on Dashboard and API detail (both exact).

export function ApiBreakdownTable({
  breakdown,
  accountId,
  editable,
  slug,
  canDismiss = false,
}: {
  breakdown: AccountApiBreakdown[];
  accountId: number;
  editable: boolean;
  slug?: string;
  canDismiss?: boolean;
}) {
  if (breakdown.length === 0) {
    return (
      <div className="bg-bg-raised border border-border rounded-lg px-6 py-12 text-center text-ink-muted">
        No traffic in this window.
      </div>
    );
  }

  return (
    <div className="bg-bg-raised border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm"
          style={{ minWidth: editable ? 720 : 520, tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: editable ? "40%" : "55%" }} />
            <col style={{ width: 130 }} />
            {editable && <col style={{ width: 260 }} />}
            <col style={{ width: 140 }} />
          </colgroup>
          <thead className="bg-bg-sunken text-ink-faint text-[11px] uppercase tracking-wide">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-3 py-3 font-medium text-right">Units</th>
              {editable && <th className="px-3 py-3 font-medium">Unit pricing</th>}
              <th className="px-3 py-3 font-medium text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {breakdown.map((b, i) => {
              const tint =
                b.leak_state === "active"
                  ? "bg-bad-bg"
                  : b.leak_state === "historical"
                    ? "bg-warn-bg"
                    : "";
              return (
                <tr key={`${b.api_code}-${i}`} className={tint}>
                  <td className="px-4 py-3 align-top">
                    <TruncateTooltip
                      as="div"
                      text={b.api_name}
                      className="text-sm text-ink"
                    />
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[11px] text-ink-faint font-mono">{b.api_code}</span>
                      {b.billed && (
                        <span
                          title="Billed on a finalized invoice — price edits will supersede, not overwrite history"
                          className="inline-flex items-center gap-0.5 text-[11px] text-ink-faint bg-bg-sunken px-1 py-0.5 rounded font-mono uppercase tracking-wider"
                        >
                          <Lock size={9} strokeWidth={1.75} />
                          billed
                        </span>
                      )}
                      {b.manual_hits > 0 && (
                        <span
                          title={`Includes ${formatNumber(b.manual_hits)} units from approved manual / bulk entries`}
                          className="inline-flex items-center gap-0.5 text-[11px] text-accent-ink bg-accent-bg px-1 py-0.5 rounded font-mono uppercase tracking-wider"
                        >
                          <FileEdit size={9} strokeWidth={1.75} />
                          manual
                        </span>
                      )}
                      {b.is_slab && (
                        <span
                          title="Volume pricing — billed in volume brackets. Manage the brackets on the pricing page."
                          className="inline-flex items-center gap-0.5 text-[11px] text-info-ink bg-info-bg px-1 py-0.5 rounded font-mono uppercase tracking-wider"
                        >
                          <Layers size={9} strokeWidth={1.75} />
                          volume
                        </span>
                      )}
                      {b.bundle_id != null && (
                        <span
                          title={
                            b.bundle_anchor
                              ? `Anchor of "${b.bundle_name}" — its units bill the stitched price`
                              : `Stitched into "${b.bundle_name}" — billed via the stitch, own units bill $0`
                          }
                          className="inline-flex items-center text-[11px] text-accent-ink px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-accent/30"
                        >
                          stitched{b.bundle_anchor ? " · anchor" : ""}
                        </span>
                      )}
                    </div>
                    {b.leak_state !== "none" && (
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        {b.leak_state === "active" && (
                          <span
                            title="No price in effect — these units aren't being billed"
                            className="inline-flex items-center text-[11px] text-bad-ink border border-bad-ink/30 px-1 py-0.5 rounded font-mono uppercase tracking-wider"
                          >
                            unpriced · {formatNumber(b.unpriced_hits)} units
                          </span>
                        )}
                        {b.leak_state === "historical" && (
                          <>
                            <span
                              title="Priced now, but these earlier units ran before the price took effect"
                              className="inline-flex items-center text-[11px] text-warn-ink border border-warn-ink/30 px-1 py-0.5 rounded font-mono uppercase tracking-wider"
                            >
                              historical · {formatNumber(b.unpriced_hits)} units
                            </span>
                            {canDismiss && slug && (
                              <LeakDismissButton accountId={accountId} apiCode={b.api_code} slug={slug} dismissed={false} />
                            )}
                          </>
                        )}
                        {b.leak_state === "dismissed" && (
                          <>
                            <span
                              title="Historical leak marked as fixed — hidden from leak surfaces"
                              className="inline-flex items-center text-[11px] text-ink-faint border border-border px-1 py-0.5 rounded font-mono uppercase tracking-wider"
                            >
                              dismissed
                            </span>
                            {canDismiss && slug && (
                              <LeakDismissButton accountId={accountId} apiCode={b.api_code} slug={slug} dismissed={true} />
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {b.is_slab && <SlabBandsDisclosure bands={b.slab_bands} />}
                  </td>

                  <td className="px-3 py-3 align-top text-right">
                    <div className="font-mono tnum text-ink text-base leading-tight">
                      {formatNumber(b.hits)}
                    </div>
                    <HitsBreakdown b={b} />
                  </td>

                  {editable && (
                    <td className="px-3 py-3 align-top">
                      {b.bundle_id != null ? (
                        <span
                          className="text-[11px] text-ink-faint"
                          title="Unit prices don't apply — this SKU is billed through its stitch. Manage it on the pricing page."
                        >
                          priced via stitch “{b.bundle_name}”
                        </span>
                      ) : b.is_slab ? (
                        <span
                          className="text-[11px] text-ink-faint"
                          title="Flat unit prices don't apply — this SKU uses volume pricing. Manage the brackets on the pricing page."
                        >
                          priced by volume
                        </span>
                      ) : (
                        <>
                          <div className="flex items-start gap-1.5">
                            <PricingTrio b={b} accountId={accountId} editable={editable} />
                          </div>
                          {b.in_progress > 0 && (
                            <div className="text-[10px] text-ink-faint mt-1">
                              IP: {b.in_progress} · {formatPrice(b.price_ip)}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  )}

                  <td className="px-3 py-3 align-top text-right font-mono tnum text-ink text-base leading-tight">
                    {b.revenue > 0 ? (
                      formatMoney(b.revenue, { precision: 0 })
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HitsBreakdown({ b }: { b: AccountApiBreakdown }) {
  const parts: { label: string; value: number; tone: string }[] = [];
  if (b.successful > 0) parts.push({ label: "ok", value: b.successful, tone: "text-ink-muted" });
  if (b.successful_no_data > 0)
    parts.push({ label: "no data", value: b.successful_no_data, tone: "text-ink-muted" });
  if (b.failed > 0) parts.push({ label: "failed", value: b.failed, tone: "text-bad-ink" });
  if (parts.length <= 1) return null;
  return (
    <div className="text-[10px] text-ink-faint mt-0.5 leading-snug">
      {parts.map((p, i) => (
        <span key={p.label}>
          {i > 0 && <span className="text-ink-faint mx-1">·</span>}
          <span className={`font-mono tnum ${p.tone}`}>{formatNumber(p.value)}</span>
          <span className="text-ink-faint ml-1">{p.label}</span>
        </span>
      ))}
    </div>
  );
}

function PricingTrio({
  b,
  accountId,
  editable,
}: {
  b: AccountApiBreakdown;
  accountId: number;
  editable: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      <PriceField label="S">
        <PriceCell
          client_id={accountId}
          api_code={b.api_code}
          field="price_successful"
          value={b.price_s}
          editable={editable}
          size="sm"
        />
      </PriceField>
      <PriceField label="ND">
        <PriceCell
          client_id={accountId}
          api_code={b.api_code}
          field="price_successful_no_data"
          value={b.price_snd}
          editable={editable}
          size="sm"
        />
      </PriceField>
      <PriceField label="F">
        <PriceCell
          client_id={accountId}
          api_code={b.api_code}
          field="price_failed"
          value={b.price_f}
          editable={editable}
          size="sm"
        />
      </PriceField>
    </div>
  );
}

function PriceField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-[9px] uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </div>
  );
}
