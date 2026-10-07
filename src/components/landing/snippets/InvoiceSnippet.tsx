"use client";

// One month's invoice for one account: billable lines, excluded lines
// (sandbox, unpriced), GST and the draft → final → issued lifecycle.

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, FilePen, FlaskConical, Lock, TriangleAlert } from "lucide-react";
import { Label, Num, Snippet, inr, useInView } from "@/components/landing/ui";

type Status = "draft" | "final" | "issued";

type Line = {
  id: string;
  code: string;
  name: string;
  hits: number;
  rate: number;
  tag?: "Manual" | "Sandbox";
  note?: string;
};

const BILLABLE: Line[] = [
  { id: "ky1001", code: "KY1001", name: "PAN Verification", hits: 48_210, rate: 3.2 },
  { id: "bv3001", code: "BV3001", name: "Penny Drop", hits: 21_940, rate: 3.0 },
  { id: "fr5002", code: "FR5002", name: "Mobile Risk Score", hits: 9_875, rate: 2.5, note: "Tier · first bracket" },
  { id: "manual", code: "KY1001", name: "Offline bulk run (approved)", hits: 2_000, rate: 3.2, tag: "Manual" },
];
const SANDBOX: Line = {
  id: "sandbox",
  code: "KY1002",
  name: "Aadhaar OTP Verification",
  hits: 3_400,
  rate: 2.0,
  tag: "Sandbox",
};
const UNPRICED = { code: "IN4004", name: "Bank Statement Analysis", hits: 612 };

const GST = 0.18;

/** Rupees with paise, Indian grouping: ₹1,54,272.00. */
function inr2(n: number) {
  const paise = Math.round(n * 100);
  return `${inr(Math.floor(paise / 100))}.${String(paise % 100).padStart(2, "0")}`;
}
const count = (n: number) => n.toLocaleString("en-IN");

