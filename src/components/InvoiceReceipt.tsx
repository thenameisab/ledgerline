import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { AdjustmentsSection } from "@/app/accounts/[slug]/invoices/[period]/AdjustmentsSection";
import { formatMoney, formatPrice, formatPercent, formatNumber, formatDateLong } from "@/lib/format";
import type { StatementData } from "@/lib/repos/statements";
import { CostConfidence } from "@/components/vendor/CostConfidence";
import { isLowConfidence, type CostConfidence as Confidence } from "@/lib/vendor-confidence";

/**
 * Reusable invoice receipt — used both on the dedicated invoice page and as
 * the right-side preview pane on the invoice list. Layout mirrors StatementPdf.tsx
 * so the in-app preview matches the downloaded PDF.
 */
export function InvoiceReceipt({
  data,
  accountId,
  accountSlug,
  periodId,
  canEdit,
  showCost,
  confidence,
  compact = false,
}: {
  data: StatementData;
  accountId: number;
  accountSlug: string;
  periodId: number;
  canEdit: boolean;
  /** Vendor cost + margin columns follow canViewCost; members see revenue only. */
  showCost: boolean;
  /**
   * Coverage behind this statement's cost — live on a draft, and on a
   * finalized one the copy frozen at finalize. Null for
   * viewers who never see cost.
   */
  confidence?: Confidence | null;
  /** When true, drops the A4 max-width and tightens padding for use in a side pane. */
  compact?: boolean;
}) {
  return (
    <article
      className={`bg-bg-raised border border-border rounded-lg ${
        compact ? "px-5 py-6" : "px-5 py-6 md:px-10 md:py-9 max-w-3xl mx-auto"
      }`}
    >
      {/* Header strip */}
      <div className="flex items-end justify-between pb-5 border-b border-border">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-2xl text-ink" style={{ fontWeight: 600 }}>
            Ledgerline
          </span>
          <span className="text-xs uppercase tracking-wider text-ink-muted">Billing</span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs uppercase tracking-wider text-ink-muted">Invoice</div>
          <div
            className="font-mono text-sm md:text-base text-ink tnum whitespace-nowrap"
            style={{ fontWeight: 500 }}
          >
            {data.header.number}
          </div>
        </div>
      </div>

      {/* Bill-to + period */}
      <div className="flex flex-col md:flex-row md:justify-between gap-6 md:gap-0 mt-6 mb-6">
        <div className="w-full md:w-1/2 md:pr-4">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted mb-2" style={{ fontWeight: 500 }}>
            Bill to
          </h2>
          <div className="font-serif text-xl text-ink" style={{ fontWeight: 600 }}>
            {data.header.account.billing_entity ?? data.header.account.display_name}
          </div>
          {data.header.account.billing_entity &&
            data.header.account.billing_entity !== data.header.account.display_name && (
              <div className="text-sm text-ink-muted">{data.header.account.display_name}</div>
            )}
          {data.header.account.group_name && (
            <div className="text-sm text-ink-muted">Group · {data.header.account.group_name}</div>
          )}
          {data.header.account.gstin && (
            <div className="font-mono text-sm text-ink-muted tnum">
              {data.header.account.gstin}
            </div>
          )}
        </div>
        <div className="w-full md:w-1/2 md:pl-4 md:text-right">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted mb-2" style={{ fontWeight: 500 }}>
            Period
          </h2>
          <div className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
            {formatDateLong(data.header.period.start_date)} —{" "}
            {formatDateLong(data.header.period.end_date)}
          </div>
          <div className="text-sm text-ink-muted">{data.header.period.label}</div>
          <div className="flex md:justify-end mt-2">
            <InvoiceStatusPill status={data.header.status} />
          </div>
        </div>
      </div>

      {/* Totals strip */}
      <div className={`grid ${showCost ? "grid-cols-3" : "grid-cols-1"} gap-0 bg-bg-sunken rounded px-5 py-5 mb-6`}>
        <TotalsCell
          label="Revenue"
          value={formatMoney(data.totals.revenue)}
          sub={
            showCost
              ? `${formatNumber(data.totals.hits)} units`
              : `${formatNumber(data.totals.hits)} units · ${data.totals.lines} SKU${data.totals.lines === 1 ? "" : "s"} billed`
          }
        />
        {showCost && (
          <>
            <TotalsCell
              label="Vendor cost"
              value={formatMoney(data.totals.vendor_cost)}
              sub={`${data.totals.lines} SKU${data.totals.lines === 1 ? "" : "s"} billed`}
              divider
            />
            <TotalsCell
              label="Margin"
              value={formatMoney(data.totals.margin)}
              sub={`${formatPercent(data.totals.margin_pct, 1)} of revenue`}
              divider
              muted={isLowConfidence(confidence)}
              footer={
                confidence ? <CostConfidence confidence={confidence} className="mt-2" /> : undefined
              }
            />
          </>
        )}
      </div>

      {/* Line items */}
      <div className="overflow-x-auto -mx-5 px-5 md:mx-0 md:px-0">
        <div className={showCost ? "min-w-[760px]" : "min-w-[560px]"}>
          <div
            className="grid grid-cols-12 gap-2 bg-bg-sunken px-3 py-2 border-b border-border text-xs uppercase tracking-wider text-ink-muted"
            style={{ fontWeight: 500 }}
          >
            <div className={showCost ? "col-span-3" : "col-span-4"}>SKU</div>
            <div className={`${showCost ? "col-span-1" : "col-span-2"} text-right`}>Units</div>
            <div className={`${showCost ? "col-span-2" : "col-span-3"} text-right`}>Unit price</div>
            <div className={`${showCost ? "col-span-2" : "col-span-3"} text-right`}>Subtotal</div>
            {showCost && <div className="col-span-2 text-right">Cost</div>}
            {showCost && <div className="col-span-2 text-right">Margin</div>}
          </div>
          {data.lines.length === 0 ? (
            <div className="px-3 py-6 text-center text-ink-muted text-sm">
              No billable activity in this period.
            </div>
          ) : (
            data.lines.map((l) => {
              const unitPrice = l.successful > 0 ? l.revenue / l.successful : 0;
              const isBad = showCost && l.margin < 0;
              return (
                <div
                  key={`${l.api_code}:${l.is_bundle ? "stitch" : "api"}`}
                  className={`grid grid-cols-12 gap-2 px-3 py-2.5 border-b border-border items-center ${
                    isBad ? "bg-bad-bg" : ""
                  }`}
                >
                  <div className={`${showCost ? "col-span-3" : "col-span-4"} min-w-0`}>
                    <TruncateTooltip as="div" text={l.api_name} className="text-sm text-ink" />
                    <div className="flex items-center gap-1.5">
                      {l.is_bundle ? (
                        <span
                          title="Stitched product. It is billed once per unit of the anchor SKU at the agreed price. Vendor cost covers all stitched SKUs."
                          className="inline-flex items-center text-[11px] text-accent-ink px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-accent/30"
                        >
                          stitched
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-ink-muted">{l.api_code}</span>
                      )}
                      {showCost && l.vendor_estimated && l.vendor_cost > 0 && (
                        <span
                          className="bg-warn-bg text-warn-ink tracking-wide px-1.5 rounded"
                          style={{ fontSize: 9, fontWeight: 500 }}
                          title="Vendor cost comes from a rate we filled in ourselves, not one the vendor gave us"
                        >
                          Est.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`${showCost ? "col-span-1" : "col-span-2"} text-right font-mono text-sm text-ink tnum`}>
                    {formatNumber(l.hits)}
                  </div>
                  <div className={`${showCost ? "col-span-2" : "col-span-3"} text-right font-mono text-sm text-ink tnum`}>
                    {formatPrice(unitPrice)}
                  </div>
                  <div className={`${showCost ? "col-span-2" : "col-span-3"} text-right font-mono text-sm text-ink tnum`}>
                    {formatMoney(l.revenue, { precision: 2 })}
                  </div>
                  {showCost && (
                    <div className="col-span-2 text-right font-mono text-sm text-ink tnum">
                      {formatMoney(l.vendor_cost, { precision: 2 })}
                    </div>
                  )}
                  {showCost && (
                    <div className="col-span-2 text-right font-mono text-sm text-ink tnum">
                      {formatMoney(l.margin, { precision: 2 })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Subtotals row */}
          <div className="grid grid-cols-12 gap-2 px-3 py-3 border-t border-ink">
            <div className={`${showCost ? "col-span-3" : "col-span-4"} text-xs uppercase tracking-wider text-ink-muted`} style={{ fontWeight: 500 }}>
              Subtotal
            </div>
            <div className={`${showCost ? "col-span-1" : "col-span-2"} text-right font-mono text-base text-ink tnum`} style={{ fontWeight: 500 }}>
              {formatNumber(data.totals.hits)}
            </div>
            <div className={showCost ? "col-span-2" : "col-span-3"} />
            <div className={`${showCost ? "col-span-2" : "col-span-3"} text-right font-mono text-base text-ink tnum`} style={{ fontWeight: 500 }}>
              {formatMoney(data.totals.revenue, { precision: 2 })}
            </div>
            {showCost && (
              <div className="col-span-2 text-right font-mono text-base text-ink tnum" style={{ fontWeight: 500 }}>
                {formatMoney(data.totals.vendor_cost, { precision: 2 })}
              </div>
            )}
            {showCost && (
              <div className="col-span-2 text-right font-mono text-base text-ink tnum" style={{ fontWeight: 500 }}>
                {formatMoney(data.totals.margin, { precision: 2 })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Adjustments — admin-editable on final invoices */}
      <AdjustmentsSection
        accountId={accountId}
        accountSlug={accountSlug}
        periodId={periodId}
        adjustments={data.adjustments}
        status={data.header.status}
        canEdit={canEdit}
        variant="internal"
      />

      {data.adjustments.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-ink px-3 py-3">
          <div className="text-xs uppercase tracking-wider text-ink-muted" style={{ fontWeight: 500 }}>
            Grand total
          </div>
          <div className="font-mono tnum text-lg text-ink" style={{ fontWeight: 600 }}>
            {formatMoney(data.totals.grand_total, { precision: 2 })}
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-ink-faint">
        <span>
          {data.header.status === "draft"
            ? "Draft — for internal review only"
            : data.header.status === "final"
            ? "Final — adjustments still editable until issued"
            : "Issued invoice"}
          {showCost ? " · The customer PDF omits vendor cost and margin." : ""}
        </span>
        <span className="font-mono">{data.header.number}</span>
      </div>
    </article>
  );
}

function TotalsCell({
  label,
  value,
  sub,
  divider,
  muted,
  footer,
}: {
  label: string;
  value: string;
  sub: string;
  divider?: boolean;
  /** Low cost confidence — the figure drops to the muted token. */
  muted?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div className={`px-4 ${divider ? "border-l border-border" : ""}`}>
      <h2 className="text-xs uppercase tracking-wider text-ink-muted mb-1" style={{ fontWeight: 500 }}>
        {label}
      </h2>
      <div
        className={`font-serif text-2xl tnum ${muted ? "text-ink-muted" : "text-ink"}`}
        style={{ fontWeight: 600 }}
      >
        {value}
      </div>
      <div className="font-mono text-xs text-ink-muted mt-1 tnum">{sub}</div>
      {footer}
    </div>
  );
}

export function InvoiceStatusPill({ status }: { status: "draft" | "final" | "issued" }) {
  const palette = {
    draft: { bg: "bg-warn-bg", fg: "text-warn-ink", label: "Draft" },
    final: { bg: "bg-ok-bg", fg: "text-ok-ink", label: "Final" },
    issued: { bg: "bg-info-bg", fg: "text-info-ink", label: "Issued" },
  }[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs uppercase tracking-wider ${palette.bg} ${palette.fg}`}
      style={{ fontWeight: 500 }}
    >
      {palette.label}
    </span>
  );
}
