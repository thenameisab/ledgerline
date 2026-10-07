"use client";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { StatusChip, type StatusKind } from "@/components/chips/StatusChip";
import { Sparkline } from "@/components/Sparkline";
import { formatMoney, formatNumber } from "@/lib/format";
import { ChevronDown, ArrowUpRight, Calendar, Activity, Layers } from "lucide-react";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";

export type AccountTopApiData = {
  api_code: string;
  api_name: string;
  hits: number;
  revenue: number;
};

export type AccountCardData = {
  accountId: number;
  name: string;
  group: string | null;
  status: StatusKind;
  revenue: number;
  hits: number;
  apisUsed: number;
  unpricedPairs: number;
  unpricedHits: number;
  spark: number[];
  topApis: AccountTopApiData[];
  peakDay: { date: string; hits: number } | null;
  activeDays: number;
  lastActivity: string | null;
};

const SPRING = { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const };

export function AccountCard({
  data,
  index,
  expanded,
  onToggle,
}: {
  data: AccountCardData;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const prefersReduced = useReducedMotion();

  // Per DESIGN.md §5: surface elevation via tint, not border. Healthy rows
  // sit in the page surface with no chrome; trouble rows tint to stand out.
  const isLeak = data.status === "leak";
  const isSandbox = data.status === "sandbox";
  const tintedBg = isLeak
    ? "bg-bad-bg"
    : isSandbox
    ? "bg-info-bg"
    : "bg-bg-raised";

  const borderClass = expanded
    ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]"
    : isLeak
    ? "border-bad-bg"
    : isSandbox
    ? "border-info-bg"
    : "border-transparent hover:border-border";

  const sparkStroke = isLeak ? "var(--color-bad-ink)" : "var(--color-accent)";

  const briefing = composeRowBriefing(data);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <motion.div
      layout={!prefersReduced}
      transition={SPRING}
      initial={prefersReduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative rounded-lg border ${borderClass} ${tintedBg} transition-[border-color,background-color] duration-fast ease-expo`}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={onKey}
    >
      {/* Collapsed face — single landmark row per DESIGN.md AccountHeadline spec */}
      <motion.div layout="position" transition={SPRING} className="px-5 py-4 flex items-center gap-5">
        {/* Left: name landmark + briefing line */}
        <div className="min-w-0 flex-1">
          <TruncateTooltip
            as="div"
            text={data.name}
            className="font-serif text-4xl lg:text-5xl text-ink leading-none"
          />
          <div className="mt-2 flex items-baseline gap-2 text-xs text-ink-faint">
            <span className="truncate">{data.group ?? "Standalone"}</span>
            <span aria-hidden>·</span>
            <TruncateTooltip
              as="span"
              text={briefing}
              className={`min-w-0 truncate ${isLeak ? "text-bad-ink" : "text-ink-muted"}`}
            />
          </div>
        </div>

        {/* Right: status + revenue + sparkline + chevron */}
        <div className="flex items-center gap-5 shrink-0">
          <StatusChip kind={data.status} />
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">MTD revenue</div>
            <div className="font-serif text-2xl text-ink tnum leading-none mt-1">
              {data.revenue > 0 ? (
                formatMoney(data.revenue, { compact: true })
              ) : (
                <span className="text-ink-faint">—</span>
              )}
            </div>
          </div>
          <Sparkline data={data.spark} width={80} height={28} stroke={sparkStroke} />
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="text-ink-faint shrink-0"
            aria-hidden="true"
          >
            <ChevronDown size={14} strokeWidth={1.5} />
          </motion.span>
        </div>
      </motion.div>

      {/* Expanded panel — full-row, 3-column rich detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={prefersReduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={SPRING}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ExpandedPanel data={data} sparkStroke={sparkStroke} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ExpandedPanel({
  data,
  sparkStroke,
}: {
  data: AccountCardData;
  sparkStroke: string;
}) {
  const peakHits = Math.max(...data.topApis.map((a) => a.hits), 1);

  return (
    <div className="border-t border-border">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Column 1 — context + status detail */}
        <div className="p-6">
          <SectionLabel>Status</SectionLabel>
          <div className="mt-2 space-y-1.5">
            <DetailRow
              icon={<Calendar size={11} strokeWidth={1.5} />}
              label="Last activity"
              value={data.lastActivity ? formatShortDate(data.lastActivity) : "—"}
            />
            <DetailRow
              icon={<Activity size={11} strokeWidth={1.5} />}
              label="Active days"
              value={`${data.activeDays} this period`}
            />
            <DetailRow
              icon={<Layers size={11} strokeWidth={1.5} />}
              label="Peak day"
              value={
                data.peakDay
                  ? `${formatShortDate(data.peakDay.date)} · ${formatNumber(data.peakDay.hits)} units`
                  : "—"
              }
            />
          </div>

          {data.unpricedPairs > 0 ? (
            <div className="mt-5 rounded-sm bg-bad-bg px-3 py-2 text-xs text-bad-ink">
              <div className="font-medium">Pricing gap</div>
              <div className="mt-0.5 leading-relaxed">
                {data.unpricedPairs} (account, api) pair
                {data.unpricedPairs === 1 ? "" : "s"} have traffic but no
                pricing — {formatNumber(data.unpricedHits)} units at risk this period.
              </div>
            </div>
          ) : (
            <div className="mt-5 text-xs text-ink-faint">All used SKUs are priced.</div>
          )}
        </div>

        {/* Column 2 — daily revenue pace */}
        <div className="p-6">
          <SectionLabel>Daily revenue pace</SectionLabel>
          <div className="mt-3">
            <Sparkline data={data.spark} width={320} height={64} stroke={sparkStroke} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <Metric label="Units" value={formatNumber(data.hits)} />
            <Metric label="SKUs used" value={String(data.apisUsed)} />
          </div>
        </div>

        {/* Column 3 — top APIs by hits */}
        <div className="p-6">
          <SectionLabel>Top SKUs</SectionLabel>
          {data.topApis.length === 0 ? (
            <div className="mt-3 text-xs text-ink-faint">No traffic this period.</div>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.topApis.map((a) => {
                const pct = (a.hits / peakHits) * 100;
                return (
                  <li key={a.api_code}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <TruncateTooltip text={a.api_name} className="text-ink min-w-0" />
                      <span className="font-mono tnum text-ink-muted shrink-0">
                        {formatNumber(a.hits)}
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-bg-sunken overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full bg-accent"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Threshold CTA — full-width portal, distinctive type + animated arrow rail */}
      <ThresholdCTA
        accountId={data.accountId}
        revenue={data.revenue}
        hits={data.hits}
        apis={data.apisUsed}
      />
    </div>
  );
}

// ─── ThresholdCTA ────────────────────────────────────────────────────────────
// Not a button — a "threshold" the user steps through. Display-type italic
// verbiage on the left says what's behind the door; mono live stats sit in the
// middle as evidence; an arrow token on the right fills with accent on hover
// while a hairline ink rail draws left-to-right beneath the verbiage.
//
// Honours design system: no gradient, no bounce, no bold; emphasis via scale +
// serif italic + the rail draw. /impeccable overdrive — single moment of
// drama, used surgically (one per expanded card).
function ThresholdCTA({
  accountId,
  revenue,
  hits,
  apis,
}: {
  accountId: number;
  revenue: number;
  hits: number;
  apis: number;
}) {
  return (
    <Link
      href={`/accounts/${accountId}`}
      onClick={(e) => e.stopPropagation()}
      className="threshold-cta group/cta relative flex items-center gap-6 px-6 py-5 border-t border-border bg-bg-raised hover:bg-accent-bg transition-colors duration-base ease-expo focus:outline-none"
    >
      {/* Left — verbiage + ink rail */}
      <div className="flex-1 min-w-0 relative">
        <div
          className="font-serif italic text-2xl text-ink leading-none"
          style={{ fontWeight: 400 }}
        >
          Open the full account view
        </div>
        <div className="text-xs text-ink-faint mt-1.5">
          Per-SKU breakdown · 90-day activity heatmap · pricing editor
        </div>
        {/* The ink rail — a 1px line that draws left-to-right on hover */}
        <span
          aria-hidden="true"
          className="absolute -bottom-2 left-0 h-px bg-accent-ink threshold-rail"
        />
      </div>

      {/* Middle — live evidence in mono */}
      <div className="hidden md:flex items-center gap-5 text-xs text-ink-muted shrink-0">
        <Stat label="Revenue" value={revenue > 0 ? formatMoney(revenue, { compact: true }) : "—"} />
        <span className="text-border" aria-hidden="true">/</span>
        <Stat label="Units" value={formatNumber(hits)} />
        <span className="text-border" aria-hidden="true">/</span>
        <Stat label="SKUs" value={String(apis)} />
      </div>

      {/* Right — arrow token. Outline by default, fills on hover. */}
      <span
        aria-hidden="true"
        className="threshold-token relative shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full border border-accent-ink/40 text-accent-ink transition-colors duration-base ease-expo group-hover/cta:bg-accent group-hover/cta:text-white group-hover/cta:border-accent"
      >
        <ArrowUpRight
          size={18}
          strokeWidth={1.5}
          className="threshold-arrow"
        />
      </span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
      <span className="font-mono tnum text-ink">{value}</span>
    </span>
  );
}

function Metric({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div>
      <dt className="text-ink-faint text-[11px] uppercase tracking-wide">{label}</dt>
      <dd className={`font-mono tnum mt-0.5 ${subtle ? "text-ink-faint" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wide text-ink-faint">{children}</div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="inline-flex items-center gap-1.5 text-ink-muted">
        {icon}
        {label}
      </span>
      <span className="font-mono tnum text-ink">{value}</span>
    </div>
  );
}

function composeRowBriefing(data: AccountCardData): string {
  if (data.unpricedPairs > 0) {
    return `${data.unpricedPairs} unpriced pair${data.unpricedPairs === 1 ? "" : "s"} · ${formatNumber(data.unpricedHits)} units at risk`;
  }
  const parts: string[] = [];
  parts.push(`${formatNumber(data.hits)} units`);
  parts.push(`${data.apisUsed} SKU${data.apisUsed === 1 ? "" : "s"}`);
  if (data.topApis[0]) parts.push(`top: ${data.topApis[0].api_name}`);
  return parts.join(" · ");
}

function formatShortDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00Z");
  if (isNaN(d.getTime())) return s;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}
