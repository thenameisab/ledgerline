"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, TriangleAlert, Undo2 } from "lucide-react";
import { Label, Num, Segmented, Snippet, inr, useInView } from "@/components/landing/ui";

type View = "margin" | "reconcile";

// Margin view data (fictional). Cost on estimated hits comes from a quoted rate.
const REVENUE = 310_610;
const COST_CONFIRMED = 113_140;
const COST_ESTIMATED = 30_140;
const TARGET = 45;
const COVERAGE = [
  { key: "confirmed", label: "Confirmed", pct: 64, note: "rate card set", cls: "bg-ok" },
  { key: "estimated", label: "Estimated", pct: 21, note: "from a quoted rate", cls: "bg-warn" },
  { key: "unknown", label: "Unknown", pct: 15, note: "no vendor rate", cls: "bg-border-strong" },
] as const;

// Reconcile view data: FR5001 Credit Bureau Pull, our count vs DataBridge's count.
const DAYS: { day: number; ours: number; theirs: number }[] = [
  { day: 17, ours: 10_240, theirs: 10_221 },
  { day: 18, ours: 11_086, theirs: 11_104 },
  { day: 19, ours: 8_412, theirs: 8_409 },
  { day: 20, ours: 8_105, theirs: 8_098 },
  { day: 21, ours: 10_412, theirs: 9_880 },
  { day: 22, ours: 11_530, theirs: 11_512 },
  { day: 23, ours: 11_804, theirs: 11_790 },
  { day: 24, ours: 11_362, theirs: 11_377 },
  { day: 25, ours: 0, theirs: 11_204 },
  { day: 26, ours: 8_690, theirs: 8_682 },
  { day: 27, ours: 8_233, theirs: 8_240 },
  { day: 28, ours: 9_950, theirs: 10_310 },
  { day: 29, ours: 11_620, theirs: 11_601 },
  { day: 30, ours: 11_948, theirs: 11_962 },
];
const MAX = 12_000;
const REASONS = ["Vendor restated late", "Known outage", "Sandbox traffic"];

const diffOf = (d: (typeof DAYS)[number]) => d.theirs - d.ours;
const pctOf = (d: (typeof DAYS)[number]) => (d.ours === 0 ? 100 : (Math.abs(diffOf(d)) / d.ours) * 100);
const isGap = (d: (typeof DAYS)[number]) => pctOf(d) > 0.5;
const GAP_INDEXES = DAYS.map((d, i) => (isGap(d) ? i : -1)).filter((i) => i >= 0);
const fmt = (n: number) => n.toLocaleString("en-IN");
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0");

export function MarginSnippet() {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [view, setView] = useState<View>("margin");
  const [selected, setSelected] = useState(GAP_INDEXES[0]);
  const [touched, setTouched] = useState(false);
  const [countEstimated, setCountEstimated] = useState(true);
  const [dismissed, setDismissed] = useState<Record<number, string>>({});
  const touch = () => setTouched(true);

  // Self-demo: show the margin view, then switch to Reconcile and step through the gap days.
  const tick = useRef(0);
  useEffect(() => {
    if (!inView || touched || reduce) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      tick.current += 1;
      if (tick.current < 3) return;
      if (tick.current === 3) {
        setView("reconcile");
        return;
      }
      setSelected(GAP_INDEXES[(tick.current - 4) % GAP_INDEXES.length]);
    }, 2200);
    return () => window.clearInterval(id);
  }, [inView, touched, reduce]);

  return (
    <div ref={ref} onPointerDownCapture={touch} onKeyDownCapture={touch} onFocusCapture={touch}>
      <Snippet
        path="vendors / databridge / reconciliation"
        right={
          <Segmented<View>
            size="sm"
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "margin", label: "Margin" },
              { value: "reconcile", label: "Reconcile" },
            ]}
          />
        }
      >
        <div className="relative min-h-[468px] sm:min-h-[420px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            >
              {view === "margin" ? (
                <MarginView reduce={!!reduce} countEstimated={countEstimated} setCountEstimated={setCountEstimated} />
              ) : (
                <ReconcileView
                  selected={selected}
                  setSelected={setSelected}
                  onHover={touch}
                  dismissed={dismissed}
                  setDismissed={setDismissed}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Snippet>
    </div>
  );
}

