// Pure term resolvers for the palette grammar — no React, no icons, no DB.
//
// Split out of cmd/views.ts so the server search path (lib/repos/search.ts) can
// resolve a `month:` operator without pulling the icon components that the view
// registry needs.

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * "june" / "jun" / "june 2026" / "2026-06" → { month: "YYYY-MM", label }, or null.
 * A bare month name takes the current year — the same assumption the ask layer
 * makes, and what people mean when they type it.
 */
export function resolveMonth(raw: string): { month: string; label: string } | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;

  const iso = t.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) {
    const m = Number(iso[2]);
    if (m < 1 || m > 12) return null;
    return {
      month: `${iso[1]}-${String(m).padStart(2, "0")}`,
      label: `${cap(MONTHS[m - 1])} ${iso[1]}`,
    };
  }

  const named = t.match(/^([a-z]+)\.?\s*(\d{4})?$/);
  if (named) {
    const stem = named[1];
    // Full name, or an abbreviation of at least three letters ("jun", "sept").
    const idx = MONTHS.findIndex(
      (m) => m === stem || (stem.length >= 3 && m.startsWith(stem))
    );
    if (idx === -1) return null;
    const year = named[2] ? Number(named[2]) : new Date().getFullYear();
    return { month: `${year}-${String(idx + 1).padStart(2, "0")}`, label: `${cap(MONTHS[idx])} ${year}` };
  }

  return null;
}
