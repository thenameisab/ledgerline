"use client";

// Pricing models on one API: flat, tier (graduated), slab (whole-volume) and
// bundle. Move the volume and the bracket ladder, rows and total follow.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, CalendarDays, Equal, Package } from "lucide-react";
import { Label, Num, Segmented, Snippet, inr, useInView } from "@/components/landing/ui";

type Mode = "flat" | "tier" | "slab" | "bundle";

const MODES: { value: Mode; label: string }[] = [
  { value: "flat", label: "Flat" },
  { value: "tier", label: "Tiered" },
  { value: "slab", label: "Slab" },
  { value: "bundle", label: "Bundle" },
];

const AXIS_MAX = 200_000;
const FLAT_RATE = 3.5;
const BRACKETS = [
  { lo: 0, hi: 25_000, rate: 4.0, name: "0 – 25,000", fill: "bg-viz-1" },
  { lo: 25_000, hi: 100_000, rate: 3.2, name: "25,000 – 1,00,000", fill: "bg-viz-2" },
  { lo: 100_000, hi: Infinity, rate: 2.6, name: "1,00,000+", fill: "bg-viz-3" },
];

const BUNDLE_RATE = 14;
const BUNDLE_MEMBERS = [
  { code: "KY1001", name: "PAN Verification", list: 4 },
  { code: "BV3001", name: "Bank Account Verification (Penny Drop)", list: 3 },
  { code: "FR5001", name: "Credit Bureau Pull", list: 12 },
];
const BUNDLE_LIST = BUNDLE_MEMBERS.reduce((s, m) => s + m.list, 0); // ₹19.00

const rupee2 = (n: number) => `₹${n.toFixed(2)}`;
const count = (n: number) => Math.round(n).toLocaleString("en-IN");

/** Hits that fall inside one bracket at a given volume. */
function hitsIn(v: number, b: (typeof BRACKETS)[number]) {
  return Math.max(0, Math.min(v, b.hi) - b.lo);
}

function slabIndex(v: number) {
  // The bracket the total lands in. 25,000 exactly stays in the first bracket.
  return BRACKETS.findIndex((b) => v <= b.hi || b.hi === Infinity);
}

function total(mode: Mode, v: number) {
  if (mode === "flat") return v * FLAT_RATE;
  if (mode === "tier") return BRACKETS.reduce((s, b) => s + hitsIn(v, b) * b.rate, 0);
  if (mode === "slab") return v * BRACKETS[slabIndex(v)].rate;
  return v * BUNDLE_RATE;
}

