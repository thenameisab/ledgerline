"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, OctagonAlert, TrendingUp, TriangleAlert } from "lucide-react";
import { Label, Num, Snippet, useInView } from "@/components/landing/ui";

type Severity = "bad" | "warn" | "ok";

const SEVERITY: Record<
  Severity,
  { label: string; Icon: typeof OctagonAlert; text: string; tag: string; ring: string }
> = {
  bad: { label: "Needs action", Icon: OctagonAlert, text: "text-bad", tag: "bg-bad-bg text-bad-ink", ring: "ring-bad" },
  warn: { label: "Watch", Icon: TriangleAlert, text: "text-warn", tag: "bg-warn-bg text-warn-ink", ring: "ring-warn" },
  ok: { label: "Good news", Icon: TrendingUp, text: "text-ok", tag: "bg-ok-bg text-ok-ink", ring: "ring-ok" },
};

type Alert = {
  id: string;
  account: string;
  slug: string;
  message: string;
  severity: Severity;
  time: string;
  why: string;
  spark?: number[];
};

// Fictional alerts from the 06:30 IST check.
const ALERTS: Alert[] = [
  {
    id: "acme",
    account: "Acme Lending Co",
    slug: "acme-lending-co",
    message: "PAN Verification volume down 62% vs the 4-week baseline",
    severity: "bad",
    time: "2h ago",
    why: "PAN Verification averaged 41,200 hits a day over the last 4 weeks. Yesterday it had 15,650, which is 62% lower.",
    spark: [40, 42, 41, 43, 40, 39, 42, 41, 43, 42, 40, 41, 28, 15.6],
  },
  {
    id: "vertex",
    account: "Vertex Pay",
    slug: "vertex-pay",
    message: "Failure rate 14% on Bank Account Verification (Penny Drop), usual is 2%",
    severity: "bad",
    time: "2h ago",
    why: "4,812 of 34,370 Penny Drop calls failed yesterday, which is 14%. The 4-week failure rate is 2%.",
  },
  {
    id: "orbit-cards",
    account: "Orbit Cards",
    slug: "orbit-cards",
    message: "New API in use: Credit Bureau Pull. No price set, so these hits are unpriced",
    severity: "warn",
    time: "2h ago",
    why: "Orbit Cards made 1,284 Credit Bureau Pull calls since 2 Oct. FR5001 has no price for this account, so the hits add ₹0 to revenue.",
  },
  {
    id: "helios",
    account: "Helios Capital",
    slug: "helios-capital",
    message: "No usage for 3 days",
    severity: "warn",
    time: "2h ago",
    why: "Helios Capital averaged 6,900 hits a day in September. It has had no hits since 4 Oct.",
    spark: [7, 6.8, 7.1, 6.9, 7, 6.7, 7.2, 6.9, 7, 6.8, 7.1, 0, 0, 0],
  },
  {
    id: "zenith",
    account: "Zenith Payments",
    slug: "zenith-payments",
    message: "Revenue 18% below last month at the same day",
    severity: "warn",
    time: "2h ago",
    why: "Revenue to 6 Oct is ₹2,14,300. Revenue to 6 Sep was ₹2,61,350, so this month is 18% lower.",
    spark: [30, 31, 29, 30, 28, 29, 27, 28, 26, 27, 25, 26, 24, 24.6],
  },
  {
    id: "orbit-neo",
    account: "Orbit Neobank",
    slug: "orbit-neobank",
    message: "Revenue up 31% vs last month",
    severity: "ok",
    time: "1d ago",
    why: "Revenue to 6 Oct is ₹4,12,800. Revenue to 6 Sep was ₹3,15,100, so this month is 31% higher.",
    spark: [20, 21, 20, 22, 23, 22, 24, 25, 24, 26, 27, 26, 28, 29],
  },
  {
    id: "summit",
    account: "Summit Credit Union",
    slug: "summit-credit-union",
    message: "First usage on Face Match",
    severity: "ok",
    time: "1d ago",
    why: "Summit Credit Union made its first 86 Face Match calls on 6 Oct. The price is set at ₹4 per hit.",
  },
];

const ORDER: Severity[] = ["bad", "warn", "ok"];

