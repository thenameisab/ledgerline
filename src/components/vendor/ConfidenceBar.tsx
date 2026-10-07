import { type CostConfidence, confirmedShare, formatShare } from "@/lib/vendor-confidence";
import { formatNumber } from "@/lib/format";

/**
 * How much of a cost figure is actually known, as a share of hits.
 *
 * A share, not a single flag: a vendor with one confirmed rate and many
 * placeholders must not read as confirmed.
 *
 * Segments are ordered best-known first: not billed, contracted, quoted,
 * estimated, unknown. "Not billed" leads because a structural ₹0 is the one
 * cost that cannot be wrong. Following MarginBullet, the value is always stated as text as well
 * as colour — colour and position alone are never the only carrier.
 */
export function ConfidenceBar({
  confidence,
  showLabel = true,
}: {
  confidence: CostConfidence;
  /** Hide the caption when the caller states coverage in its own prose. */
  showLabel?: boolean;
}) {
  const { hits, contracted, quoted, estimated, not_billed, unknown } = confidence;
  const pct = (n: number) => (hits > 0 ? (n / hits) * 100 : 0);
  const segments = [
    { key: "not_billed", n: not_billed, cls: "bg-ok", label: "Not billed" },
    { key: "contracted", n: contracted, cls: "bg-ok-ink", label: "Contracted" },
    { key: "quoted", n: quoted, cls: "bg-accent", label: "Quoted" },
    { key: "estimated", n: estimated, cls: "bg-warn-ink", label: "Estimated" },
    { key: "unknown", n: unknown, cls: "bg-border", label: "No rate" },
  ].filter((s) => s.n > 0);

  const caption =
    hits === 0
      ? "No traffic this period"
      : `Cost confirmed on ${formatShare(confirmedShare(confidence))} of units`;

  return (
    <div>
      <div
        className="flex h-[6px] rounded overflow-hidden bg-bg-sunken"
        role="img"
        aria-label={
          hits === 0
            ? "No traffic this period"
            : segments
                .map((s) => `${s.label} ${formatShare(pct(s.n))}`)
                .join(", ")
        }
        title={
          hits === 0
            ? "No traffic this period"
            : segments
                .map((s) => `${s.label}: ${formatNumber(s.n)} units (${formatShare(pct(s.n))})`)
                .join("\n")
        }
      >
        {segments.map((s) => (
          <div key={s.key} className={s.cls} style={{ width: `${pct(s.n)}%` }} />
        ))}
      </div>
      {showLabel && (
        <div className="text-[10px] text-ink-faint mt-1 tnum">{caption}</div>
      )}
    </div>
  );
}
