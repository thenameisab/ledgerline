"use client";

// Shared building blocks for the landing page and its product snippets.

import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";

/** True once the element has scrolled into view (fires once). */
export function useInView<T extends Element>(margin = "-80px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: `0px 0px ${margin} 0px` }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, margin]);
  return { ref, inView };
}

/** Fades and lifts its child in when it scrolls into view. */
export function Reveal({
  children,
  index = 0,
  className = "",
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-in={inView}
      className={`ll-reveal ${className}`}
      style={{ "--i": index } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** A number that springs to each new value. Tabular figures, so width stays put. */
export function Num({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  className = "",
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 380, damping: 40, mass: 0.6 });
  const text = useTransform(spring, (v) => format(v));
  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, reduce, spring]);
  return <motion.span className={`tabular-nums ${className}`}>{text}</motion.span>;
}

/** Segmented control. The selected pill slides between options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative inline-flex items-center gap-0.5 rounded-full border border-border bg-bg-sunken p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`ll-press relative rounded-full font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              size === "sm" ? "h-[26px] px-2.5 text-[12px]" : "h-[30px] px-3 text-[13px]"
            } ${active ? "text-ink" : "text-ink-faint hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full border border-border bg-bg-raised shadow-low"
                transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.35 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The card a product snippet sits in. `path` reads like the app route it shows. */
export function Snippet({
  path,
  right,
  children,
  className = "",
}: {
  path: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`ll-card overflow-hidden rounded-md ${className}`}
    >
      <div className="flex h-[38px] items-center justify-between gap-3 border-b border-border bg-bg px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-border-strong" />
            <span className="h-2 w-2 rounded-full bg-border-strong" />
            <span className="h-2 w-2 rounded-full bg-border-strong" />
          </span>
          <span className="truncate font-mono text-[11px] text-ink-faint" title={path}>
            {path}
          </span>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children}
    </div>
  );
}

/** Small uppercase label, as used for rail sections and table headers. */
export function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[10.5px] uppercase tracking-widest text-ink-faint ${className}`}>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-sm border border-border bg-bg px-1 font-mono text-[11px] text-ink-faint">
      {children}
    </kbd>
  );
}

/** Rupees, Indian grouping, no decimals. */
export function inr(n: number): string {
  const v = Math.round(n);
  const s = Math.abs(v).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${v < 0 ? "−" : ""}₹${rest ? rest + "," : ""}${last3}`;
}

/** Rupees in lakh / thousand shorthand: ₹1.43L, ₹33.0K. */
export function inrCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (a >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return inr(n);
}
