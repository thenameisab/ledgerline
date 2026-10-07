// Formatting helpers — INR-localised numbers and dates.
//
// We deliberately avoid `Number.prototype.toLocaleString("en-IN", …)` for
// number formatting. Node's default ICU build can group differently than the
// browser (e.g. "1,234,567" server-side vs "12,34,567" browser-side), which
// causes React hydration mismatches. Use the deterministic formatter below.

function formatIntegerINR(n: number): string {
  const sign = n < 0 ? "-" : "";
  const s = Math.abs(Math.trunc(n)).toString();
  if (s.length <= 3) return sign + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return sign + grouped + "," + last3;
}

function formatDecimalINR(n: number, precision: number): string {
  if (precision <= 0) return formatIntegerINR(n);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const fixed = abs.toFixed(precision); // e.g. "1234567.89"
  const [intPart, decPart] = fixed.split(".");
  return sign + formatIntegerINR(Number(intPart)) + "." + decPart;
}

export function formatINR(n: number, opts: { precision?: number; compact?: boolean } = {}): string {
  const { precision = 0, compact = false } = opts;
  if (!Number.isFinite(n)) return "—";
  if (compact && Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (compact && Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (compact && Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${formatDecimalINR(n, precision)}`;
}

export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "₹0";
  // Show 2 decimals, trim trailing zeros to a max of 4 if more precision exists.
  const precision = Number.isInteger(n * 100) ? 2 : 4;
  return `₹${formatDecimalINR(n, precision)}`;
}

export function formatPercent(n: number, precision: number = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(precision)}%`;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return formatIntegerINR(n);
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
