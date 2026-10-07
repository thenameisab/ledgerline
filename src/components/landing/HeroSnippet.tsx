"use client";

// The hero card: month-to-date revenue with usage arriving live. Fictional data.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Num, Snippet, Label, inr, inrCompact, useInView } from "./ui";

type Event = { id: number; account: string; code: string; api: string; hits: number; rate: number };

const FEED: Omit<Event, "id">[] = [
  { account: "Acme Lending Co", code: "KY1001", api: "PAN Verification", hits: 412, rate: 3.2 },
  { account: "Orbit Cards", code: "FR5001", api: "Credit Bureau Pull", hits: 96, rate: 12 },
  { account: "Vertex Pay", code: "BV3001", api: "Penny Drop", hits: 238, rate: 3 },
  { account: "Helios Capital", code: "IN4004", api: "Bank Statement Analysis", hits: 54, rate: 18 },
  { account: "Orbit Neobank", code: "KY1007", api: "Face Match", hits: 175, rate: 2.5 },
  { account: "Zenith Payments", code: "BV3003", api: "UPI ID Verification", hits: 320, rate: 1.2 },
  { account: "Acme Microfinance", code: "KY1002", api: "Aadhaar OTP Verification", hits: 264, rate: 2.8 },
  { account: "Summit Credit Union", code: "FR5005", api: "AML / PEP Screening", hits: 61, rate: 6 },
];

// Daily revenue for the last 30 days, in thousands. Ends at today.
const SERIES = [
  41, 44, 39, 47, 52, 49, 38, 36, 51, 55, 58, 54, 46, 43, 57, 61, 59, 63, 52, 50, 62, 66, 64, 69, 58, 55, 67,
  71, 68, 66,
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
  const [revenue, setRevenue] = useState(310_610);
  const [hits, setHits] = useState(92_754);
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
        const ev: Event = { ...base, hits: Math.round(base.hits * jitter), id: seq.current++ };
        const amount = ev.hits * ev.rate;
        setEvents((prev) => [ev, ...prev].slice(0, 4));
        setRevenue((r) => r + amount);
        setHits((h) => h + ev.hits);
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
              <Num value={revenue} format={inr} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-faint">
              <span className="inline-flex items-center rounded-full bg-ok-bg px-1.5 py-0.5 font-mono text-[11px] text-ok-ink">
                +10.0% vs Sep
              </span>
              <span>
                <Num value={hits} /> hits · margin 54%
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
              today {inrCompact(today * 1000)}
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
                  <span className="w-[56px] shrink-0 font-mono text-[11px] text-ink-faint">{e.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={`${e.account} · ${e.api}`}>
                    {e.account}
                    <span className="text-ink-faint"> · {e.api}</span>
                  </span>
                  <span className="hidden shrink-0 font-mono text-[12px] tabular-nums text-ink-faint sm:inline">
                    +{e.hits.toLocaleString("en-US")} hits
                  </span>
                  <span className="w-[72px] shrink-0 text-right font-mono text-[12px] tabular-nums text-ink">
                    {inr(e.hits * e.rate)}
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
