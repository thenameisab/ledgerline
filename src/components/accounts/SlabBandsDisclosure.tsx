"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";
import type { SlabBandAgg } from "@/lib/repos/slab-revenue";

// Expand toggle under a tiered API row: which slab band earned what. Bands are
// graduated per calendar month and summed across the window, so the listed
// hits/revenue reconcile to the row's total revenue.
export function SlabBandsDisclosure({ bands }: { bands: SlabBandAgg[] }) {
  const [open, setOpen] = useState(false);
  if (bands.length === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-0.5 text-[11px] text-ink-muted hover:text-ink transition-colors duration-instant"
      >
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={`transition-transform duration-fast ease-expo ${open ? "rotate-90" : ""}`}
        />
        {open ? "Hide tier breakdown" : "Tier breakdown"}
      </button>

      {open && (
        <ul className="mt-1.5 space-y-1 border-l border-border pl-2.5">
          {bands.map((b) => (
            <li key={b.min_hits} className="flex items-baseline gap-2 text-[11px]">
              <span className="font-mono tnum text-ink-muted whitespace-nowrap">
                {formatNumber(b.min_hits)}–{b.max_hits == null ? "∞" : formatNumber(b.max_hits)}
              </span>
              <span className="text-ink-faint whitespace-nowrap">@ ₹{b.price}</span>
              <span className="text-ink-faint whitespace-nowrap">· {formatNumber(b.hits)} hits</span>
              <span className="ml-auto font-mono tnum text-ink whitespace-nowrap">
                {formatMoney(b.revenue, { precision: 0 })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
