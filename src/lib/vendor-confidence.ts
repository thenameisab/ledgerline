/**
 * What "we know what this cost" means, in one place.
 *
 * Cost confidence is a split of a period's hits by what is known about the
 * rate that priced them. It exists because a margin number carries no signal
 * about its own inputs: a period can read a very high margin when almost none
 * of its hits have a known rate.
 *
 * The threshold between "confirmed" and "not confirmed" is a product decision,
 * written here so every surface answers it the same way. Kept free of any
 * database import so client components can use the helpers, not just the type.
 */

/** Hit counts split by what is known about the rate behind them. */
export type CostConfidence = {
  hits: number;
  contracted: number;
  quoted: number;
  /** Hits priced by a row whose status is still `estimated`. */
  estimated: number;
  /**
   * Hits on a pair decided to have no vendor bill at all — in-house, or a
   * stitched/journey product costed on its components.
   * Not a rate and not a guess: a structural ₹0.
   */
  not_billed: number;
  /** Hits with no rate at all — no row, or a row with no successful-hit cost. */
  unknown: number;
};

/**
 * **Confirmed = contracted + quoted + not billed.**
 *
 * The three statuses are a provenance ladder: `estimated` is a number we made
 * up, `quoted` is a number the vendor gave us, `contracted` is a number in a
 * signed document. The question a margin reader is asking is "did anyone
 * outside this building tell us this rate", and that line falls between
 * estimated and quoted, not between quoted and contracted. A quote can be
 * stale or superseded, which is why it stays a distinct segment on the bar and
 * in the hover — but it is evidence, and treating it as a guess would tell a
 * reader we know less than we do.
 *
 * `not_billed` joins them for a stronger version of the same reason. A pair
 * marked in-house has no vendor invoice to be wrong about — its ₹0 is more
 * certain than any contracted rate, not less. Counting a structural zero as
 * unconfirmed would tell a reader we know less than we do, which is the exact
 * failure the ladder exists to prevent.
 *
 * To change the rule, change this function; every surface uses it.
 */
export function confirmedHits(c: CostConfidence): number {
  return c.contracted + c.quoted + c.not_billed;
}

/** Confirmed hits as a percentage of the period's hits. 0 when there is no traffic. */
export function confirmedShare(c: CostConfidence): number {
  return c.hits > 0 ? (confirmedHits(c) / c.hits) * 100 : 0;
}

/** Below this confirmed share, margin is shown in the muted token. */
export const LOW_CONFIDENCE_PCT = 50;

/**
 * True when a margin figure should render muted (DESIGN.md principle 6: a
 * number computed against placeholders inherits the low-confidence
 * treatment). A period with no traffic has no margin to qualify, so it is not
 * called low — the caller has nothing to show either way.
 */
export function isLowConfidence(c: CostConfidence | null | undefined): boolean {
  if (!c || c.hits === 0) return false;
  return confirmedShare(c) < LOW_CONFIDENCE_PCT;
}

/**
 * Percentage precision for a confidence share.
 *
 * Coverage lives at the ends of the range. 0.24% rounds to "0%", which reads
 * as "none" when the truth is "a little"; 99.76% rounds to "100%", which reads
 * as "all" and makes the breakdown sum to 100.3%. So both tails get one
 * decimal and everything between stays a whole number, which is what scans.
 * Shared, so the bar's tooltip, its caption and the hover breakdown never
 * round the same number two ways on one screen.
 */
export function formatShare(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const fine = (pct > 0 && pct < 1) || (pct > 99 && pct < 100);
  return `${pct.toFixed(fine ? 1 : 0)}%`;
}