export function PricingSnippet() {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [mode, setMode] = useState<Mode>("tier");
  const [v, setV] = useState(64_000);
  const [touched, setTouched] = useState(false);

  // Autoplay: sweep the slider slowly between ~20k and ~150k until the user
  // interacts. Pauses while the tab is hidden; never runs with reduced motion.
  const startV = useRef(v);
  useEffect(() => {
    if (!inView || touched || reduce) return;
    let raf = 0;
    let last = performance.now();
    // Start the phase where the current value already sits, so there is no jump.
    const lo = 20_000;
    const hi = 150_000;
    const clamp = Math.min(Math.max(startV.current, lo), hi);
    let phase = Math.acos(1 - (2 * (clamp - lo)) / (hi - lo));
    const PERIOD = 14_000; // ms for one full sweep up and back
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      if (!document.hidden) {
        phase += (dt / PERIOD) * Math.PI * 2;
        const next = lo + ((hi - lo) * (1 - Math.cos(phase))) / 2;
        const stepped = Math.round(next / 1000) * 1000;
        startV.current = stepped;
        setV(stepped);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, touched, reduce]);

  const stop = () => setTouched(true);

  const isBundle = mode === "bundle";
  const amount = total(mode, v);
  const flatAmount = total("flat", v);
  const listAmount = v * BUNDLE_LIST;
  const effective = v > 0 ? amount / v : mode === "flat" ? FLAT_RATE : mode === "bundle" ? BUNDLE_RATE : BRACKETS[0].rate;
  const compareTo = isBundle ? listAmount : flatAmount;
  const diff = amount - compareTo;
  const compareName = isBundle ? "list prices" : "flat";
  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, filter: "blur(2px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
        exit: { opacity: 0, filter: "blur(2px)" },
      };

  return (
    <div ref={ref} onPointerDown={stop} onKeyDown={stop} onFocus={stop}>
      <Snippet
        path="accounts / acme-lending-co / pricing / KY1001"
        right={<Segmented size="sm" label="Pricing model" options={MODES} value={mode} onChange={setMode} />}
      >
        <div className="p-4 text-[13px] sm:p-5">
          {/* Heading */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Label>{isBundle ? "Bundle" : "API"}</Label>
              <div className="mt-1 truncate font-medium text-ink" title={isBundle ? "KYC Prefill bundle" : "KY1001 PAN Verification"}>
                {isBundle ? "KYC Prefill bundle" : (
                  <>
                    <span className="font-mono text-[12px] text-ink-muted">KY1001</span> PAN Verification
                  </>
                )}
              </div>
            </div>
            <span className="inline-flex h-[24px] items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 text-[12px] text-ink-muted">
              <CalendarDays className="h-3 w-3" aria-hidden />
              Effective from 1 Oct 2026
            </span>
          </div>

          {/* Volume */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="ll-pricing-volume" className="text-[12px] text-ink-muted">
                {isBundle ? "Monthly journeys" : "Monthly hits"}
              </label>
              <span className="font-mono text-[12px] text-ink">
                {count(v)}
              </span>
            </div>
            <input
              id="ll-pricing-volume"
              type="range"
              min={0}
              max={AXIS_MAX}
              step={1000}
              value={v}
              onChange={(e) => {
                setTouched(true);
                setV(Number(e.target.value));
              }}
              aria-valuetext={`${count(v)} ${isBundle ? "journeys" : "hits"} per month`}
              className="ll-range mt-1"
              style={{ "--fill": `${(v / AXIS_MAX) * 100}%` } as React.CSSProperties}
            />
          </div>

          {/* Mode body. Fixed min-height so the card does not jump between modes. */}
          <div className="mt-3 min-h-[236px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isBundle ? "bundle" : "ladder"}
                {...swap}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                {isBundle ? <BundleBody v={v} /> : <LadderBody mode={mode} v={v} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Readout */}
          <div
            aria-live="polite"
            className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto_auto]"
          >
            <div>
              <Label>{isBundle ? "Bundle line this month" : "Monthly total"}</Label>
              <div className="mt-1 font-display text-[26px] leading-none tracking-display text-ink">
                <Num value={amount} format={inr} />
              </div>
            </div>
            <div>
              <Label>{isBundle ? "Per journey" : "Effective rate"}</Label>
              <div className="mt-1 font-mono text-[13px] text-ink">
                <Num value={effective} format={rupee2} />
                <span className="text-ink-faint"> / {isBundle ? "journey" : "hit"}</span>
              </div>
            </div>
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <Label>{isBundle ? "vs list prices" : "vs flat ₹3.50"}</Label>
              <div className="mt-1 text-[13px]">
                {mode === "flat" ? (
                  <span className="inline-flex items-center gap-1 text-ink-muted">
                    <Equal className="h-3.5 w-3.5" aria-hidden />
                    This is the flat rate
                  </span>
                ) : Math.round(diff) === 0 ? (
                  <span className="inline-flex items-center gap-1 text-ink-muted">
                    <Equal className="h-3.5 w-3.5" aria-hidden />
                    Same as {compareName}
                  </span>
                ) : diff < 0 ? (
                  <span className="inline-flex items-center gap-1 text-ok-ink">
                    <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      <Num value={-diff} format={inr} /> less than {compareName}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-warn-ink">
                    <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      <Num value={diff} format={inr} /> more than {compareName}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Snippet>
    </div>
  );
}

/** Bracket ladder on a 0–200k axis plus the bracket rows. */
function LadderBody({ mode, v }: { mode: Exclude<Mode, "bundle">; v: number }) {
  const slab = slabIndex(v);
  const pct = (n: number) => `${(Math.min(n, AXIS_MAX) / AXIS_MAX) * 100}%`;
  const summary =
    mode === "flat"
      ? `Flat rate: all ${count(v)} hits at ₹3.50.`
      : mode === "slab"
        ? `Slab: ${count(v)} hits land in bracket ${BRACKETS[slab].name}, so all hits use ₹${BRACKETS[slab].rate.toFixed(2)}.`
        : `Tiered: ${BRACKETS.map((b) => `${count(hitsIn(v, b))} hits at ₹${b.rate.toFixed(2)}`).join(", ")}.`;

  return (
    <div>
      {/* Rate labels above each segment (wide screens; rows below carry the same data). */}
      <div className="relative hidden h-[30px] sm:block" aria-hidden>
        {mode === "flat" ? (
          <div className="absolute bottom-1 left-0 font-mono text-[10.5px] text-ink-muted">₹3.50 on every hit</div>
        ) : (
          BRACKETS.map((b, i) => {
            const used = mode === "tier" ? hitsIn(v, b) > 0 : i === slab;
            const sub = mode === "tier" ? hitsIn(v, b) * b.rate : i === slab ? v * b.rate : 0;
            return (
              <div
                key={b.lo}
                className="absolute bottom-1 pl-1 font-mono text-[10.5px] leading-tight transition-opacity duration-200"
                style={{ left: pct(b.lo), opacity: used ? 1 : 0.45 }}
              >
                <div className="text-ink">₹{b.rate.toFixed(2)}</div>
                <div className="text-ink-faint">{used ? inr(sub) : "—"}</div>
              </div>
            );
          })
        )}
      </div>

      <div role="img" aria-label={summary} className="relative h-[22px] overflow-hidden rounded-sm bg-bg-sunken">
        {BRACKETS.map((b, i) => {
          const hi = Math.min(b.hi, AXIS_MAX);
          const share = Math.max(0, Math.min(1, (v - b.lo) / (hi - b.lo)));
          const active = mode === "slab" && i === slab;
          const fillClass = mode === "tier" ? b.fill : "bg-accent";
          // Slab: fill shows volume, the landing bracket gets an outline.
          const opacity = mode === "slab" && !active ? 0.35 : 1;
          return (
            <div
              key={b.lo}
              className="absolute inset-y-0"
              style={{ left: pct(b.lo), width: `${((hi - b.lo) / AXIS_MAX) * 100}%` }}
            >
              <div
                className={`absolute inset-0 origin-left transition-[opacity,background-color] duration-200 ${fillClass}`}
                // Transform has no transition: the fill follows the slider 1:1.
                style={{ transform: `scaleX(${share})`, opacity }}
              />
              <div
                className="absolute inset-0 rounded-sm transition-opacity duration-200"
                style={{ boxShadow: "inset 0 0 0 1.5px var(--color-ink)", opacity: active ? 1 : 0 }}
              />
              {i > 0 && <div className="absolute inset-y-0 left-0 w-px bg-bg-raised" />}
            </div>
          );
        })}
      </div>

      <div className="relative mt-1 h-[14px] font-mono text-[10px] text-ink-faint" aria-hidden>
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: "12.5%" }}>25k</span>
        <span className="absolute -translate-x-1/2" style={{ left: "50%" }}>100k</span>
        <span className="absolute right-0">200k</span>
      </div>

      {/* Rows */}
      <div className="mt-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-border pb-1.5 sm:grid-cols-[1fr_88px_64px_96px]">
          <Label>Bracket</Label>
          <Label className="hidden text-right sm:block">Hits</Label>
          <Label className="text-right">Rate</Label>
          <Label className="text-right">Amount</Label>
        </div>
        {mode === "flat" ? (
          <Row name="All hits" hits={v} rate={FLAT_RATE} amount={v * FLAT_RATE} />
        ) : (
          BRACKETS.map((b, i) => {
            if (mode === "tier") {
              const h = hitsIn(v, b);
              return <Row key={b.lo} name={b.name} hits={h} rate={b.rate} amount={h * b.rate} muted={h === 0} />;
            }
            return i === slab ? (
              <Row key={b.lo} name={`${b.name} · all hits`} hits={v} rate={b.rate} amount={v * b.rate} highlight />
            ) : (
              <Row key={b.lo} name={b.name} rate={b.rate} note="not used" muted />
            );
          })
        )}
      </div>
    </div>
  );
}

function Row({
  name,
  hits,
  rate,
  amount,
  note,
  muted,
  highlight,
}: {
  name: string;
  hits?: number;
  rate: number;
  amount?: number;
  note?: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-b border-border py-1.5 text-[12px] transition-colors duration-200 sm:grid-cols-[1fr_88px_64px_96px] ${
        muted ? "text-ink-faint" : "text-ink"
      } ${highlight ? "font-medium" : ""}`}
    >
      <span className="min-w-0 truncate" title={hits !== undefined ? `${name} · ${count(hits)} hits` : name}>
        {name}
        {hits !== undefined && (
          <span className="text-ink-faint sm:hidden"> · {count(hits)}</span>
        )}
      </span>
      <span className="hidden text-right font-mono sm:block">
        {hits !== undefined ? count(hits) : "—"}
      </span>
      <span className="text-right font-mono">₹{rate.toFixed(2)}</span>
      <span className="text-right font-mono">
        {note ? note : inr(amount ?? 0)}
      </span>
    </div>
  );
}

/** Bundle: three APIs billed as one line at one agreed price per journey. */
function BundleBody({ v }: { v: number }) {
  return (
    <div>
      <div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-border pb-1.5 sm:grid-cols-[1fr_64px_120px]">
          <Label>Member API</Label>
          <Label className="text-right">List</Label>
          <Label className="text-right">Billed as</Label>
        </div>
        {BUNDLE_MEMBERS.map((m) => (
          <div
            key={m.code}
            className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-b border-border py-1.5 text-[12px] text-ink-muted sm:grid-cols-[1fr_64px_120px]"
          >
            <span className="min-w-0 truncate" title={`${m.code} ${m.name}`}>
              <span className="font-mono text-ink-faint">{m.code}</span> {m.name}
            </span>
            <span className="text-right font-mono">₹{m.list.toFixed(2)}</span>
            <span className="text-right text-ink-faint">bundle line</span>
          </div>
        ))}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-border py-1.5 text-[12px] text-ink-faint">
          <span>List price per journey</span>
          <span className="text-right font-mono">₹4.00 + ₹3.00 + ₹12.00 = ₹{BUNDLE_LIST.toFixed(2)}</span>
        </div>
      </div>

      <Label className="mt-3 flex items-center gap-1.5">
        <Package className="h-3 w-3" aria-hidden />
        Invoice line
      </Label>
      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-sm border border-border bg-bg px-3 py-2 text-[12px]">
        <span className="font-medium text-ink">KYC Prefill bundle</span>
        <span className="font-mono text-ink">
          {count(v)} × ₹14.00 = {inr(v * BUNDLE_RATE)}
        </span>
      </div>
      <p className="mt-2 text-[12px] text-ink-faint">Members are billed only through the bundle line.</p>
    </div>
  );
}
