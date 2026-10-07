"use client";
import { EntityHoverCard, SkelBar } from "@/components/ui/EntityHoverCard";
import { Footer } from "@/components/AccountHoverCard";
import { isLowConfidence, confirmedShare, formatShare } from "@/lib/vendor-confidence";
import { formatINR, formatNumber } from "@/lib/format";
import type { ApiHoverCard as Data } from "@/lib/repos/hover";

// Rich hover for any API name. Wrap the existing name link:
//   <ApiHoverCard code={code}><Link …>…</Link></ApiHoverCard>
export function ApiHoverCard({
  code,
  side,
  align,
  children,
}: {
  code: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  return (
    <EntityHoverCard<Data>
      endpoint={`/api/hover/api/${encodeURIComponent(code)}`}
      width={320}
      side={side}
      align={align}
      skeleton={<Skeleton />}
      render={(d) => <Card d={d} />}
    >
      {children}
    </EntityHoverCard>
  );
}

function Card({ d }: { d: Data }) {
  const marginPct = d.margin != null && d.revenue > 0 ? (d.margin / d.revenue) * 100 : null;
  const negative = d.margin != null && d.margin < 0;
  const lowConfidence = isLowConfidence(d.costConfidence);

  return (
    <div>
      {/* Header — name + code + category */}
      <div className="p-4 pb-3">
        <div className="font-serif text-lg leading-tight text-ink">{d.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-[11px] text-ink-faint">{d.productCode}</span>
          {d.category && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-bg-sunken text-ink-muted">
              {d.category}
            </span>
          )}
        </div>
      </div>

      {/* Headline revenue + avg price */}
      <div className="px-4 pb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">{d.periodLabel} revenue</div>
          <div className="font-serif text-2xl text-ink tnum leading-none mt-1">
            {d.revenue > 0 ? formatINR(d.revenue, { compact: true }) : <span className="text-ink-faint">—</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">Avg ₹/hit</div>
          <div className="font-mono tnum text-sm text-ink mt-1">
            {d.avgUnitPrice > 0 ? `₹${d.avgUnitPrice.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      {/* Metric strip — margin column only for admins (null otherwise) */}
      <div
        className={`grid ${d.margin != null ? "grid-cols-3" : "grid-cols-2"} border-t border-border divide-x divide-border text-center`}
      >
        <Metric label="Hits" value={formatNumber(d.hits)} />
        <Metric label="Accounts" value={String(d.uniqueAccounts)} />
        {d.margin != null && (
          // A margin computed against placeholder rates takes the muted token,
          // the same rule the dashboard headline and the invoice follow. There
          // is no room here for the bar that would explain it, so the hover
          // title carries the figure instead.
          <Metric
            label="Margin"
            value={marginPct != null ? `${marginPct.toFixed(0)}%` : formatINR(d.margin, { compact: true })}
            tone={negative ? "bad" : lowConfidence ? "muted" : "default"}
            title={
              lowConfidence && d.costConfidence
                ? `Vendor cost is confirmed on ${formatShare(confirmedShare(d.costConfidence))} of this period's hits — this margin is not a measurement`
                : undefined
            }
          />
        )}
      </div>

      {/* Top consumer */}
      {d.topConsumer && (
        <div className="flex items-baseline justify-between gap-2 px-4 py-2.5 border-t border-border text-xs">
          <span className="text-ink-faint">Top consumer</span>
          <span className="min-w-0 text-right">
            <span className="text-ink truncate">{d.topConsumer.name}</span>
            <span className="text-ink-faint ml-1.5 font-mono tnum">{d.topConsumer.share.toFixed(0)}%</span>
          </span>
        </div>
      )}

      {/* Vendor breakdown */}
      {d.vendorBreakdown.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-2">Vendors</div>
          <ul className="space-y-1 text-xs">
            {d.vendorBreakdown.map((v) => (
              <li key={v.vendor} className="flex items-baseline justify-between gap-2">
                <span className="text-ink-muted truncate">{v.vendor}</span>
                <span className="font-mono tnum text-ink-muted shrink-0">{formatNumber(v.hits)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Footer href={`/apis/${encodeURIComponent(d.productCode)}`} label="Open API view" />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
  title,
}: {
  label: string;
  value: string;
  tone?: "default" | "bad" | "muted";
  title?: string;
}) {
  return (
    <div className="py-2.5" title={title}>
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div
        className={`font-mono tnum text-sm mt-0.5 ${
          tone === "bad" ? "text-bad-ink" : tone === "muted" ? "text-ink-muted" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-4 space-y-3">
      <SkelBar w="70%" h={14} />
      <SkelBar w="40%" h={10} />
      <SkelBar w="50%" h={24} />
      <SkelBar w="100%" h={32} />
    </div>
  );
}
