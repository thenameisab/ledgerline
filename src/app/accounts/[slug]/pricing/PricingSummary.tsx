"use client";

import { formatMoney, formatDate } from "@/lib/format";

// The landmark for the pricing page: one Instrument-Serif sentence that answers
// "what does this account's pricing look like, and where's the leak?" before the
// eye reaches a single input. Restraint per DESIGN.md §0.2 — synthesized, not raw.

export function PricingSummary({
  pricedCount,
  unpricedCount,
  bundledCount,
  totalRevenue,
  windowDays,
  latestDate,
  onJumpToLeak,
}: {
  pricedCount: number;
  unpricedCount: number;
  bundledCount: number;
  totalRevenue: number;
  windowDays: number;
  latestDate: string | null;
  onJumpToLeak: () => void;
}) {
  const noneConfigured = pricedCount === 0 && bundledCount === 0 && unpricedCount === 0;

  return (
    <div
      className="mb-5 dash-enter"
      style={{ "--i": 0.5 } as React.CSSProperties}
    >
      <h2 className="font-serif text-3xl leading-tight text-ink">
        {noneConfigured ? (
          "No pricing configured yet"
        ) : (
          <>
            {pricedCount > 0 && (
              <span>
                {pricedCount} {pricedCount === 1 ? "SKU" : "SKUs"} priced
              </span>
            )}
            {bundledCount > 0 && (
              <span className="text-ink-muted">
                {pricedCount > 0 ? " · " : ""}
                {bundledCount} stitched
              </span>
            )}
            {unpricedCount > 0 && (
              <>
                {pricedCount > 0 || bundledCount > 0 ? (
                  <span className="text-ink-faint"> · </span>
                ) : null}
                <button
                  onClick={onJumpToLeak}
                  className="text-bad-ink underline decoration-bad/40 decoration-1 underline-offset-4 hover:decoration-bad transition-colors ease-expo"
                  title="Jump to the unpriced SKUs — usage on these earns nothing"
                >
                  {unpricedCount} leaking $0
                </button>
              </>
            )}
          </>
        )}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {totalRevenue > 0 ? (
          <>
            <span className="tnum text-ink">{formatMoney(totalRevenue, { compact: true })}</span>{" "}
            earned in the last {windowDays} days of traffic
            {latestDate && (
              <span className="text-ink-faint">
                {" "}· through {formatDate(latestDate)}
              </span>
            )}
          </>
        ) : (
          <span className="text-ink-faint">No billable traffic in the last {windowDays} days</span>
        )}
      </p>
    </div>
  );
}
