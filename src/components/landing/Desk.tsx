"use client";

// The hero desk: billing artifacts you can drag and flick. Framer's drag gives
// 1:1 tracking from the grab point, momentum on release, rubber-band edges and
// interruptible motion. Each piece tilts with its horizontal speed.
// The pieces are decorative; the same facts appear in the sections below.

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";

/* ── Artifacts ─────────────────────────────────────────────────────────── */

const mono = "font-mono uppercase tracking-[0.08em]";

function InvoiceSlip() {
  return (
    <div
      className="ll-perf-top w-[204px] rounded-b-[6px] px-4 pb-4 pt-5"
      style={{ background: "var(--a-cream)", color: "var(--a-cream-ink)" }}
    >
      <div className={`${mono} text-[9.5px] opacity-70`}>Invoice</div>
      <div className="mt-0.5 font-mono text-[15px] font-medium">LL-2026-0042</div>
      <div className="mt-2 text-[11.5px]">Orbit Cards · Sep 2026</div>
      <div className="my-2.5 border-t border-dashed" style={{ borderColor: "currentColor", opacity: 0.35 }} />
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="opacity-70">Total incl. GST</span>
        <span className="font-mono text-[13px] font-medium">₹2,96,391</span>
      </div>
      <div
        className={`${mono} absolute right-3 top-4 rotate-[10deg] rounded-[3px] border-[1.5px] px-1.5 py-0.5 text-[9px] font-semibold`}
        style={{ color: "#a4452b", borderColor: "#a4452b" }}
      >
        Final
      </div>
    </div>
  );
}

function PriceTag() {
  return (
    <div
      className="ll-tag relative flex h-[84px] w-[164px] flex-col justify-center pl-8 pr-4"
      style={{ background: "var(--a-sage)", color: "var(--a-sage-ink)" }}
    >
      <span
        className="absolute left-[14px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
        style={{ background: "var(--ll-paper)", boxShadow: "inset 0 1px 2px rgba(0,0,0,.25)" }}
      />
      <div className="font-display text-[26px] font-medium leading-none tracking-display">₹3.20</div>
      <div className={`${mono} mt-1.5 text-[9.5px] opacity-75`}>per hit · KY1001</div>
    </div>
  );
}