function MarginView({
  reduce,
  countEstimated,
  setCountEstimated,
}: {
  reduce: boolean;
  countEstimated: boolean;
  setCountEstimated: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const cost = COST_CONFIRMED + (countEstimated ? COST_ESTIMATED : 0);
  const margin = REVENUE - cost;
  const pct = (margin / REVENUE) * 100;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <div className="text-[12px] text-ink-muted">DataBridge · all accounts · Sep 2026</div>

      <div aria-live="polite" className="grid grid-cols-3 gap-3 border-b border-border pb-4">
        <Figure label="Revenue" title={inr(REVENUE)}>
          <Num value={REVENUE} format={inr} />
        </Figure>
        <Figure label="Vendor cost" title={inr(cost)}>
          <Num value={cost} format={inr} />
        </Figure>
        <Figure label="Margin" title={inr(margin)} strong>
          <Num value={margin} format={inr} />
        </Figure>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="text-[13px] text-ink">
            Margin <Num value={pct} format={(n) => `${n.toFixed(1)}%`} className="font-medium" />
            <span className="text-ink-muted">
              {countEstimated ? " on confirmed and estimated cost" : " on confirmed cost only"}
            </span>
          </div>
          <div className="text-[12px] text-ink-muted">Target {TARGET}%</div>
        </div>
        <div
          className="relative mt-2 h-[8px] rounded-full bg-bg-sunken"
          role="img"
          aria-label={`Margin ${pct.toFixed(1)}% against a ${TARGET}% target`}
        >
          <motion.div
            className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-accent"
            initial={false}
            animate={{ scaleX: pct / 100 }}
            transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.35 }}
          />
          <div
            className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-ink"
            style={{ left: `calc(${TARGET}% - 1px)` }}
            aria-hidden
          />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <Label>Cost coverage · share of hits</Label>
        </div>
        <div className="mt-2 flex h-[10px] gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {COVERAGE.map((c) => (
            <div
              key={c.key}
              className={`${c.cls} transition-opacity duration-200 ${
                c.key === "estimated" && !countEstimated ? "opacity-30" : "opacity-100"
              }`}
              style={{ width: `${c.pct}%` }}
            />
          ))}
        </div>
        <ul className="mt-3 grid gap-1.5 text-[12px] sm:grid-cols-3">
          {COVERAGE.map((c) => (
            <li key={c.key} className="flex items-start gap-2">
              <span className={`mt-[4px] h-2 w-2 shrink-0 rounded-sm ${c.cls}`} aria-hidden />
              <span>
                <span className="text-ink">
                  {c.label} <span className="tabular-nums">{c.pct}%</span>
                </span>
                <span className="text-ink-muted">
                  {" "}
                  · {c.note}
                  {c.key === "estimated" && !countEstimated ? ", not counted" : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={countEstimated}
        onClick={() => setCountEstimated((v) => !v)}
        className="ll-press flex w-fit items-center gap-2.5 rounded text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
      >
        <span
          className={`relative h-[18px] w-[30px] rounded-full border transition-colors duration-200 ${
            countEstimated ? "border-accent bg-accent" : "border-border-strong bg-bg-sunken"
          }`}
          aria-hidden
        >
          <span
            className="absolute left-[1px] top-[1px] h-[14px] w-[14px] rounded-full bg-bg-raised shadow-low"
            style={{
              transform: countEstimated ? "translateX(12px)" : "none",
              transition: reduce ? "none" : "transform 200ms var(--ll-ease-out)",
            }}
          />
        </span>
        Count estimated cost
      </button>

      <p className="text-[12px] text-ink-muted">Every margin figure states how much of the usage has a vendor rate.</p>
    </div>
  );
}

function Figure({
  label,
  title,
  strong,
  children,
}: {
  label: string;
  title: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div
        title={title}
        className={`mt-1 truncate font-display text-[13px] tracking-display sm:text-[20px] ${
          strong ? "text-accent-ink" : "text-ink"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ReconcileView({
  selected,
  setSelected,
  onHover,
  dismissed,
  setDismissed,
}: {
  selected: number;
  setSelected: (i: number) => void;
  onHover: () => void;
  dismissed: Record<number, string>;
  setDismissed: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const openGaps = GAP_INDEXES.filter((i) => !dismissed[i]).length;

  useEffect(() => {
    setFormOpen(false);
    setReason(REASONS[0]);
  }, [selected]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(DAYS.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(0, i - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = DAYS.length - 1;
    else return;
    e.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  };

  const d = DAYS[selected];
  const gap = isGap(d);
  const dismissedReason = dismissed[selected];
  const diff = diffOf(d);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink">FR5001 Credit Bureau Pull</div>
          <div className="text-[12px] text-ink-muted">Our hits vs DataBridge · 17–30 Sep 2026</div>
        </div>
        <div
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] ${
            openGaps ? "bg-warn-bg text-warn-ink" : "bg-ok-bg text-ok-ink"
          }`}
        >
          {openGaps ? <TriangleAlert size={12} aria-hidden /> : <Check size={12} aria-hidden />}
          <span>
            <Num value={openGaps} /> open {openGaps === 1 ? "gap" : "gaps"}
          </span>
        </div>
      </div>

      <div>
        <div
          role="group"
          aria-label="Daily hit counts, ours and DataBridge's. Use the arrow keys to move between days."
          className="grid h-[150px] grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-0.5"
        >
          {DAYS.map((day, i) => {
            const g = isGap(day);
            const open = g && !dismissed[i];
            const active = i === selected;
            const label = `${day.day} Sep: ours ${fmt(day.ours)}, DataBridge ${fmt(day.theirs)}${
              open ? ", gap" : g ? ", gap dismissed" : ", matches"
            }`;
            return (
              <button
                key={day.day}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                tabIndex={active ? 0 : -1}
                aria-label={label}
                aria-pressed={active}
                onClick={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") {
                    onHover();
                    setSelected(i);
                  }
                }}
                onKeyDown={(e) => onKey(e, i)}
                style={{ transitionProperty: "transform" }}
                className={`ll-press flex h-full flex-col items-center justify-end gap-1 rounded-sm pb-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active ? "bg-bg-sunken" : ""
                }`}
              >
                <span className="flex h-[14px] items-center" aria-hidden>
                  {open ? (
                    <TriangleAlert size={11} className="text-warn" />
                  ) : g ? (
                    <Check size={11} className="text-ok" />
                  ) : null}
                </span>
                <span className="flex h-[110px] items-end gap-[2px]" aria-hidden>
                  <span
                    className={`w-[4px] rounded-t-sm ${open ? "bg-warn" : "bg-accent"}`}
                    style={{ height: day.ours ? `${(day.ours / MAX) * 100}%` : "2px" }}
                  />
                  <span
                    className="w-[4px] rounded-t-sm bg-border-strong"
                    style={{ height: `${(day.theirs / MAX) * 100}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-1 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-0.5 font-mono text-[10px] text-ink-faint" aria-hidden>
          {DAYS.map((day) => (
            <span key={day.day} className="text-center tabular-nums">
              {day.day}
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-accent" aria-hidden /> Ours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-border-strong" aria-hidden /> DataBridge
          </span>
          <span className="flex items-center gap-1.5">
            <TriangleAlert size={11} className="text-warn" aria-hidden /> Gap over 0.5%
          </span>
        </div>
      </div>

      <div className="h-[132px] rounded border border-border bg-bg p-3" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[13px] font-medium text-ink">{d.day} Sep 2026</div>
          <Status gap={gap} dismissedReason={dismissedReason} ours={d.ours} />
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
          <Cell label="Ours" value={fmt(d.ours)} />
          <Cell label="DataBridge" value={fmt(d.theirs)} />
          <Cell
            label="Difference"
            value={d.ours === 0 ? signed(diff) : `${signed(diff)} · ${pctOf(d).toFixed(1)}%`}
          />
        </dl>
        <div className="mt-2.5 flex min-h-[28px] flex-wrap items-center gap-2">
          {gap && !dismissedReason && !formOpen && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="ll-press h-[28px] rounded border border-border bg-bg-raised px-2.5 text-[12px] text-ink outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-accent"
            >
              Dismiss with reason
            </button>
          )}
          {gap && !dismissedReason && formOpen && (
            <>
              <label className="sr-only" htmlFor="ll-recon-reason">
                Reason
              </label>
              <select
                id="ll-recon-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-[28px] min-w-0 rounded border border-border bg-bg-raised px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setDismissed((m) => ({ ...m, [selected]: reason }));
                  setFormOpen(false);
                }}
                className="ll-press h-[28px] rounded bg-accent px-2.5 text-[12px] font-medium text-bg-raised shadow-bevel hover:bg-accent-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="ll-press h-[28px] rounded px-2 text-[12px] text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
              >
                Cancel
              </button>
            </>
          )}
          {gap && dismissedReason && (
            <button
              type="button"
              onClick={() =>
                setDismissed((m) => {
                  const next = { ...m };
                  delete next[selected];
                  return next;
                })
              }
              className="ll-press inline-flex h-[28px] items-center gap-1.5 rounded border border-border bg-bg-raised px-2.5 text-[12px] text-ink outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Undo2 size={12} aria-hidden /> Undo
            </button>
          )}
          {!gap && <span className="text-[12px] text-ink-muted">Counts match within 0.5%.</span>}
        </div>
      </div>
    </div>
  );
}

function Status({ gap, dismissedReason, ours }: { gap: boolean; dismissedReason?: string; ours: number }) {
  if (!gap)
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-ok-ink">
        <Check size={12} aria-hidden /> Matched
      </span>
    );
  if (dismissedReason)
    return (
      <span className="inline-flex min-w-0 items-center gap-1 text-[12px] text-ok-ink" title={`Dismissed · ${dismissedReason}`}>
        <Check size={12} className="shrink-0" aria-hidden />
        <span className="truncate">Dismissed · {dismissedReason}</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-warn-ink">
      <TriangleAlert size={12} aria-hidden /> {ours === 0 ? "Missing on our side" : "Open gap"}
    </span>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="truncate tabular-nums text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}
