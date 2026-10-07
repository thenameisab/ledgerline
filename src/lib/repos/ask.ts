// "Ask a number" — natural-language questions over billing data.
//
// Two layers converge here:
//   1. Template parsing (deterministic, no model) handles the common question
//      shapes by extracting an intent + entity + period from the text.
//   2. The optional LLM fallback (see ask-llm.ts) emits a validated AskSpec
//      that runs through the SAME handlers below — it never touches SQL.
//
// Everything reads the cached MTD-style summaries (getAccountSummaries /
// getGroupSummaries), so answers reconcile with the dashboard and account
// pages exactly. Read-only; metrics are limited to figures we compute
// accurately today (revenue, hits, unpriced) — no per-account margin, which
// needs vendor allocation we don't have (see StatusChip note).

import { generateSlug } from "@/lib/slug";
import { formatINR, formatNumber } from "@/lib/format";
import { mtdRange, prevMonthRange } from "@/lib/repos/periods";
import { getAccountSummaries, getGroupSummaries, type AccountSummary, type GroupSummary } from "@/lib/repos/accounts";
import { fuzzyFilter } from "@/lib/fuzzy";
import { isVarianceQuestion, answerVariance } from "@/lib/repos/ask-variance";
import { isRelationQuestion, answerRelation } from "@/lib/repos/ask-relations";

export type AskMetric = "revenue" | "hits" | "unpriced";
export type AskEntityType = "account" | "group" | "all";

/** Normalised query spec — produced by the parser or the LLM, run by answerSpec. */
export type AskSpec = {
  metric: AskMetric;
  entityType: AskEntityType;
  entityName?: string; // free text; resolved by fuzzy match
  topN?: number; // for ranked lists
  period?: string; // free text; parsed by parsePeriod
};

export type AskRow = { label: string; value: string; sub?: string; href?: string };

export type AskResult =
  | {
      ok: true;
      value: string;
      label: string;
      assumptions: string;
      drilldown?: { href: string; label: string };
      rows?: AskRow[];
      /**
       * Daily series behind the figure, when there is one. Revenue only —
       * `AccountSummary.spark` is a daily revenue array and we don't keep the
       * equivalent for hits, so a hits answer has no graph rather than a graph
       * of the wrong metric.
       */
      series?: { points: number[]; label: string };
    }
  | { ok: false; message: string };

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));

// Match month names/abbreviations as WHOLE words only. The old `(may)[a-z]*`
// pattern matched any word starting with a month abbrev ("Maya", "Marqeta",
// "Maruti"), corrupting both the period and the entity.
const MONTH_RE_SRC =
  "january|february|march|april|may|june|july|august|september|october|november|december|" +
  "jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const MONTH_RE = new RegExp(`\\b(${MONTH_RE_SRC})\\b`);
const MONTH_RE_G = new RegExp(`\\b(${MONTH_RE_SRC})\\b`, "g");

function monthLabel(fromISO: string): string {
  const [y, m] = fromISO.split("-").map(Number);
  return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Parse a period phrase. Defaults to MTD. Always returns a labelled range. */
export function parsePeriod(text: string): { from: string; to: string; label: string } {
  const t = text.toLowerCase();

  if (/\b(last|previous)\s+month\b/.test(t)) {
    const r = prevMonthRange();
    return { ...r, label: monthLabel(r.from) };
  }

  // ISO month ("2026-06"). Without this the month-name scan below misses it and
  // the whole thing falls through to MTD — a wrong period reported as if it were
  // the asked-for one. The "Ask Me" cues send this form, and it's a plausible
  // thing to type by hand too.
  const isoMatch = t.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const m0 = Number(isoMatch[2]) - 1;
    const mm = isoMatch[2];
    return {
      from: `${year}-${mm}-01`,
      to: `${year}-${mm}-${String(daysInMonth(year, m0)).padStart(2, "0")}`,
      label: `${MONTHS[m0][0].toUpperCase()}${MONTHS[m0].slice(1)} ${year}`,
    };
  }

  const monthMatch = t.match(MONTH_RE);
  if (monthMatch) {
    const m0 = MONTH_ABBR.indexOf(monthMatch[1].slice(0, 3));
    const yearMatch = t.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : new Date().getUTCFullYear();
    const mm = String(m0 + 1).padStart(2, "0");
    const from = `${year}-${mm}-01`;
    const to = `${year}-${mm}-${String(daysInMonth(year, m0)).padStart(2, "0")}`;
    return { from, to, label: `${MONTHS[m0][0].toUpperCase()}${MONTHS[m0].slice(1)} ${year}` };
  }

  const r = mtdRange();
  return { ...r, label: "this month (MTD)" };
}

