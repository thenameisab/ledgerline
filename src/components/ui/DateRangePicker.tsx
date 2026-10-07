"use client";
import { buttonClass } from "./Button";
import { writePeriodCookie, clearPeriodCookie } from "@/lib/period-cookie";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { RollingText } from "./RollingText";
import {
  mtdRange,
  prevMonthRange,
  defaultRange,
  lastWeekRange,
  lastNDaysRange,
  monthLabel,
  type DateRange,
} from "@/lib/repos/periods";
import { formatDay, formatDateRange } from "@/lib/format";

// Computed per call, not at module scope: the windows track the IST calendar
// and must not freeze at bundle-load time.
function buildPresets(): { label: string; range: DateRange }[] {
  const mtd = mtdRange();
  return [
    { label: `${monthLabel(mtd.from)} (MTD)`, range: mtd },
    { label: "Last week", range: lastWeekRange() },
    { label: monthLabel(prevMonthRange().from), range: prevMonthRange() },
    { label: "Last 7 days", range: lastNDaysRange(7) },
    { label: "Last 30 days", range: lastNDaysRange(30) },
    { label: "Last 60 days", range: lastNDaysRange(60) },
    { label: "Custom", range: { from: "", to: "" } },
  ];
}

function formatRange(from: string, to: string): string {
  if (!from || !to) return "Select range";
  const named = buildPresets().find(
    (p) => p.label !== "Custom" && p.range.from === from && p.range.to === to
  );
  if (named) return named.label;
  return formatDateRange(from, to);
}

