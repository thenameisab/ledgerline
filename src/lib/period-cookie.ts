// The selected reporting period, persisted so it sticks as the user moves
// between Dashboard, Accounts, and detail pages (URL query params don't survive
// navigation). Mirrors the ledgerline.sandbox cookie pattern: written account-side
// via document.cookie, read server-side via cookies() in resolvePeriod().
//
// Value format: "<from>_<to>" with ISO dates, e.g. "2026-06-01_2026-06-30".
export const PERIOD_COOKIE = "ledgerline.period";

export function writePeriodCookie(from: string, to: string) {
  document.cookie = `${PERIOD_COOKIE}=${from}_${to}; path=/; max-age=31536000; samesite=lax`;
}

// Clearing returns every page to the computed default window (defaultRange()).
export function clearPeriodCookie() {
  document.cookie = `${PERIOD_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