const STATUS = {
  draft: { label: "Draft", Icon: FilePen, cls: "border-border bg-bg-sunken text-ink-muted" },
  final: { label: "Final", Icon: Lock, cls: "border-border bg-info-bg text-info-ink" },
  issued: { label: "Issued", Icon: CheckCircle2, cls: "border-border bg-success-bg text-success-ink" },
} as const;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function InvoiceSnippet() {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [status, setStatus] = useState<Status>("draft");
  const [sandbox, setSandbox] = useState(false);
  const locked = status !== "draft";

  const lines = sandbox ? [...BILLABLE, SANDBOX] : BILLABLE;
  const subtotal = lines.reduce((s, l) => s + l.hits * l.rate, 0);
  const gst = Math.round(subtotal * GST * 100) / 100;
  const totalAmt = subtotal + gst;

  const layoutT = reduce ? { duration: 0 } : { type: "spring" as const, bounce: 0, duration: 0.35 };
  const blur = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, filter: "blur(2px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
        exit: { opacity: 0, filter: "blur(2px)" },
      };
  const pill = STATUS[status];

  // First-view stagger. Rows mount hidden and rise in once; later remounts
  // (the sandbox line moving lists) skip it.
  const rowMotion = (i: number) => ({
    initial: inView ? (false as const) : { opacity: 0, y: reduce ? 0 : 6 },
    animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 6 },
    transition: {
      layout: layoutT,
      default: { duration: 0.3, ease: EASE_OUT, delay: i * 0.05 },
    },
  });

  return (
    <div ref={ref}>
      <Snippet
        path="accounts / orbit-cards / invoices / sep-2026"
        right={
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status}
              {...blur}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className={`inline-flex h-[24px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium ${pill.cls}`}
            >
              <pill.Icon className="h-3 w-3" aria-hidden />
              {pill.label}
            </motion.span>
          </AnimatePresence>
        }
      >
        <div className="p-4 text-[13px] sm:p-5">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div>
              <Label>Invoice</Label>
              <div className="mt-1 font-medium text-ink">Orbit Cards · Sep 2026</div>
            </div>
            <div className="min-h-[36px] text-left sm:text-right">
              <Label>Number</Label>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={locked ? "num" : "none"}
                  {...blur}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className={`mt-1 font-mono text-[12px] ${locked ? "text-ink" : "text-ink-faint"}`}
                >
                  {locked ? "LL-2026-0042" : "Assigned on finalize"}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <LayoutGroup>
            {/* Billable lines */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <Label>Billable lines</Label>
                <span
                  className="inline-flex items-center gap-1 text-[11px] text-ink-faint transition-opacity duration-200"
                  style={{ opacity: locked ? 1 : 0 }}
                  aria-hidden={!locked}
                >
                  <Lock className="h-3 w-3" aria-hidden />
                  Locked
                </span>
              </div>
              <div className="mt-1.5 hidden grid-cols-[1fr_72px_56px_104px] gap-x-3 border-b border-border pb-1.5 sm:grid">
                <Label>API</Label>
                <Label className="text-right">Hits</Label>
                <Label className="text-right">Rate</Label>
                <Label className="text-right">Amount</Label>
              </div>
              <div className="border-t border-border sm:border-t-0">
                {lines.map((l, i) => (
                  <motion.div key={l.id} layoutId={l.id} {...rowMotion(i)}>
                    <LineRow line={l} />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Excluded lines */}
            <div className="mt-4">
              <Label>Not billed</Label>
              <div className="mt-1.5 border-t border-border">
                {!sandbox && (
                  <motion.div key={SANDBOX.id} layoutId={SANDBOX.id} {...rowMotion(4)}>
                    <LineRow line={SANDBOX} excluded />
                  </motion.div>
                )}
                <motion.div layout {...rowMotion(5)}>
                  <div className="border-b border-border py-2 text-[12px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-ink-muted" title={`${UNPRICED.code} ${UNPRICED.name}`}>
                        <span className="font-mono text-ink-faint">{UNPRICED.code}</span> {UNPRICED.name}
                      </span>
                      <span className="shrink-0 font-mono text-ink-faint">{count(UNPRICED.hits)} hits</span>
                    </div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-warn-ink">
                      <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
                      No price set — excluded and flagged in Unpriced
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Sandbox switch */}
            <motion.div layout transition={{ layout: layoutT }} className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="ll-inv-sandbox" className={`text-[12px] ${locked ? "text-ink-faint" : "text-ink"}`}>
                  Include sandbox
                </label>
                <button
                  id="ll-inv-sandbox"
                  type="button"
                  role="switch"
                  aria-checked={sandbox}
                  disabled={locked}
                  aria-describedby="ll-inv-sandbox-note"
                  onClick={() => setSandbox((s) => !s)}
                  className={`ll-press relative h-[20px] w-[34px] shrink-0 rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                    sandbox ? "border-accent bg-accent" : "border-border-strong bg-bg-sunken"
                  }`}
                >
                  <span
                    className="absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-full bg-bg-raised shadow-low"
                    style={{
                      transform: sandbox ? "translateX(14px)" : "none",
                      transition: reduce ? "none" : "transform 200ms var(--ll-ease-out)",
                    }}
                  />
                </button>
              </div>
              <p id="ll-inv-sandbox-note" className="mt-1 min-h-[18px] text-[12px] text-ink-faint">
                {locked ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden />
                    Final invoices are locked; add an adjustment instead
                  </span>
                ) : sandbox ? (
                  "Sandbox hits count at ₹2.00."
                ) : (
                  "Sandbox hits are not billed unless you include them."
                )}
              </p>
            </motion.div>

            {/* Summary */}
            <motion.div
              layout
              transition={{ layout: layoutT }}
              aria-live="polite"
              className="mt-3 border-t border-border pt-3 font-mono text-[12px]"
            >
              <div className="flex justify-between gap-3 py-0.5 text-ink-muted">
                <span className="font-sans">Subtotal</span>
                <Num value={subtotal} format={inr2} />
              </div>
              <div className="flex justify-between gap-3 py-0.5 text-ink-muted">
                <span className="font-sans">GST 18%</span>
                <Num value={gst} format={inr2} />
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-2 text-ink">
                <span className="font-sans text-[13px] font-medium">Total</span>
                <Num value={totalAmt} format={inr2} className="font-display text-[20px] tracking-display" />
              </div>
            </motion.div>

            {/* Lifecycle */}
            <motion.div
              layout
              transition={{ layout: layoutT }}
              className="mt-4 flex min-h-[32px] flex-wrap items-center justify-between gap-2"
            >
              <div className="text-[12px] text-ink-muted" aria-live="polite">
                {status === "issued" ? (
                  <span className="inline-flex items-center gap-1 text-success-ink">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Issued 1 Oct 2026
                  </span>
                ) : status === "final" ? (
                  "Finalized. Ready to issue."
                ) : (
                  "Draft. Totals update with usage."
                )}
              </div>
              <div className="flex items-center gap-2">
                {locked && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("draft");
                    }}
                    className="ll-press h-[30px] rounded-sm px-2 text-[12px] text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Reset
                  </button>
                )}
                {status === "draft" && (
                  <button
                    type="button"
                    onClick={() => setStatus("final")}
                    className="ll-press inline-flex h-[30px] items-center gap-1.5 rounded bg-accent px-3 text-[12px] font-medium text-bg-raised shadow-bevel hover:bg-accent-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  >
                    <Lock className="h-3 w-3" aria-hidden />
                    Finalize
                  </button>
                )}
                {status === "final" && (
                  <button
                    type="button"
                    onClick={() => setStatus("issued")}
                    className="ll-press inline-flex h-[30px] items-center gap-1.5 rounded bg-accent px-3 text-[12px] font-medium text-bg-raised shadow-bevel hover:bg-accent-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  >
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Issue
                  </button>
                )}
              </div>
            </motion.div>
          </LayoutGroup>
        </div>
      </Snippet>
    </div>
  );
}

