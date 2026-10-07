// Formatting helpers — USD amounts, numbers and dates.
//
// We deliberately avoid `Number.prototype.toLocaleString(…)` for number
// formatting. Node's ICU build can group differently than the browser, which
// causes React hydration mismatches. Use the deterministic formatter below.

function formatInteger(n: number): string {
  const sign = n < 0 ? "-" : "";
  const s = Math.abs(Math.trunc(n)).toString();
  return sign + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDecimal(n: number, precision: number): string {
  if (precision <= 0) return formatInteger(Math.round(n));
  const sign = n < 0 ? "-" : "";
  const fixed = Math.abs(n).toFixed(precision); // e.g. "1234567.89"
  const [intPart, decPart] = fixed.split(".");
  return sign + formatInteger(Number(intPart)) + "." + decPart;
}

/** A USD amount: "$12,480", or "$1.24M" with `compact`. Negative amounts read "-$1,200". */
export function formatMoney(n: number, opts: { precision?: number; compact?: boolean } = {}): string {
  const { precision = 0, compact = false } = opts;
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (compact && a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (compact && a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (compact && a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${formatDecimal(a, precision)}`;
}

/** A unit price. Keeps up to 4 decimals because many SKUs cost fractions of a cent. */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  const precision = Number.isInteger(Math.round(n * 1e6) / 1e4) ? 2 : 4;
  return `${n < 0 ? "-" : ""}$${formatDecimal(Math.abs(n), precision)}`;
}

export function formatPercent(n: number, precision: number = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(precision)}%`;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return formatInteger(n);
}

export function formatDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  // Deterministic day + abbreviated month, locale-independent.
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

/** The standard display date: "24 Jul 2026". Keep ISO for logs only. */
export function formatDay(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${formatDate(s)} ${d.getUTCFullYear()}`;
}

/** A date range for display: "1 Oct 2026 – 6 Oct 2026". */
export function formatDateRange(from: string, to: string): string {
  return `${formatDay(from)} – ${formatDay(to)}`;
}

/** Replaces ISO dates (2026-09-26) inside text with "26 Sep", for alert text stored before titles were formatted. */
export function formatDatesInText(s: string): string {
  return s.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (m) => formatDate(m));
}

/**
 * Canonical date-time format used across the app. Renders in IST per
 * DESIGN.md §8.2: "12 May 2026, 14:48 IST". Accepts ISO strings or values
 * understood by `new Date`. Returns "—" for invalid input.
 */
export function formatDateTime(s: string): string {
  if (!s) return "—";
  // SQLite timestamps come back as "YYYY-MM-DD HH:MM:SS" without a Z; treat as UTC.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
    ? s.replace(" ", "T") + "Z"
    : s;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return s;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  // Convert to IST (UTC+05:30) deterministically; locale APIs vary across
  // Node versions and would risk hydration drift.
  const ist = new Date(d.getTime() + (5 * 60 + 30) * 60_000);
  const day = ist.getUTCDate();
  const mon = months[ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year}, ${hh}:${mm} IST`;
}

export function formatDateLong(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
