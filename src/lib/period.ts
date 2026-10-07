import "server-only";
import { cookies } from "next/headers";
import { defaultRange, type DateRange } from "@/lib/repos/periods";
import { PERIOD_COOKIE } from "@/lib/period-cookie";

// Resolve the window a page should render, in precedence order:
//   1. explicit URL query params (deep links / the current page's picker),
//   2. the persisted ledgerline.period cookie (sticks across navigation),
//   3. the computed default window (last month early in a new month, else MTD).
export function resolvePeriod(sp?: { from?: string; to?: string }): DateRange {
  if (sp?.from && sp?.to) return { from: sp.from, to: sp.to };
  const raw = cookies().get(PERIOD_COOKIE)?.value;
  if (raw) {
    const [from, to] = raw.split("_");
    if (from && to) return { from, to };
  }
  return defaultRange();
}
