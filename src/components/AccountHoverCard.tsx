"use client";
import Link from "next/link";
import { ArrowUpRight, AlertOctagon } from "lucide-react";
import { EntityHoverCard, SkelBar } from "@/components/ui/EntityHoverCard";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { StatusChip } from "@/components/chips/StatusChip";
import { Sparkline } from "@/components/Sparkline";
import { formatINR, formatNumber } from "@/lib/format";
import type { AccountHoverCard as Data } from "@/lib/repos/hover";

// Rich hover for any account name. Wrap the existing name link:
//   <AccountHoverCard slug={slug}><Link …>…</Link></AccountHoverCard>
export function AccountHoverCard({
  slug,
  side,
  align,
  children,
}: {
  slug: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  return (
    <EntityHoverCard<Data>
      endpoint={`/api/hover/account/${slug}`}
      width={340}
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
  const leak = d.status === "leak";
  const sparkStroke = leak ? "var(--color-bad)" : "var(--color-accent)";
  const peak = Math.max(...d.topApis.map((a) => a.hits), 1);

  return (
    <div>
      {/* Header — logo + name + group, status chip */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <AccountLogo name={d.name} slug={d.slug} hasLogo={d.hasLogo} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-serif text-lg leading-tight text-ink truncate">{d.name}</div>
          <div className="text-xs text-ink-faint truncate mt-0.5">{d.group ?? "Standalone"}</div>
        </div>
        <StatusChip kind={d.status} />
      </div>

      {/* Headline revenue + sparkline */}
      <div className="px-4 pb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">{d.periodLabel} revenue</div>
          <div className="font-serif text-2xl text-ink tnum leading-none mt-1">
            {d.revenue > 0 ? formatINR(d.revenue, { compact: true }) : <span className="text-ink-faint">—</span>}
          </div>
        </div>
        <Sparkline data={d.spark} width={96} height={30} stroke={sparkStroke} />
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-3 border-t border-border divide-x divide-border text-center">
        <Metric label="Hits" value={formatNumber(d.hits)} />
        <Metric label="APIs" value={String(d.apisUsed)} />
        <Metric label="Active days" value={String(d.activeDays)} />
      </div>

      {/* Pricing gap warning */}
      {d.unpricedPairs > 0 && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-bad-bg text-bad-ink border-t border-border">
          <AlertOctagon size={13} strokeWidth={1.5} className="mt-px shrink-0" />
          <span className="text-[11px] leading-snug">
            {d.unpricedPairs} unpriced pair{d.unpricedPairs === 1 ? "" : "s"} · {formatNumber(d.unpricedHits)} hits at risk
          </span>
        </div>
      )}

      {/* Top APIs */}
      {d.topApis.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-2">Top APIs</div>
          <ul className="space-y-1.5">
            {d.topApis.map((a) => (
              <li key={a.api_code}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-ink truncate">{a.api_name}</span>
                  <span className="font-mono tnum text-ink-muted shrink-0">{formatNumber(a.hits)}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-bg-sunken overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${(a.hits / peak) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Footer href={`/accounts/${d.slug}`} label="Open account view" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="font-mono tnum text-sm text-ink mt-0.5">{value}</div>
    </div>
  );
}

export function Footer({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group/foot flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border bg-bg-raised hover:bg-accent-bg transition-colors duration-fast ease-expo"
    >
      <span className="text-xs font-medium text-accent-ink">{label}</span>
      <ArrowUpRight
        size={14}
        strokeWidth={1.5}
        className="text-accent-ink transition-transform duration-fast ease-expo group-hover/foot:translate-x-0.5 group-hover/foot:-translate-y-0.5"
      />
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <SkelBar w={40} h={40} />
        <div className="space-y-2 flex-1">
          <SkelBar w="60%" h={14} />
          <SkelBar w="40%" h={10} />
        </div>
      </div>
      <SkelBar w="50%" h={24} />
      <SkelBar w="100%" h={40} />
    </div>
  );
}