/** Heuristic parse of free text into a spec. Returns null if it isn't a question we handle. */
export function parseQuestion(raw: string): AskSpec | null {
  const t = raw.toLowerCase().trim();
  if (!t) return null;

  const period = raw; // parsePeriod scans the whole string

  if (t.includes("unpriced")) {
    return { metric: "unpriced", entityType: t.includes("account") ? "all" : "all", entityName: stripNoise(raw), period };
  }

  const topMatch = t.match(/top\s+(\d+)/);
  if (topMatch) {
    return { metric: "revenue", entityType: "all", topN: Number(topMatch[1]), period };
  }

  const isRevenue = /\b(revenue|bill|billed|billing|made|earn|earned|charged)\b/.test(t);
  const isHits = /\b(hits|calls|usage|volume|traffic)\b/.test(t);
  const entityName = stripNoise(raw);

  // Default to revenue when a plausible entity is named, even without a metric
  // verb ("Acme", "how is Acme doing"). Only give up when nothing is left.
  if (!isRevenue && !isHits && !entityName) return null;

  const metric: AskMetric = isHits && !isRevenue ? "hits" : "revenue";
  const entityType: AskEntityType = /\b(group|group)\b/.test(t) ? "group" : "account";
  return { metric, entityType, entityName: entityName || undefined, period };
}