export function AlertsSnippet() {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [filter, setFilter] = useState<Severity | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [showReviewed, setShowReviewed] = useState(false);
  // The first-view stagger runs once. After it, rows that appear do not wait.
  const [staggered, setStaggered] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(() => setStaggered(true), ALERTS.length * 50 + 300);
    return () => window.clearTimeout(t);
  }, [inView]);

  const open = ALERTS.filter((a) => !reviewed.includes(a.id));
  const visible = open.filter((a) => !filter || a.severity === filter);
  const done = ALERTS.filter((a) => reviewed.includes(a.id));
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, bounce: 0, duration: 0.35 };

  return (
    <div ref={ref}>
      <Snippet path="alerts">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Filter alerts by severity">
            {ORDER.map((sev) => {
              const s = SEVERITY[sev];
              const count = open.filter((a) => a.severity === sev).length;
              const on = filter === sev;
              return (
                <button
                  key={sev}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(on ? null : sev)}
                  className={`ll-press flex min-w-0 flex-col items-start gap-1 rounded border border-border bg-bg p-2 text-left outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 sm:p-3 ${
                    on ? `ring-2 ${s.ring}` : ""
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-1">
                    <s.Icon size={14} className={`shrink-0 ${s.text}`} aria-hidden />
                    <span className="font-display text-[18px] tracking-display text-ink sm:text-[22px]">
                      <Num value={count} />
                    </span>
                  </span>
                  <span className="w-full text-[11px] leading-tight text-ink-muted sm:text-[12px]">
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-h-[468px] sm:min-h-[400px]">
            <LayoutGroup>
              <ul className="flex flex-col gap-1.5" aria-label="Open alerts">
                <AnimatePresence initial={false} mode="popLayout">
                  {visible.map((a, i) => (
                    <motion.li
                      key={a.id}
                      layout={reduce ? false : "position"}
                      initial={staggered ? { opacity: 0 } : { opacity: 0, y: reduce ? 0 : 6 }}
                      animate={inView ? { opacity: 1, y: 0 } : undefined}
                      exit={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
                      transition={{
                        opacity: { duration: 0.24, ease: [0.23, 1, 0.32, 1], delay: staggered ? 0 : i * 0.05 },
                        y: { duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: staggered ? 0 : i * 0.05 },
                        scale: { duration: 0.16 },
                        layout: spring,
                      }}
                    >
                      <AlertRow
                        alert={a}
                        expanded={expanded === a.id}
                        onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
                        onReview={() => {
                          setReviewed((r) => [...r, a.id]);
                          setExpanded(null);
                        }}
                        spring={spring}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {visible.length === 0 && (
                <p className="py-4 text-[13px] text-ink-muted">
                  No open alerts in {filter ? SEVERITY[filter].label : "this list"}.
                </p>
              )}

              {done.length > 0 && (
                <motion.div layout={reduce ? false : "position"} transition={spring} className="mt-3 border-t border-border pt-3">
                  <button
                    type="button"
                    aria-expanded={showReviewed}
                    aria-controls="ll-alerts-reviewed"
                    onClick={() => setShowReviewed((v) => !v)}
                    className="ll-press flex items-center gap-1.5 rounded text-[12px] text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <ChevronDown
                      size={13}
                      aria-hidden
                      style={{
                        transform: showReviewed ? "rotate(180deg)" : "none",
                        transition: reduce ? "none" : "transform 200ms var(--ll-ease-out)",
                      }}
                    />
                    Reviewed <span className="tabular-nums" aria-live="polite">({done.length})</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {showReviewed && (
                      <motion.ul
                        id="ll-alerts-reviewed"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={spring}
                        className="overflow-hidden"
                      >
                        {done.map((a) => (
                          <li
                            key={a.id}
                            className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded border border-border px-3 py-2 text-[12px]"
                          >
                            <Check size={13} className="shrink-0 text-ok" aria-hidden />
                            <span className="font-medium text-ink">{a.account}</span>
                            <span className="min-w-0 flex-1 truncate text-ink-muted" title={a.message}>
                              {a.message}
                            </span>
                            <span className="text-ink-faint">Reviewed by Maya Sharma</span>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </LayoutGroup>
          </div>
        </div>
      </Snippet>
    </div>
  );
}

function AlertRow({
  alert: a,
  expanded,
  onToggle,
  onReview,
  spring,
}: {
  alert: Alert;
  expanded: boolean;
  onToggle: () => void;
  onReview: () => void;
  spring: object;
}) {
  const s = SEVERITY[a.severity];
  const panelId = `ll-alert-${a.id}`;
  return (
    <div className={`rounded border bg-bg ${expanded ? "border-border-strong" : "border-border"}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="ll-press flex w-full items-start gap-2.5 rounded px-3 py-2.5 text-left outline-none hover:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-accent"
      >
        <s.Icon size={14} className={`mt-[2px] shrink-0 ${s.text}`} aria-hidden />
        <span className="min-w-0 flex-1 text-[13px] leading-snug">
          <span className="font-medium text-ink">{a.account}</span>
          <span className="text-ink-faint"> · </span>
          <span className="text-ink-muted">{a.message}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2.5">
          {a.spark && <Sparkline points={a.spark} className={`hidden sm:block ${s.text}`} />}
          <span className={`rounded-sm px-1.5 py-0.5 text-[11px] ${s.tag}`}>{s.label}</span>
          <span className="text-[11px] tabular-nums text-ink-faint">{a.time}</span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 border-t border-border px-3 pb-3 pt-2.5 sm:pl-[38px]">
              {a.spark && <Sparkline points={a.spark} className={`sm:hidden ${s.text}`} />}
              <div>
                <Label>Why this fired</Label>
                <p className="mt-1 text-[13px] text-ink">{a.why}</p>
              </div>
              <p className="text-[12px] text-ink-muted">Checked at 06:30 IST after the usage sync.</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="button"
                  onClick={onReview}
                  className="ll-press inline-flex h-[28px] items-center gap-1.5 rounded bg-accent px-2.5 text-[12px] font-medium text-bg-raised shadow-bevel hover:bg-accent-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                >
                  <Check size={12} aria-hidden /> Mark reviewed
                </button>
                <span className="min-w-0 truncate text-[12px] text-ink-faint" title={`Opens /accounts/${a.slug} in the demo`}>
                  Opens <span className="font-mono text-[11px]">/accounts/{a.slug}</span> in the demo
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sparkline({ points, className = "" }: { points: number[]; className?: string }) {
  const w = 56;
  const h = 18;
  const max = Math.max(...points);
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${(i * step).toFixed(1)},${(h - 1 - (p / max) * (h - 2)).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