function Receipt() {
  const rows: [string, string, string][] = [
    ["KY1001", "×412", "1,318"],
    ["BV3001", "×238", "714"],
    ["FR5001", "×96", "1,152"],
  ];
  return (
    <div
      className="ll-zigzag w-[176px] px-3.5 pb-5 pt-3.5 font-mono"
      style={{ background: "var(--a-white)", color: "var(--a-white-ink)" }}
    >
      <div className={`${mono} text-center text-[9.5px] opacity-60`}>Usage · 06 Oct</div>
      <div className="mt-2 space-y-1 text-[10.5px]">
        {rows.map(([c, h, a]) => (
          <div key={c} className="flex justify-between gap-2">
            <span>{c}</span>
            <span className="opacity-60">{h}</span>
            <span>₹{a}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-dashed pt-1.5 text-[11px] font-medium" style={{ borderColor: "rgba(0,0,0,.25)" }}>
        <span>Total</span>
        <span>₹3,184</span>
      </div>
    </div>
  );
}

function StickyNote() {
  return (
    <div
      className="relative h-[138px] w-[150px] px-3.5 pb-3 pt-5"
      style={{ background: "var(--a-mustard)", color: "var(--a-mustard-ink)" }}
    >
      <span
        className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rotate-[-3deg]"
        style={{ background: "rgba(255,255,255,.55)", boxShadow: "0 1px 1px rgba(0,0,0,.06)" }}
      />
      <div className={`${mono} text-[9.5px] opacity-70`}>Alert · needs action</div>
      <div className="mt-1.5 text-[13px] font-medium leading-snug">Acme Lending Co</div>
      <div className="mt-1 text-[11.5px] leading-snug">PAN volume down 62% vs the 4-week baseline</div>
    </div>
  );
}

function Ticket() {
  return (
    <div
      className="ll-notch flex h-[88px] w-[224px] items-center gap-3 rounded-[8px] px-5"
      style={{ background: "var(--a-azure)", color: "var(--a-azure-ink)" }}
    >
      <div className="min-w-0">
        <div className={`${mono} text-[9.5px] opacity-80`}>Billing period</div>
        <div className="mt-1 font-mono text-[17px] font-medium">01 OCT → 31 OCT</div>
        <div className={`${mono} mt-1 text-[9.5px] opacity-80`}>Draft · day 6 of 31</div>
      </div>
    </div>
  );
}

function Seal() {
  // Scalloped edge: a circle with 18 bumps.
  const n = 18;
  const R = 54;
  const r = 6;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(`${(60 + R * Math.cos(a)).toFixed(2)},${(60 + R * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <div className="relative h-[120px] w-[120px]" style={{ color: "var(--a-lilac-ink)" }}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full" aria-hidden>
        {pts.map((p, i) => {
          const [x, y] = p.split(",").map(Number);
          return <circle key={i} cx={x} cy={y} r={r + 1} fill="var(--a-lilac)" />;
        })}
        <circle cx="60" cy="60" r={R} fill="var(--a-lilac)" />
        <circle cx="60" cy="60" r={R - 8} fill="none" stroke="currentColor" strokeOpacity=".25" strokeDasharray="2 3" />
      </svg>
      <div className="relative flex h-full flex-col items-center justify-center">
        <div className="font-display text-[22px] font-medium leading-none">53.9%</div>
        <div className={`${mono} mt-1 text-[9px] opacity-75`}>Margin</div>
      </div>
    </div>
  );
}

function Stamp() {
  return (
    <div
      className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full border-[2.5px] text-center"
      style={{ borderColor: "#a4452b", color: "#a4452b", background: "transparent", boxShadow: "inset 0 0 0 4px var(--ll-paper), inset 0 0 0 5.5px #a4452b" }}
    >
      <div className={`${mono} text-[11px] font-semibold`}>Approved</div>
      <div className="mt-0.5 font-mono text-[9px]">M. SHARMA</div>
      <div className="font-mono text-[9px] opacity-80">03 OCT 2026</div>
    </div>
  );
}

function Coin() {
  return (
    <div
      className="relative flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full"
      style={{ background: "var(--a-slate)", color: "var(--a-slate-ink)" }}
    >
      <span className="absolute top-2 h-2 w-2 rounded-full" style={{ background: "var(--ll-paper)" }} />
      <div className="mt-1 font-mono text-[14px] font-medium">18%</div>
      <div className={`${mono} text-[8.5px] opacity-80`}>GST</div>
    </div>
  );
}

function IndexCards() {
  return (
    <div className="relative h-[104px] w-[168px]">
      <div
        className="absolute inset-0 translate-x-2 translate-y-2 rotate-[4deg] rounded-[4px]"
        style={{ background: "var(--a-blue)", opacity: 0.6 }}
      />
      <div
        className="absolute inset-0 rounded-[4px] px-3.5 py-3"
        style={{
          background: "var(--a-blue)",
          color: "var(--a-blue-ink)",
          backgroundImage: "repeating-linear-gradient(transparent 0 19px, rgba(255,255,255,.35) 19px 20px)",
          backgroundPosition: "0 26px",
        }}
      >
        <div className={`${mono} text-[9.5px] opacity-75`}>Pricing models</div>
        <div className="mt-1.5 space-y-[3px] font-mono text-[11.5px] leading-[17px]">
          <div>Flat ········ ₹3.50</div>
          <div>Tier ···· 4.00/3.20</div>
          <div>Slab ···· whole vol.</div>
        </div>
      </div>
    </div>
  );
}

function SandboxChip() {
  return (
    <div
      className="rounded-full border border-dashed px-3 py-1.5 font-mono text-[10.5px]"
      style={{ borderColor: "var(--color-border-strong)", background: "var(--color-bg-raised)", color: "var(--color-ink-faint)" }}
    >
      Sandbox · not billed
    </div>
  );
}

/* ── Layout ────────────────────────────────────────────────────────────── */

type Piece = {
  id: string;
  El: () => JSX.Element;
  /** Centre position as % of the desk, desktop. */
  at: [number, number];
  /** Centre position on phones; omit to hide on phones. */
  sm?: [number, number];
  rot: number;
};

const PIECES: Piece[] = [
  { id: "invoice", El: InvoiceSlip, at: [14, 30], sm: [26, 9], rot: -6 },
  { id: "tag", El: PriceTag, at: [34, 15], sm: [82, 13], rot: 8 },
  { id: "cards", El: IndexCards, at: [62, 13], rot: -3 },
  { id: "note", El: StickyNote, at: [83, 27], sm: [80, 90], rot: 5 },
  { id: "seal", El: Seal, at: [90, 60], rot: -10 },
  { id: "ticket", El: Ticket, at: [74, 84], sm: [30, 87], rot: -4 },
  { id: "coin", El: Coin, at: [54, 87], rot: 12 },
  { id: "stamp", El: Stamp, at: [34, 85], rot: -14 },
  { id: "receipt", El: Receipt, at: [11, 72], rot: 4 },
  { id: "chip", El: SandboxChip, at: [21, 51], rot: -2 },
];

function DraggablePiece({
  piece,
  index,
  bounds,
  z,
  onGrab,
  tidy,
  phone,
}: {
  piece: Piece;
  index: number;
  bounds: React.RefObject<HTMLDivElement>;
  z: number;
  onGrab: () => void;
  tidy: number;
  phone: boolean;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const vx = useVelocity(x);
  // Tilt toward the direction of travel, smoothed so it settles back gently.
  const tilt = useSpring(useTransform(vx, [-2000, 0, 2000], [-9, 0, 9]), { stiffness: 260, damping: 26 });
  const rotate = useTransform(tilt, (t) => piece.rot + (reduce ? 0 : t));
  const [lifted, setLifted] = useState(false);

  // "Tidy the desk": spring every piece back to its home position.
  useEffect(() => {
    if (tidy === 0) return;
    const opts = reduce ? { duration: 0 } : { type: "spring" as const, bounce: 0, duration: 0.6 };
    animate(x, 0, opts);
    animate(y, 0, opts);
  }, [tidy, reduce, x, y]);

  const pos = phone ? piece.sm! : piece.at;
  return (
    <motion.div
      className="pointer-events-auto absolute"
      style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, zIndex: z }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", bounce: 0, duration: 0.7, delay: 0.25 + index * 0.05 }}
    >
      <div className={`-translate-x-1/2 -translate-y-1/2 ${phone ? "scale-[0.78]" : ""}`}>
        <motion.div
          drag
          dragConstraints={bounds}
          dragElastic={0.16}
          dragMomentum={!reduce}
          dragTransition={{ power: 0.28, timeConstant: 280, bounceStiffness: 280, bounceDamping: 30 }}
          whileDrag={reduce ? undefined : { scale: 1.04 }}
          onPointerDown={() => {
            onGrab();
            setLifted(true);
          }}
          onPointerUp={() => setLifted(false)}
          onDragEnd={() => setLifted(false)}
          style={{ x, y, rotate, touchAction: "none" }}
          data-lifted={lifted}
          className="ll-artifact relative cursor-grab select-none active:cursor-grabbing"
        >
          <piece.El />
        </motion.div>
      </div>
    </motion.div>
  );
}

export function Desk({ children }: { children: React.ReactNode }) {
  const bounds = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<string[]>(PIECES.map((p) => p.id));
  const [tidy, setTidy] = useState(0);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const set = () => setPhone(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  const pieces = phone ? PIECES.filter((p) => p.sm) : PIECES;

  return (
    <section
      id="top"
      className="relative isolate overflow-hidden"
      style={{ height: "max(640px, min(100svh, 880px))" }}
      aria-labelledby="hero-title"
    >
      <div ref={bounds} className="pointer-events-none absolute inset-x-3 bottom-3 top-[var(--ll-header-h)] z-[20]" aria-hidden>
        {pieces.map((p, i) => (
          <DraggablePiece
            key={`${p.id}-${phone ? "sm" : "lg"}`}
            piece={p}
            index={i}
            bounds={bounds}
            z={order.indexOf(p.id) + 1}
            phone={phone}
            tidy={tidy}
            onGrab={() => setOrder((o) => [...o.filter((id) => id !== p.id), p.id])}
          />
        ))}
      </div>

      {/* Copy sits under the paper layer, so a piece dragged over it stays on top. */}
      <div className="pointer-events-none relative z-[10] flex h-full flex-col items-center justify-center px-5 text-center">
        <div className="pointer-events-auto">
          {children}
          <p className="mt-4 font-mono text-[11px] text-ink-faint">
            Drag the paper around ·{" "}
            <button
              type="button"
              onClick={() => setTidy((t) => t + 1)}
              className="ll-press rounded-sm underline decoration-dotted underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
            >
              Tidy the desk
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
