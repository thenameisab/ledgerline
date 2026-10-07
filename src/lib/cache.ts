// Caching for the heavy revenue-view reads.
//
// Dashboard/accounts/apis pages are dynamic (auth + cookies) and otherwise
// re-run every per-window aggregate over usage_daily_with_revenue on each
// navigation. The underlying data only changes on the daily sync or an admin
// write, so we cache these reads and bust them by tag whenever an input to the
// view changes — see revalidateRevenue() and its call sites.
//
// The cache key is the wrapped function's serialized arguments plus keyParts,
// so distinct windows / sandbox / cost-visibility flags get distinct entries.
// Callers must therefore pass every output-affecting input as an argument
// (they already do).

import { unstable_cache, revalidateTag } from "next/cache";

export const REVENUE_TAG = "revenue-data";

export function cachedRevenueRead<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[]
): (...args: A) => Promise<R> {
  return unstable_cache(fn, keyParts, { tags: [REVENUE_TAG] });
}

/** Invalidate every cached revenue read. Call after any write to an input of
 *  usage_daily_with_revenue (usage, pricing, bundles, vendor cost, manual-entry
 *  approval/void, name aliases, catalog renames). Safe to over-call. */
export function revalidateRevenue() {
  revalidateTag(REVENUE_TAG);
}
