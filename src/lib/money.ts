// Money arithmetic.
//
// Postgres NUMERIC(14,4) preserves money exactly server-side, but the
// `postgres` driver hands NUMERIC back as a *string* (because the values
// can exceed JS number precision). The codebase had been calling
// parseFloat() on those strings — silently truncating to IEEE-754 doubles
// and then summing the truncated values, which compounds error.
//
// This module is the boundary. Read money via `toMoney(...)`, do all
// arithmetic on the resulting Decimal, and only convert back to `number`
// at the very last step (display / JSON for the UI). When writing back to
// NUMERIC columns, prefer `toDbNumeric(...)` which yields a fixed-precision
// string the driver hands to Postgres without round-tripping through float.

import Decimal from "decimal.js-light";

// Set once: NUMERIC(14,4) has 4 fractional digits; we keep 6 internally to
// give multiplications headroom before the final round-on-write.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

export type Money = Decimal;
export const ZERO: Money = new Decimal(0);

/** Parse a Postgres NUMERIC value (or any string/number/null) into a Decimal. */
export function toMoney(v: unknown): Money {
  if (v == null) return ZERO;
  if (v instanceof Decimal) return v;
  // postgres driver gives NUMERIC as a string; numbers/ints are also accepted.
  if (typeof v === "string" || typeof v === "number") {
    if (v === "" || (typeof v === "number" && !Number.isFinite(v))) return ZERO;
    return new Decimal(v);
  }
  return ZERO;
}

/** Sum a list of values that may be Decimals, strings, or numbers. */
export function sumMoney(values: Iterable<unknown>): Money {
  let acc: Money = ZERO;
  for (const v of values) acc = acc.plus(toMoney(v));
  return acc;
}

/** Convert to a fixed-4 string suitable for a NUMERIC(14,4) insert/update. */
export function toDbNumeric(m: Money | unknown): string {
  return toMoney(m).toFixed(4);
}

/**
 * Convert to a plain JS `number` for serialization to the UI.
 *
 * NUMERIC(14,4) — at most 10 digits before the decimal — sits inside the
 * IEEE-754 safe range (~15.9 digits), so the conversion is exact for any
 * single value the schema allows. The danger that motivated this module is
 * doing arithmetic on those numbers; downstream display is fine.
 */
export function toNumber(m: Money | unknown): number {
  return toMoney(m).toNumber();
}

/** Margin percentage. Returns 0 when revenue is 0. */
export function marginPct(margin: Money | unknown, revenue: Money | unknown): number {
  const r = toMoney(revenue);
  if (r.isZero()) return 0;
  return toMoney(margin).div(r).times(100).toNumber();
}
