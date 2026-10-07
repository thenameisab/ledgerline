// "Why did X change?" — variance attribution between two billing periods.
//
// Diffs two deriveStatement() snapshots for an account and attributes the
// revenue delta per API to volume vs price (an exact split: a blended
// per-hit rate means volume·priceA + hits·ΔpriceB sum back to the line
// delta), or flags new/stopped lines. The factor deltas sum to the total,
// so the waterfall reconciles.

import { deriveStatement, listBillingPeriods, type StatementLine } from "./statements";
import { listAccounts } from "./accounts";
import { fuzzyFilter } from "@/lib/fuzzy";
import { formatMoney } from "@/lib/format";
import { generateSlug } from "@/lib/slug";
import type { AskResult } from "./ask";

export function isVarianceQuestion(raw: string): boolean {
  const t = raw.toLowerCase();
  return /\bwhy\b/.test(t) || /\b(vs|versus|compared to|compared with)\b/.test(t);
}

function signed(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(n), { compact: true })}`;
}

const VAR_MONTH_RE =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/g;
const VAR_ABBR = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function accountNameFrom(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(why|did|does|do|is|the|invoice|bill|billed|billing|revenue|change|changed|move|moved|movement|vs|versus|compared|to|with|from|last|previous|this|month|quarter|year|for|of|so much|drop|fall|rise|grow|increase|decrease|in|on|at|during|between|than|and)\b/g, " ")
    .replace(VAR_MONTH_RE, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/[?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type VPeriod = { id: number; label: string; start_date: string };

// Honor periods named in the question; fall back to the two most recent.
function selectPeriods(raw: string, periods: VPeriod[]): [VPeriod, VPeriod] | null {
  if (periods.length < 2) return null;
  const t = raw.toLowerCase();
  const year = t.match(/\b(20\d{2})\b/)?.[1] ?? null;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_MONTH_RE.source, "g");
  while ((m = re.exec(t))) found.push(m[1].slice(0, 3));
  const periodFor = (abbr: string) =>
    periods.find((p) => {
      const mo = Number(p.start_date.slice(5, 7)) - 1;
      return VAR_ABBR[mo] === abbr && (!year || p.start_date.slice(0, 4) === year);
    });
  const named = [...new Set(found)].map(periodFor).filter(Boolean) as VPeriod[];
  if (named.length >= 2) {
    named.sort((a, b) => b.start_date.localeCompare(a.start_date));
    return [named[0], named[1]];
  }
  if (named.length === 1) {
    const idx = periods.findIndex((p) => p.id === named[0].id);
    const prev = periods[idx + 1];
    if (prev) return [named[0], prev];
  }
  return [periods[0], periods[1]];
}

function pickAccountByName(accounts: { id: number; display_name: string; is_sandbox?: number }[], name: string) {
  const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const strong = accounts.filter((c) => tokens.every((t) => String(c.display_name).toLowerCase().includes(t)));
  const pool = strong.length ? strong : fuzzyFilter(accounts, name, ["display_name"]).slice(0, 1);
  return [...pool].sort((a, b) => (a.is_sandbox ?? 0) - (b.is_sandbox ?? 0))[0] ?? null;
}

export async function answerVariance(
  raw: string,
  _opts: { includeSandbox: boolean }
): Promise<AskResult> {
  const name = accountNameFrom(raw);
  if (!name) return { ok: false, message: "Which account? Try “why did Acme change vs last month?”." };

  const accounts = await listAccounts();
  const match = pickAccountByName(accounts, name);
  if (!match) return { ok: false, message: "Couldn't find that account. Try the account name." };

  const periods = await listBillingPeriods();
  const sel = selectPeriods(raw, periods as VPeriod[]);
  if (!sel) return { ok: false, message: "Not enough billing periods to compare yet." };
  const [cur, prev] = sel;

  const [a, b] = await Promise.all([
    deriveStatement(Number(match.id), Number(prev.id)),
    deriveStatement(Number(match.id), Number(cur.id)),
  ]);
  if (!a || !b) return { ok: false, message: "Couldn't build a comparison for that account." };

  const byCode = new Map<string, { name: string; a?: StatementLine; b?: StatementLine }>();
  for (const l of a.lines) byCode.set(l.api_code, { name: l.api_name, a: l });
  for (const l of b.lines) {
    const e = byCode.get(l.api_code) ?? { name: l.api_name };
    e.b = l;
    e.name = l.api_name;
    byCode.set(l.api_code, e);
  }

  const factors: { label: string; delta: number; reason: string }[] = [];
  for (const { name: apiName, a: la, b: lb } of byCode.values()) {
    const revA = la?.revenue ?? 0;
    const revB = lb?.revenue ?? 0;
    const delta = revB - revA;
    if (Math.abs(delta) < 1) continue;
    let reason: string;
    if (!la || revA === 0) reason = "new usage";
    else if (!lb || revB === 0) reason = "stopped";
    else {
      const hitsA = la.hits || 0;
      const hitsB = lb.hits || 0;
      const priceA = hitsA > 0 ? revA / hitsA : 0;
      const priceB = hitsB > 0 ? revB / hitsB : 0;
      const volumeEffect = (hitsB - hitsA) * priceA;
      const priceEffect = hitsB * (priceB - priceA);
      reason = Math.abs(priceEffect) > Math.abs(volumeEffect) ? "price change" : "volume change";
    }
    factors.push({ label: `${apiName} (${reason})`, delta, reason });
  }

  factors.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const total = b.totals.revenue - a.totals.revenue;

  return {
    ok: true,
    value: signed(total),
    label: `${match.display_name} · ${cur.label} vs ${prev.label} · revenue change`,
    assumptions: "attributed by API: volume vs price",
    drilldown: { href: `/accounts/${generateSlug(match.display_name)}/invoices`, label: "View invoices" },
    rows: factors.slice(0, 6).map((f) => ({ label: f.label, value: signed(f.delta) })),
  };
}
