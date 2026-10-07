import { formatPercent } from "@/lib/format";

// Bullet chart: margin % against a target, on a qualitative bad/ok/good track.
// Value is always shown as text (never color-position alone) — AAA-accessible.
//
// `muted` drops the health colour when too little of the cost behind the figure
// is known (DESIGN.md principle 6). A 99% margin painted green is the product
// asserting something it cannot support; the same 99% in the muted token reads
// as "this is what the arithmetic says, and the arithmetic is missing inputs".
// The track stays, so the figure is still placed against its target.
export function MarginBullet({
  pct,
  target = 45,
  muted = false,
}: {
  pct: number;
  target?: number;
  /** True when cost confidence is low — see lib/vendor-confidence.isLowConfidence. */
  muted?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone = muted ? "muted" : pct >= target ? "ok" : pct >= target * 0.8 ? "warn" : "bad";
  // The measure bar uses each status's *base* colour, which is what the token
  // contract reserves for progress fills. The `-ink` variants are text shades —
  // against the feedback tints behind the bar they render as mud.
  const measureColor =
    tone === "muted" ? "bg-ink-faint" : tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-bad";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[6px]">
        <span className="text-xs uppercase tracking-widest text-ink-muted">Margin vs target</span>
        <span className="text-sm font-mono tnum">
          <span
            className={
              tone === "muted"
                ? "text-ink-muted"
                : tone === "ok"
                ? "text-ok-ink"
                : tone === "warn"
                ? "text-warn-ink"
                : "text-bad-ink"
            }
          >
            {formatPercent(pct, 1)}
          </span>
          <span className="text-ink-faint text-xs"> / {target}%</span>
        </span>
      </div>
      <div
        className="relative h-[14px] rounded overflow-hidden flex"
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          muted
            ? `Margin ${formatPercent(pct, 1)}, target ${target}%. Cost is confirmed on less than half of this period's units.`
            : `Margin ${formatPercent(pct, 1)}, target ${target}%`
        }
      >
        <div className="bg-bad-bg" style={{ width: `${target * 0.8}%` }} />
        <div className="bg-warn-bg" style={{ width: `${target * 0.2}%` }} />
        <div className="bg-ok-bg flex-1" />
        <div
          className={`absolute left-0 top-1 h-[6px] rounded-sm bar-grow ${measureColor}`}
          style={{ width: `${clamped}%` }}
        />
        <div
          className="absolute -top-[2px] -bottom-[2px] w-0 border-l-2 border-ink"
          style={{ left: `${Math.min(100, target)}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
