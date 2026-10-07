// Volume pricing math — two models over the same brackets, keyed on the
// period's TOTAL hits across all four outcomes (conventional vocabulary):
//
//   computeTieredRevenue — TIERED (graduated/marginal, like tax brackets):
//     each bracket's units bill at that bracket's own rate. The volume within a
//     bracket is split across outcomes in proportion to the period's outcome
//     mix and priced at that bracket's per-outcome rate — so the result is
//     order-independent and collapses to the simple case when only the
//     successful price is set.
//
//   computeSlabRevenue — SLAB (whole-volume): the total lands in a SINGLE
//     bracket and that bracket's rates apply to every hit (a volume
//     discount/penalty), with no marginal split.
//
// Pure + db-free so it's unit-testable (see scripts/slab-test.ts). All
// arithmetic is on Decimal via lib/money; callers convert at the boundary.

import Decimal from "decimal.js-light";
import { toMoney, ZERO, type Money } from "../money";

export type OutcomeHits = {
  successful: number;
  successful_no_data: number;
  failed: number;
  in_progress: number;
};

/**
 * One tier. `min_hits` is the exclusive lower bound (the previous tier's cap;
 * 0 for the first tier). `max_hits` is the inclusive upper cap; null marks the
 * open-ended top tier. The four prices are per-hit rates for that tier.
 */
export type Slab = {
  min_hits: number;
  max_hits: number | null;
  price_successful: unknown;
  price_successful_no_data: unknown;
  price_failed: unknown;
  price_in_progress: unknown;
};

/** One tier's realised contribution over a period (empty tiers omitted). */
export type SlabBand = {
  min_hits: number;
  max_hits: number | null;
  /** Hits that fell in this tier (the tier's marginal volume). */
  hits: number;
  /** This tier's revenue. Σ bands.revenue === SlabRevenue.revenue exactly. */
  revenue: Money;
  price_successful: Money;
  price_successful_no_data: Money;
  price_failed: Money;
  price_in_progress: Money;
};

export type SlabRevenue = {
  revenue: Money;
  /**
   * Volume-weighted blended unit price per outcome (Σ tier_share × tier_price).
   * Exposed so a statement line can show an effective $/unit and `units × price`
   * reconciles to `revenue`.
   */
  effective: {
    price_successful: Money;
    price_successful_no_data: Money;
    price_failed: Money;
    price_in_progress: Money;
  };
  /** Per-tier realised hits + revenue, for a "which slab earned what" breakdown. */
  bands: SlabBand[];
};

/**
 * TIERED (graduated/marginal) revenue for one API over a period. Returns ZERO
 * revenue (and zero effective prices) when there are no hits or no brackets.
 */
export function computeTieredRevenue(hits: OutcomeHits, slabs: Slab[]): SlabRevenue {
  const total =
    hits.successful + hits.successful_no_data + hits.failed + hits.in_progress;

  if (total <= 0 || slabs.length === 0) {
    return {
      revenue: ZERO,
      effective: {
        price_successful: ZERO,
        price_successful_no_data: ZERO,
        price_failed: ZERO,
        price_in_progress: ZERO,
      },
      bands: [],
    };
  }

  const T = new Decimal(total);
  const sorted = [...slabs].sort((a, b) => a.min_hits - b.min_hits);

  let eff_s = ZERO;
  let eff_snd = ZERO;
  let eff_f = ZERO;
  let eff_ip = ZERO;
  const bands: SlabBand[] = [];

  for (const slab of sorted) {
    const cap = slab.max_hits ?? total; // open-ended top tier caps at the period total
    const tierVol = Math.max(0, Math.min(total, cap) - slab.min_hits);
    if (tierVol <= 0) continue;
    const share = new Decimal(tierVol).div(T); // this tier's fraction of total volume
    eff_s = eff_s.plus(share.times(toMoney(slab.price_successful)));
    eff_snd = eff_snd.plus(share.times(toMoney(slab.price_successful_no_data)));
    eff_f = eff_f.plus(share.times(toMoney(slab.price_failed)));
    eff_ip = eff_ip.plus(share.times(toMoney(slab.price_in_progress)));
    // This tier's revenue: its volume share of each outcome at the tier price.
    // Σ over tiers reconciles to `revenue` below (same factorisation).
    const bandRevenue = share.times(
      toMoney(hits.successful)
        .times(toMoney(slab.price_successful))
        .plus(toMoney(hits.successful_no_data).times(toMoney(slab.price_successful_no_data)))
        .plus(toMoney(hits.failed).times(toMoney(slab.price_failed)))
        .plus(toMoney(hits.in_progress).times(toMoney(slab.price_in_progress)))
    );
    bands.push({
      min_hits: slab.min_hits,
      max_hits: slab.max_hits,
      hits: tierVol,
      revenue: bandRevenue,
      price_successful: toMoney(slab.price_successful),
      price_successful_no_data: toMoney(slab.price_successful_no_data),
      price_failed: toMoney(slab.price_failed),
      price_in_progress: toMoney(slab.price_in_progress),
    });
  }

  const revenue = toMoney(hits.successful)
    .times(eff_s)
    .plus(toMoney(hits.successful_no_data).times(eff_snd))
    .plus(toMoney(hits.failed).times(eff_f))
    .plus(toMoney(hits.in_progress).times(eff_ip));

  return {
    revenue,
    effective: {
      price_successful: eff_s,
      price_successful_no_data: eff_snd,
      price_failed: eff_f,
      price_in_progress: eff_ip,
    },
    bands,
  };
}

