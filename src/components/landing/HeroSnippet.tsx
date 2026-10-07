"use client";

// The hero card: month-to-date revenue with usage arriving live. Fictional data.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Num, Snippet, Label, usd, usdCompact, useInView } from "./ui";

// `units` is a count of the SKU's own unit; `unit` is its short label.
type Event = { id: number; account: string; code: string; sku: string; units: number; unit: string; rate: number };

const FEED: Omit<Event, "id">[] = [
  { account: "Copperleaf CRM", code: "ATL-PRO-IN", sku: "Atlas Pro · input tokens", units: 42, unit: "M tok", rate: 3 },
  { account: "Quillmark Studio", code: "PRM-VID-1080", sku: "Prism Video · 1080p", units: 380, unit: "sec", rate: 0.25 },
  { account: "Harbor Freight", code: "MSG-SMS-US", sku: "SMS · United States", units: 12400, unit: "msg", rate: 0.0079 },
  { account: "Brightline Clinics", code: "VOX-STT-RT", sku: "Speech-to-text · realtime", units: 8600, unit: "min", rate: 0.006 },
  { account: "Copperleaf Labs", code: "GPU-H100", sku: "H100 GPU · on-demand", units: 24, unit: "GPU-h", rate: 2.49 },
  { account: "Kestrel Ads", code: "PRM-IMG-HD", sku: "Prism Image · HD", units: 1450, unit: "img", rate: 0.08 },
  { account: "Quillmark News", code: "AGT-SEARCH", sku: "Web search tool", units: 9, unit: "K calls", rate: 10 },
  { account: "Copperleaf Support", code: "VOX-AGENT", sku: "Realtime voice agent", units: 1900, unit: "min", rate: 0.06 },
];

// Daily revenue for the last 30 days, in thousands of dollars. Ends at today.
const SERIES = [
  17.4, 18.6, 16.5, 19.8, 21.9, 20.6, 16.0, 15.2, 21.5, 23.1, 24.4, 22.7, 19.3, 18.1, 24.0, 25.6, 24.8, 26.5,
  21.8, 21.0, 26.0, 27.7, 26.9, 29.0, 24.4, 23.1, 28.1, 29.8, 28.6, 27.7,
];

function sparkPath(values: number[], w: number, h: number) {
  const max = Math.max(...values) * 1.08;
  const min = Math.min(...values) * 0.8;
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min)) * h;
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w},${h} L0,${h} Z`, end: { x: x(values.length - 1), y: y(values[values.length - 1]) } };
}

export function HeroSnippet() {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>("0px");
  const [revenue, setRevenue] = useState(148_620);
  const [skus, setSkus] = useState(38);
  const [today, setToday] = useState(SERIES[SERIES.length - 1]);
  const [events, setEvents] = useState<Event[]>(() => FEED.slice(0, 4).map((e, i) => ({ ...e, id: -i })));
  const next = useRef(4);
  const seq = useRef(1);

  useEffect(() => {
    if (!inView || reduce) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!document.hidden) {
        const base = FEED[next.current % FEED.length];
        next.current += 1;
        const jitter = 0.7 + ((seq.current * 37) % 60) / 100;
        const ev: Event = { ...base, units: Math.max(1, Math.round(base.units * jitter)), id: seq.current++ };
        const amount = ev.units * ev.rate;
        setEvents((prev) => [ev, ...prev].slice(0, 4));
        setRevenue((r) => r + amount);
        setSkus((n) => Math.min(43, n + (seq.current % 5 === 0 ? 1 : 0)));
        setToday((t) => t + amount / 1000);
      }
      timer = setTimeout(tick, 2600);
    };
    timer = setTimeout(tick, 1400);
    return () => clearTimeout(timer);
  }, [inView, reduce]);

  const W = 260;
  const H = 64;
  const spark = useMemo(() => sparkPath([...SERIES.slice(0, -1), today], W, H), [today]);

  return (
    <div ref={ref}>
      <Snippet
        path="dashboard · October 2026 (MTD)"
        right={
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
            <span className="ll-pulse inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            Live
          </span>
        }
      >
        <div className="grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5">
          <div>
            <Label>MTD revenue</Label>
            <div className="mt-1 font-display text-[34px] leading-none tracking-hero text-ink sm:text-[40px]">
              <Num value={revenue} format={usd} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-faint">
              <span className="inline-flex items-center rounded-full bg-ok-bg px-1.5 py-0.5 font-mono text-[11px] text-ok-ink">
                +10.0% vs Sep
              </span>
              <span>
                <Num value={skus} /> SKUs billed · margin 54%
              </span>
            </div>
          </div>
          <div className="self-end">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width={W}
              height={H}
              className="h-[64px] w-full max-w-[260px] text-accent"
              role="img"
              aria-label="Daily revenue for the last 30 days, rising toward today"
            >
              <defs>
                <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={spark.area} fill="url(#hero-fill)" style={{ transition: "d 600ms var(--ll-ease-out)" }} />
              <path
                d={spark.line}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                style={{ transition: "d 600ms var(--ll-ease-out)" }}
              />
              <circle
                cx={spark.end.x}
                cy={spark.end.y}
                r="3"
                fill="var(--color-bg-raised)"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ transition: "cy 600ms var(--ll-ease-out)" }}
              />
            </svg>
            <div className="mt-1 text-right font-mono text-[11px] text-ink-faint">
              today {usdCompact(today * 1000)}
            </div>
          </div>
        </div>

        <div className="border-t border-border">
          <div className="flex items-center justify-between px-4 pb-1 pt-3 sm:px-5">
            <Label>Latest usage</Label>
            <Label>Priced</Label>
          </div>
          <ul className="relative h-[156px] overflow-hidden px-2 sm:px-3" aria-label="Latest usage">
            <AnimatePresence initial={false} mode="popLayout">
              {events.map((e) => (
                <motion.li
                  key={e.id}
                  layout={!reduce}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-8px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ type: "spring", bounce: 0, duration: 0.45 }}
                  className={`flex items-center gap-3 rounded px-2 py-2 ${e.id > 0 ? "ll-flash" : ""}`}
                >
                  <span className="w-[92px] shrink-0 truncate font-mono text-[11px] text-ink-faint" title={e.code}>
                    {e.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={`${e.account} · ${e.sku}`}>
                    {e.account}
                    <span className="text-ink-faint"> · {e.sku}</span>
                  </span>
                  <span className="hidden shrink-0 font-mono text-[12px] tabular-nums text-ink-faint sm:inline">
                    +{e.units.toLocaleString("en-US")} {e.unit}
                  </span>
                  <span className="w-[72px] shrink-0 text-right font-mono text-[12px] tabular-nums text-ink">
                    {usd(e.units * e.rate)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </Snippet>
    </div>
  );
}