/** One invoice line. Wide: a table row. Narrow: name above, numbers below. */
function LineRow({ line, excluded }: { line: Line; excluded?: boolean }) {
  const amount = line.hits * line.rate;
  const full = `${line.code} ${line.name}${excluded ? " (not billed)" : ""}`;
  return (
    <div className="border-b border-border py-2 text-[12px] sm:grid sm:grid-cols-[1fr_72px_56px_104px] sm:items-baseline sm:gap-x-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`min-w-0 truncate ${excluded ? "text-ink-muted" : "text-ink"}`} title={full}>
          <span className="font-mono text-ink-faint">{line.code}</span> {line.name}
        </span>
        {line.tag === "Manual" && (
          <span className="shrink-0 rounded-sm border border-border bg-bg-sunken px-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
            Manual
          </span>
        )}
        {line.tag === "Sandbox" && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm border border-border bg-bg-sunken px-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
            <FlaskConical className="h-2.5 w-2.5" aria-hidden />
            Sandbox
          </span>
        )}
        {line.note && <span className="hidden shrink-0 text-[11px] text-ink-faint sm:inline">{line.note}</span>}
      </div>
      {/* Narrow layout: numbers on their own line. */}
      <div className="mt-0.5 flex items-baseline justify-between gap-3 font-mono text-ink-muted sm:hidden">
        <span>
          {count(line.hits)} × ₹{line.rate.toFixed(2)}
        </span>
        <span className={excluded ? "text-ink-faint" : "text-ink"}>{excluded ? "excluded" : inr2(amount)}</span>
      </div>
      <span className="hidden text-right font-mono text-ink-muted sm:block">{count(line.hits)}</span>
      <span className="hidden text-right font-mono text-ink-muted sm:block">₹{line.rate.toFixed(2)}</span>
      <span className={`hidden text-right font-mono sm:block ${excluded ? "text-ink-faint" : "text-ink"}`}>
        {excluded ? "excluded" : inr2(amount)}
      </span>
    </div>
  );
}