/**
 * SLAB (whole-volume) pricing. Unlike the graduated `computeTieredRevenue`,
 * the period's TOTAL hits select a SINGLE bracket and that bracket's per-outcome
 * rates apply to *every* hit — no marginal split. Crossing a threshold re-prices
 * the entire volume (a volume discount/penalty), so this is order-independent
 * and reduces to a flat rate when one bracket covers the period. Same bracket
 * storage + validation as the tiered model; only the math differs.
 */
export function computeSlabRevenue(hits: OutcomeHits, slabs: Slab[]): SlabRevenue {
  const total =
    hits.successful + hits.successful_no_data + hits.failed + hits.in_progress;

  if (total <= 0 || slabs.length === 0) {
    return {
      revenue: ZERO,
      effective: {
        price_successful: ZERO,
        price_successful_no_data: ZERO,
        price_failed: ZERO,
        price_in_progress: ZERO,
      },
      bands: [],
    };
  }

  const sorted = [...slabs].sort((a, b) => a.min_hits - b.min_hits);
  // The bracket the total volume lands in: min_hits is the exclusive lower
  // bound, max_hits the inclusive cap (null = open-ended top). Fall back to the
  // top bracket if nothing matches (total above every cap).
  const slab =
    sorted.find((s) => total > s.min_hits && (s.max_hits == null || total <= s.max_hits)) ??
    sorted[sorted.length - 1];

  const ps = toMoney(slab.price_successful);
  const psnd = toMoney(slab.price_successful_no_data);
  const pf = toMoney(slab.price_failed);
  const pip = toMoney(slab.price_in_progress);

  const revenue = toMoney(hits.successful)
    .times(ps)
    .plus(toMoney(hits.successful_no_data).times(psnd))
    .plus(toMoney(hits.failed).times(pf))
    .plus(toMoney(hits.in_progress).times(pip));

  return {
    revenue,
    // Every hit bills at the matched bracket's rate, so the effective unit
    // prices ARE that bracket's prices.
    effective: {
      price_successful: ps,
      price_successful_no_data: psnd,
      price_failed: pf,
      price_in_progress: pip,
    },
    // One realised band: the whole volume at the matched bracket.
    bands: [
      {
        min_hits: slab.min_hits,
        max_hits: slab.max_hits,
        hits: total,
        revenue,
        price_successful: ps,
        price_successful_no_data: psnd,
        price_failed: pf,
        price_in_progress: pip,
      },
    ],
  };
}

/** Volume-pricing model: 'tier' = graduated/marginal, 'slab' = whole-volume. */
export type VolumeModel = "slab" | "tier";

/** Dispatch to the right volume-pricing math for `model`. */
export function computeVolumeRevenue(
  model: VolumeModel,
  hits: OutcomeHits,
  slabs: Slab[]
): SlabRevenue {
  return model === "slab" ? computeSlabRevenue(hits, slabs) : computeTieredRevenue(hits, slabs);
}

/**
 * Validate a tier set for storage. Returns an error message, or null if valid.
 * Tiers must start at 0, be contiguous with no gaps/overlaps, have a single
 * open-ended top tier, and carry non-negative prices.
 */
export function validateSlabs(slabs: Slab[]): string | null {
  if (slabs.length === 0) return "Add at least one tier.";
  const sorted = [...slabs].sort((a, b) => a.min_hits - b.min_hits);

  if (sorted[0].min_hits !== 0) return "The first tier must start at 0 units.";

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const isLast = i === sorted.length - 1;

    const prices = [
      s.price_successful,
      s.price_successful_no_data,
      s.price_failed,
      s.price_in_progress,
    ];
    if (prices.some((p) => toMoney(p).lt(0))) return "Prices cannot be negative.";

    if (isLast) {
      if (s.max_hits != null) return "The last tier must be open-ended (no upper cap).";
    } else {
      if (s.max_hits == null) return "Only the last tier may be open-ended.";
      if (s.max_hits <= s.min_hits) return "Each tier's cap must exceed its start.";
      if (sorted[i + 1].min_hits !== s.max_hits) {
        return "Tiers must be contiguous — each tier starts where the previous one ends.";
      }
    }
  }
  return null;
}