/** Remove question scaffolding so the residue can fuzzy-match an entity name. */
function stripNoise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(how much|how many|how|many|number|did|does|do|what'?s|what is|whats|the|revenue|bill|billed|billing|make|made|earn|earned|charged|hits|calls|usage|volume|traffic|in|for|of|group|group|this|last|previous|month|mtd|quarter|year|top \d+|accounts?|by|total|all|overall|combined|across|show|me|us|is|are|was|were|doing|stats?|summary|tell|give|about|currently)\b/g, " ")
    .replace(MONTH_RE_G, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/[?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Resolve a name to an account. When several accounts share a brand token (the
// many "Acme …" rows), match-sorter's first hit is arbitrary and often a ₹0
// row — so among genuine substring matches prefer non-sandbox, then highest
// revenue (what "how much did Acme bill" actually means).
function pickAccount(summaries: AccountSummary[], name: string): AccountSummary | null {
  const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const strong = summaries.filter((c) => tokens.every((t) => c.display_name.toLowerCase().includes(t)));
  if (strong.length) return [...strong].sort((a, b) => a.is_sandbox - b.is_sandbox || b.revenue - a.revenue)[0];
  // Looser fuzzy, but only if it genuinely shares a token — otherwise a
  // non-existent name ("Maya", "PAN API") would resolve to a garbage account.
  const fuzzy = fuzzyFilter(summaries, name, ["display_name"])[0];
  if (fuzzy && tokens.some((t) => t.length >= 3 && fuzzy.display_name.toLowerCase().includes(t))) return fuzzy;
  return null;
}

function pickGroup(groups: GroupSummary[], name: string): GroupSummary | null {
  const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const strong = groups.filter((a) => tokens.every((t) => a.name.toLowerCase().includes(t)));
  if (strong.length) return [...strong].sort((a, b) => b.revenue - a.revenue)[0];
  const fuzzy = fuzzyFilter(groups, name, ["name"])[0];
  if (fuzzy && tokens.some((t) => t.length >= 3 && fuzzy.name.toLowerCase().includes(t))) return fuzzy;
  return null;
}

export async function answerSpec(
  spec: AskSpec,
  opts: { includeSandbox: boolean }
): Promise<AskResult> {
  const { from, to, label: periodLabel } = parsePeriod(spec.period ?? "");
  const sandboxNote = opts.includeSandbox ? "sandbox included" : "sandbox excluded";
  const assumptions = `${periodLabel} · ${sandboxNote}`;

  // Unpriced — what's at risk
  if (spec.metric === "unpriced") {
    const summaries = await getAccountSummaries({ from, to, includeSandbox: opts.includeSandbox });
    const flagged = summaries.filter((c) => c.unpriced_pairs > 0).sort((a, b) => b.unpriced_hits - a.unpriced_hits);
    const totalPairs = flagged.reduce((n, c) => n + c.unpriced_pairs, 0);
    const totalHits = flagged.reduce((n, c) => n + c.unpriced_hits, 0);
    return {
      ok: true,
      value: `${formatNumber(totalPairs)} pairs`,
      label: `Unpriced (account, API) pairs · ${formatNumber(totalHits)} hits at risk`,
      assumptions,
      drilldown: { href: "/accounts", label: "View accounts" },
      rows: flagged.slice(0, 8).map((c) => ({
        label: c.display_name,
        value: `${c.unpriced_pairs} pair${c.unpriced_pairs === 1 ? "" : "s"}`,
        sub: `${formatNumber(c.unpriced_hits)} hits`,
        href: `/accounts/${generateSlug(c.display_name)}`,
      })),
    };
  }

  // Group revenue
  if (spec.entityType === "group") {
    const groups = await getGroupSummaries({ from, to, includeSandbox: opts.includeSandbox });
    const match = spec.entityName ? pickGroup(groups, spec.entityName) : null;
    if (!match) return { ok: false, message: "Couldn't find that group. Try the group name." };
    return {
      ok: true,
      value: formatINR(match.revenue, { compact: true }),
      label: `${match.name} · ${periodLabel} · revenue`,
      assumptions,
      drilldown: { href: `/accounts/groups/${match.id}`, label: "View group" },
    };
  }

  const summaries = await getAccountSummaries({ from, to, includeSandbox: opts.includeSandbox });

  // Top-N accounts by revenue
  if (spec.topN) {
    const top = [...summaries].sort((a, b) => b.revenue - a.revenue).slice(0, spec.topN);
    return {
      ok: true,
      value: `Top ${spec.topN} by revenue`,
      label: `${periodLabel}`,
      assumptions,
      drilldown: { href: "/dashboard", label: "View dashboard" },
      rows: top.map((c) => ({
        label: c.display_name,
        value: formatINR(c.revenue, { compact: true }),
        sub: `${formatNumber(c.hits)} hits`,
        href: `/accounts/${generateSlug(c.display_name)}`,
      })),
      series: { points: sumSeries(top), label: `Top ${spec.topN} daily revenue` },
    };
  }

  // Single account revenue/hits
  if (spec.entityName) {
    const match = pickAccount(summaries, spec.entityName);
    if (!match) return { ok: false, message: "Couldn't find that account. Try the account name." };
    const isHits = spec.metric === "hits";
    return {
      ok: true,
      value: isHits ? formatNumber(match.hits) : formatINR(match.revenue, { compact: true }),
      label: `${match.display_name} · ${periodLabel} · ${isHits ? "hits" : "revenue"}`,
      assumptions,
      drilldown: { href: `/accounts/${generateSlug(match.display_name)}`, label: "View account" },
      series: isHits ? undefined : { points: match.spark, label: "Daily revenue" },
      rows: match.top_apis.slice(0, 5).map((a) => ({
        label: a.api_name ?? a.api_code,
        value: formatINR(a.revenue, { compact: true }),
        sub: `${formatNumber(a.hits)} hits`,
        href: `/apis/${encodeURIComponent(a.api_code)}`,
      })),
    };
  }

  // No entity → org total
  const isHits = spec.metric === "hits";
  const totalRevenue = summaries.reduce((n, c) => n + c.revenue, 0);
  const totalHits = summaries.reduce((n, c) => n + c.hits, 0);
  return {
    ok: true,
    value: isHits ? formatNumber(totalHits) : formatINR(totalRevenue, { compact: true }),
    label: `All accounts · ${periodLabel} · ${isHits ? "hits" : "revenue"}`,
    assumptions,
    drilldown: { href: "/dashboard", label: "View dashboard" },
    series: isHits ? undefined : { points: sumSeries(summaries), label: "Daily revenue" },
  };
}

/**
 * Element-wise sum of the accounts' daily revenue sparks. They all come from the
 * same date range in getAccountSummaries, so index i is the same day for every
 * account; a shorter array (shouldn't happen) just contributes zeroes.
 */
function sumSeries(rows: { spark: number[] }[]): number[] {
  const len = rows.reduce((n, r) => Math.max(n, r.spark.length), 0);
  const out = new Array<number>(len).fill(0);
  for (const r of rows) for (let i = 0; i < r.spark.length; i++) out[i] += r.spark[i];
  return out;
}

const CANT_ANSWER: AskResult = {
  ok: false,
  message: "I can answer revenue, hits, and unpriced questions — try “revenue for Acme in May” or “top 5 accounts”.",
};

export async function answerQuestion(
  raw: string,
  opts: { includeSandbox: boolean }
): Promise<AskResult> {
  if (isVarianceQuestion(raw)) return answerVariance(raw, opts);
  if (isRelationQuestion(raw)) return answerRelation(raw, opts);
  const spec = parseQuestion(raw);
  if (!spec) return CANT_ANSWER;
  return answerSpec(spec, opts);
}
