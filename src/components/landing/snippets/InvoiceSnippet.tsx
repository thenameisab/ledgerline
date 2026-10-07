"use client";

// One month's invoice for one account: SKUs with different units on one
// invoice, excluded lines (sandbox, unpriced) and the draft → final → issued
// lifecycle.

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, FilePen, FlaskConical, Lock, TriangleAlert } from "lucide-react";
import { Label, Num, Snippet, usd, usdPrice, useInView } from "@/components/landing/ui";

type Status = "draft" | "final" | "issued";

type Line = {
  id: string;
  code: string;
  name: string;
  /** Quantity in the SKU's own unit. */
  hits: number;
  /** Short unit label shown after the quantity. */
  unit: string;
  rate: number;
  tag?: "Manual" | "Sandbox";
  note?: string;
};

const BILLABLE: Line[] = [
  { id: "atl-pro-out", code: "ATL-PRO-OUT", name: "Atlas Pro · output tokens", hits: 2_610, unit: "M tok", rate: 14.25 },
  { id: "prm-vid", code: "PRM-VID-1080", name: "Prism Video · 1080p", hits: 41_800, unit: "sec", rate: 0.24 },
  { id: "vox-tts", code: "VOX-TTS", name: "Text-to-speech", hits: 286_400, unit: "K chars", rate: 0.014 },
  { id: "gpu-h100", code: "GPU-H100", name: "H100 GPU · on-demand", hits: 2_880, unit: "GPU-h", rate: 2.29, note: "Tier · second bracket" },
  { id: "manual", code: "PRM-IMG-HD", name: "Offline batch render (approved)", hits: 12_000, unit: "img", rate: 0.075, tag: "Manual" },
];
const SANDBOX: Line = {
  id: "sandbox",
  code: "VOX-CLONE",
  name: "Voice cloning",
  hits: 140,
  unit: "voices",
  rate: 1.5,
  tag: "Sandbox",
};
const UNPRICED = { code: "AGT-BROWSER", name: "Browser agent", hits: 6_120, unit: "browser-min" };

/** Dollars with cents: $58,729.30. */
function usd2(n: number) {
  const cents = Math.round(n * 100);
  return `${usd(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, "0")}`;
}
const count = (n: number) => n.toLocaleString("en-US");

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
  const totalAmt = lines.reduce((s, l) => s + l.hits * l.rate, 0);
  const units = new Set(lines.map((l) => l.unit)).size;

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
        path="accounts / quillmark-studio / invoices / sep-2026"
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
              <div className="mt-1 font-medium text-ink">Quillmark Studio · Sep 2026</div>
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
              <div className="mt-1.5 hidden grid-cols-[1fr_112px_64px_96px] gap-x-3 border-b border-border pb-1.5 sm:grid">
                <Label>SKU</Label>
                <Label className="text-right">Quantity</Label>
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
                      <span className="shrink-0 font-mono text-ink-faint">
                        {count(UNPRICED.hits)} {UNPRICED.unit}
                      </span>
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
                  "Sandbox usage counts at $1.50 per voice."
                ) : (
                  "Sandbox usage is not billed unless you include it."
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
                <span className="font-sans">Lines</span>
                <span>
                  {lines.length} SKUs · {units} units of measure
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-2 text-ink">
                <span className="font-sans text-[13px] font-medium">Total</span>
                <Num value={totalAmt} format={usd2} className="font-display text-[20px] tracking-display" />
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
    <div className="border-b border-border py-2 text-[12px] sm:grid sm:grid-cols-[1fr_112px_64px_96px] sm:items-baseline sm:gap-x-3">
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
          {count(line.hits)} {line.unit} × {usdPrice(line.rate)}
        </span>
        <span className={excluded ? "text-ink-faint" : "text-ink"}>{excluded ? "excluded" : usd2(amount)}</span>
      </div>
      <span className="hidden truncate text-right font-mono text-ink-muted sm:block" title={`${count(line.hits)} ${line.unit}`}>
        {count(line.hits)} <span className="text-ink-faint">{line.unit}</span>
      </span>
      <span className="hidden text-right font-mono text-ink-muted sm:block">{usdPrice(line.rate)}</span>
      <span className={`hidden text-right font-mono sm:block ${excluded ? "text-ink-faint" : "text-ink"}`}>
        {excluded ? "excluded" : usd2(amount)}
      </span>
    </div>
  );
}