function CalendarMonth({
  year,
  month,
  from,
  to,
  hovering,
  onDayClick,
  onDayHover,
}: {
  year: number;
  month: number; // 0-indexed
  from: string;
  to: string;
  hovering: string;
  onDayClick: (iso: string) => void;
  onDayHover: (iso: string) => void;
}) {
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const rangeEnd = hovering && !to ? hovering : to;

  return (
    <div>
      <div className="text-xs font-medium text-ink text-center mb-3">
        {monthNames[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-px text-center mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="text-[10px] text-ink-faint pb-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const isFrom = iso === from;
          const isTo = iso === rangeEnd;
          const inRange = from && rangeEnd && iso > (from < rangeEnd ? from : rangeEnd) && iso < (from < rangeEnd ? rangeEnd : from);
          const isStart = from && rangeEnd ? iso === (from < rangeEnd ? from : rangeEnd) : isFrom;
          const isEnd = from && rangeEnd ? iso === (from < rangeEnd ? rangeEnd : from) : isTo;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDayClick(iso)}
              onMouseEnter={() => onDayHover(iso)}
              className={`h-7 w-full text-xs rounded transition-colors duration-fast ease-expo
                ${isStart || isEnd ? "bg-accent text-bg font-medium" : ""}
                ${inRange ? "bg-accent-bg text-accent-ink" : ""}
                ${!isStart && !isEnd && !inRange ? "text-ink hover:bg-bg-sunken" : ""}
              `}
            >
              {parseInt(iso.slice(8), 10)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mtd = mtdRange();
  const def = defaultRange();
  const presets = buildPresets();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"presets" | "custom">("presets");
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  // calendar state: picking first or second date
  const [picking, setPicking] = useState<"from" | "to">("from");
  const [calFrom, setCalFrom] = useState(from);
  const [calTo, setCalTo] = useState(to);
  const [hovering, setHovering] = useState("");
  const [calYear, setCalYear] = useState(() => {
    const d = new Date((from || mtd.from) + "T00:00:00Z");
    return d.getUTCFullYear();
  });
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date((from || mtd.from) + "T00:00:00Z");
    return d.getUTCMonth();
  });
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The custom-mode panel is ~520px+ wide and left-anchored to the trigger, so
  // on a narrow viewport it runs off the right edge. Shift it left just enough
  // to fit (clamped so it never leaves the left edge either).
  const [shiftX, setShiftX] = useState(0);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Measure the panel and clamp it into the viewport before paint (no flash).
  // offsetWidth ignores the translateX transform, so this converges in one pass.
  useLayoutEffect(() => {
    if (!open || !ref.current || !panelRef.current) return;
    const margin = 8;
    const baseLeft = ref.current.getBoundingClientRect().left; // panel is left-0 to this
    const baseRight = baseLeft + panelRef.current.offsetWidth;
    let next = 0;
    if (baseRight > window.innerWidth - margin) {
      next = window.innerWidth - margin - baseRight; // negative → move left
    }
    if (baseLeft + next < margin) {
      next = margin - baseLeft; // don't push past the left edge
    }
    setShiftX(next);
  }, [open, mode]);

  const applyRange = (f: string, t: string) => {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (f === def.from && t === def.to) {
      sp.delete("from");
      sp.delete("to");
      clearPeriodCookie();
    } else {
      sp.set("from", f);
      sp.set("to", t);
      writePeriodCookie(f, t);
    }
    router.replace(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, { scroll: false });
    setOpen(false);
  };

  const handlePreset = (p: ReturnType<typeof buildPresets>[number]) => {
    if (p.label === "Custom") {
      setMode("custom");
      setCalFrom(from);
      setCalTo(to);
      setPicking("from");
      return;
    }
    applyRange(p.range.from, p.range.to);
  };

  const handleDayClick = (iso: string) => {
    if (picking === "from") {
      setCalFrom(iso);
      setCalTo("");
      setPicking("to");
    } else {
      const f = calFrom < iso ? calFrom : iso;
      const t = calFrom < iso ? iso : calFrom;
      setCalTo(t);
      setCalFrom(f);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };
  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth2 = calMonth === 11 ? 0 : calMonth + 1;
  const nextYear2 = calMonth === 11 ? calYear + 1 : calYear;

  const isDefaultRange = from === def.from && to === def.to;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setMode("presets"); }}
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors duration-fast ease-expo ${
          !isDefaultRange
            ? "bg-accent-bg border-accent text-accent-ink"
            : "bg-bg-sunken border-border text-ink-muted hover:text-ink"
        }`}
      >
        <Calendar size={12} strokeWidth={1.5} />
        <RollingText
          className="font-medium text-ink"
          text={formatRange(from, to)}
          options={{ direction: "up" }}
        />
        <ChevronDown size={11} strokeWidth={1.75} className={`transition-transform duration-fast ease-expo ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{ transform: `translateX(${shiftX}px)` }}
          className="absolute top-full mt-1 left-0 z-20 bg-bg-raised elev-1 rounded-md min-w-[280px] py-2 origin-top-left"
        >
          {mode === "presets" ? (
            <div>
              <div className="px-3 py-1 text-[11px] uppercase tracking-widest text-ink-faint font-mono">
                Period
              </div>
              {presets.map((p) => {
                const active =
                  p.label !== "Custom" &&
                  p.range.from === from &&
                  p.range.to === to;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePreset(p)}
                    className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm transition-colors duration-fast ease-expo ${
                      active
                        ? "bg-accent-bg text-accent-ink"
                        : "text-ink hover:bg-bg-sunken"
                    }`}
                  >
                    <span>{p.label}</span>
                    {p.label === "Custom" && (
                      <ChevronRight size={12} strokeWidth={1.5} className="text-ink-faint" />
                    )}
                    {active && (
                      <span className="h-[6px] w-[6px] rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
              {!isDefaultRange && (
                <div className="px-3 pt-2 pb-1 border-t border-border mt-1">
                  <button
                    type="button"
                    onClick={() => applyRange(def.from, def.to)}
                    className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors duration-fast ease-expo"
                  >
                    <X size={11} strokeWidth={1.5} /> Reset to default
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-3 py-2 min-w-[520px]">
              <button
                type="button"
                onClick={() => setMode("presets")}
                className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink mb-3 transition-colors duration-fast ease-expo"
              >
                <ChevronLeft size={12} strokeWidth={1.5} /> Presets
              </button>

              <div className="text-xs text-ink-muted mb-3">
                {picking === "from"
                  ? "Click a start date"
                  : calFrom
                  ? `Start: ${calFrom} — click an end date`
                  : "Click a start date"}
              </div>

              <div className="flex gap-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-bg-sunken transition-colors duration-fast ease-expo">
                      <ChevronLeft size={14} strokeWidth={1.5} />
                    </button>
                    <span className="text-xs text-ink font-medium">
                      {new Date(Date.UTC(calYear, calMonth, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
                    </span>
                    <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-bg-sunken transition-colors duration-fast ease-expo">
                      <ChevronRight size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                  <CalendarMonth
                    year={calYear}
                    month={calMonth}
                    from={calFrom}
                    to={calTo}
                    hovering={hovering}
                    onDayClick={handleDayClick}
                    onDayHover={setHovering}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-6" />
                    <span className="text-xs text-ink font-medium">
                      {new Date(Date.UTC(nextYear2, nextMonth2, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
                    </span>
                    <div className="w-6" />
                  </div>
                  <CalendarMonth
                    year={nextYear2}
                    month={nextMonth2}
                    from={calFrom}
                    to={calTo}
                    hovering={hovering}
                    onDayClick={handleDayClick}
                    onDayHover={setHovering}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <div className="text-xs text-ink-muted">
                  {calFrom && calTo ? formatDateRange(calFrom, calTo) : calFrom ? `${formatDay(calFrom)} – …` : "No range selected"}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("presets")}
                    className="text-xs px-3 py-1.5 rounded-md border border-border text-ink-muted hover:text-ink transition-colors duration-fast ease-expo"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!calFrom || !calTo}
                    onClick={() => applyRange(calFrom, calTo)}
                    className={buttonClass({ variant: "primary", size: "sm" })}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
