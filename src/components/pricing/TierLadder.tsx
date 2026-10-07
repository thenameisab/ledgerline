"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { VolumeModel } from "@/lib/pricing/slabs";

// A visual, draggable model of a volume-pricing schedule. The ladder shows each
// bracket to scale along the hit axis; dragging a boundary retargets the cap 1:1
// with the pointer. The curve below plots what a period of N hits would be
// charged — the shape that makes "slab" (whole-volume, stepped) legibly
// different from "tiered" (graduated, kinked-linear). Successful price only; the
// numeric table remains the source of truth for the other outcomes.

export type LadderBracket = { min: number; cap: number | null; price: number };

const W = 620; // SVG user-space width (scales to container via width:100%)
const LADDER_H = 60;
const CURVE_H = 96;
const PAD = 1;

const HEAT = [
  "var(--color-heat-1)",
  "var(--color-heat-2)",
  "var(--color-heat-3)",
  "var(--color-heat-4)",
];

function fmtHits(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(n);
}

export function TierLadder({
  model,
  brackets,
  onCapChange,
}: {
  model: VolumeModel;
  brackets: LadderBracket[];
  onCapChange: (index: number, cap: number) => void;
}) {
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  // Frozen during an active drag: the domain is derived from the caps, so
  // letting it float while dragging a cap creates a feedback loop (drag right →
  // cap grows → domain grows → same pointer maps further right → runaway).
  const dragDomain = useRef<number | null>(null);

  const finiteCaps = brackets
    .map((b) => b.cap)
    .filter((c): c is number => c != null && Number.isFinite(c));
  const maxCap = finiteCaps.length ? Math.max(...finiteCaps) : 0;
  // Domain extends past the last threshold so the open-ended top tier has room.
  const liveDomain = maxCap > 0 ? maxCap * 1.3 : 10000;
  const domain = dragging != null && dragDomain.current != null ? dragDomain.current : liveDomain;

  const xOf = (v: number) => PAD + (v / domain) * (W - PAD * 2);
  const vOf = (x: number) => ((x - PAD) / (W - PAD * 2)) * domain;

  // Boundary i sits at brackets[i].cap and separates bracket i from i+1.
  function boundaryFromPointer(e: React.PointerEvent, i: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let v = Math.round(vOf(px) / 100) * 100;
    const lo = brackets[i].min + 100;
    const hi = i + 1 < brackets.length - 1 ? (brackets[i + 1].cap ?? domain) - 100 : domain;
    v = Math.max(lo, Math.min(hi, v));
    onCapChange(i, v);
  }

  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 34 };

  // Sample the charge curve across the domain.
  const SAMPLES = 96;
  const charge = (v: number) => {
    let idx = brackets.findIndex((b) => v < (b.cap ?? Infinity));
    if (idx === -1) idx = brackets.length - 1;
    if (model === "slab") return v * brackets[idx].price;
    let total = 0;
    for (let i = 0; i < idx; i++) {
      const span = (brackets[i].cap ?? v) - brackets[i].min;
      total += span * brackets[i].price;
    }
    total += (v - brackets[idx].min) * brackets[idx].price;
    return total;
  };
  const samples = Array.from({ length: SAMPLES + 1 }, (_, k) => {
    const v = (k / SAMPLES) * domain;
    return { v, c: charge(v) };
  });
  const maxCharge = Math.max(...samples.map((s) => s.c), 1);
  const yOf = (c: number) => CURVE_H - PAD - (c / maxCharge) * (CURVE_H - PAD * 2 - 8);
  const curvePath = samples
    .map((s, k) => `${k === 0 ? "M" : "L"}${xOf(s.v).toFixed(1)},${yOf(s.c).toFixed(1)}`)
    .join(" ");

  return (
    <div className="rounded-md border border-border bg-bg-sunken/40 p-3">
      {/* Ladder */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${LADDER_H}`}
        width="100%"
        height={LADDER_H}
        className="block touch-none select-none"
        role="group"
        aria-label="Pricing bracket ladder"
      >
        {brackets.map((b, i) => {
          const start = xOf(b.min);
          const end = xOf(b.cap ?? domain);
          const w = Math.max(end - start, 0);
          const color = HEAT[Math.min(i, HEAT.length - 1)];
          const mid = start + w / 2;
          return (
            <g key={i}>
              <motion.rect
                x={start}
                y={8}
                height={LADDER_H - 22}
                rx={4}
                fill={color}
                fillOpacity={0.85}
                initial={false}
                animate={{ width: w }}
                transition={dragging === i ? { duration: 0 } : spring}
              />
              {w > 46 && (
                <>
                  <text
                    x={mid}
                    y={LADDER_H / 2 - 1}
                    textAnchor="middle"
                    className="fill-bg font-mono"
                    style={{ fontSize: 11, fontWeight: 500 }}
                  >
                    ${b.price || 0}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Draggable boundary handles between adjacent brackets */}
        {brackets.slice(0, -1).map((b, i) => {
          const x = xOf(b.cap ?? domain);
          const nudge = (delta: number) => {
            const lo = brackets[i].min + 100;
            const hi =
              i + 1 < brackets.length - 1 ? (brackets[i + 1].cap ?? domain) - 100 : domain;
            const next = Math.max(lo, Math.min(hi, (b.cap ?? 0) + delta));
            onCapChange(i, next);
          };
          return (
            <g key={`h-${i}`}>
              <line
                x1={x}
                x2={x}
                y1={4}
                y2={LADDER_H - 10}
                stroke="var(--color-bg-raised)"
                strokeWidth={2}
              />
              <rect
                x={x - 7}
                y={4}
                width={14}
                height={LADDER_H - 12}
                rx={3}
                fill="var(--color-bg-raised)"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                className="cursor-ew-resize focus:outline-none"
                tabIndex={0}
                role="slider"
                aria-label={`Bracket ${i + 1} upper limit`}
                aria-valuenow={b.cap ?? 0}
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture(e.pointerId);
                  dragDomain.current = liveDomain;
                  setDragging(i);
                }}
                onPointerMove={(e) => {
                  if (dragging === i) boundaryFromPointer(e, i);
                }}
                onPointerUp={(e) => {
                  (e.target as Element).releasePointerCapture(e.pointerId);
                  dragDomain.current = null;
                  setDragging(null);
                }}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 10000 : 1000;
                  if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                    e.preventDefault();
                    nudge(step);
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                    e.preventDefault();
                    nudge(-step);
                  }
                }}
              />
              <line x1={x - 2.5} x2={x - 2.5} y1={14} y2={LADDER_H - 20} stroke="var(--color-accent)" strokeWidth={1} strokeOpacity={0.6} />
              <line x1={x + 2.5} x2={x + 2.5} y1={14} y2={LADDER_H - 20} stroke="var(--color-accent)" strokeWidth={1} strokeOpacity={0.6} />
              <text
                x={x}
                y={LADDER_H - 1}
                textAnchor="middle"
                className="fill-ink-muted font-mono"
                style={{ fontSize: 9 }}
              >
                {fmtHits(b.cap ?? 0)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Charge curve */}
      <div className="mt-2 pt-2 border-t border-border/60">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider font-mono text-ink-faint">
            Charge across volume
          </span>
          <span className="text-[10px] font-mono text-ink-faint">
            {model === "slab" ? "whole-volume · stepped" : "graduated · kinked"}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${CURVE_H}`}
          width="100%"
          height={CURVE_H}
          className="block overflow-visible"
          aria-hidden
        >
          {/* threshold guides */}
          {brackets.slice(0, -1).map((b, i) => {
            const x = xOf(b.cap ?? domain);
            return (
              <line
                key={`g-${i}`}
                x1={x}
                x2={x}
                y1={PAD}
                y2={CURVE_H - PAD}
                stroke="var(--color-border)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            );
          })}
          <motion.path
            d={curvePath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={false}
            animate={{ d: curvePath }}
            transition={dragging != null ? { duration: 0 } : spring}
          />
        </svg>
      </div>
    </div>
  );
}
