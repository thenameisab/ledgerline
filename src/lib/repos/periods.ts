// Reporting periods, derived from the IST calendar at call time — the
// dashboard always opens on the current month. Daily ingestion (the Metabase
// sync) lands data through yesterday, so "last N days" presets end at
// yesterday: every day they cover actually has data.
//
// Account-safe: no DB or node imports — DateRangePicker and AccountFilterBar
// import from here.

export type DateRange = { from: string; to: string };

// Business dates are IST: Metabase report_date and all usage_daily.date
// values are Asia/Kolkata calendar days, regardless of server timezone.
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function yesterdayIST(): string {
  return shiftISO(todayIST(), -1);
}

function monthStart(iso: string): string {
  return iso.slice(0, 8) + "01";
}

/** Current month to date — the default window everywhere. */
export function mtdRange(): DateRange {
  const t = todayIST();
  return { from: monthStart(t), to: t };
}

/** Previous full calendar month — the comparison window. */
export function prevMonthRange(): DateRange {
  const lastOfPrev = shiftISO(monthStart(todayIST()), -1);
  return { from: monthStart(lastOfPrev), to: lastOfPrev };
}

/** The full calendar month immediately before the one containing `iso`. */
export function prevMonthOf(iso: string): DateRange {
  const lastOfPrev = shiftISO(monthStart(iso), -1);
  return { from: monthStart(lastOfPrev), to: lastOfPrev };
}

// The current month is too thin to be a useful default during its opening
// days (daily ingestion only lands data through yesterday, so day 1 is empty).
// For this many days we open on the previous full month instead.
export const EARLY_MONTH_DAYS = 5;

/** True during the first EARLY_MONTH_DAYS of the IST month. */
export function isEarlyMonth(): boolean {
  return parseInt(todayIST().slice(8, 10), 10) <= EARLY_MONTH_DAYS;
}

/** The window the dashboard opens on: last full month early in a new month
 *  (when the current month has almost no data), month-to-date otherwise. */
export function defaultRange(): DateRange {
  return isEarlyMonth() ? prevMonthRange() : mtdRange();
}

/** Previous full calendar week, Monday–Sunday. */
export function lastWeekRange(): DateRange {
  const t = todayIST();
  const dow = new Date(t + "T00:00:00Z").getUTCDay(); // 0 = Sunday
  const thisMonday = shiftISO(t, -((dow + 6) % 7));
  return { from: shiftISO(thisMonday, -7), to: shiftISO(thisMonday, -1) };
}

/** Trailing N days of actual data, ending yesterday. */
export function lastNDaysRange(n: number): DateRange {
  const y = yesterdayIST();
  return { from: shiftISO(y, -(n - 1)), to: y };
}

// "2026-05-01" → "May 2026".
export function monthLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
