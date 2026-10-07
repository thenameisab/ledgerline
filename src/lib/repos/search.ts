// Unified palette search.
//
// One read that fans out across the entities the command palette can jump to:
// accounts, invoices (statements), groups, APIs, manual entries, and — for
// admins — vendor costs and the audit log. Each result carries the inline
// metadata the palette renders (revenue, status, margin) so the user can
// confirm a hit without navigating.
//
// Accounts and groups reuse the cached MTD summary reads (same data the
// /accounts and /accounts/groups pages show). The rest are light direct
// queries. Every query is token-ANDed: each whitespace-separated token must
// match the row's searchable text, so "Acme May" finds Acme's May statement.

import postgres from "postgres";
import getSql from "@/lib/db";
import { generateSlug } from "@/lib/slug";
import { toNumber, marginPct } from "@/lib/money";
import { resolvePeriod } from "@/lib/period";
import { getAccountSummaries, getGroupSummaries } from "@/lib/repos/accounts";
import { fuzzyFilter } from "@/lib/fuzzy";
import { features } from "@/lib/help/features";
import { guides } from "@/lib/help/guides";
import { parseQuery, passesExcludes, type ParsedQuery } from "@/lib/cmd/query";
import { resolveMonth } from "@/lib/cmd/terms";
import type { StatusKind } from "@/components/chips/StatusChip";
import type { StatementStatus } from "@/lib/repos/statements";
import type { ManualEntryStatus } from "@/lib/repos/manual-entries";

export type AccountHit = {
  type: "account";
  id: number;
  slug: string;
  name: string;
  has_logo: boolean;
  group_name: string | null;
  revenue: number;
  status_pill: StatusKind;
  unpriced_pairs: number;
  // Set when the row matched a *retired* slug rather than the current name —
  // i.e. the account was renamed and the user searched what it used to be
  // called. Rendered as "formerly …" so the match doesn't look like a bug.
  matched_former_name?: string;
};

export type InvoiceHit = {
  type: "invoice";
  account_slug: string;
  client_name: string;
  period_id: number;
  period_label: string;
  number: string;
  status: StatementStatus;
  revenue: number;
  margin_pct: number;
};

export type GroupHit = {
  type: "group";
  id: number;
  name: string;
  account_count: number;
  revenue: number;
};

export type ApiHit = {
  type: "api";
  code: string;
  name: string;
  category: string | null;
};

export type ManualEntryHit = {
  type: "manual_entry";
  id: number;
  client_name: string;
  effective_date: string;
  status: ManualEntryStatus;
  revenue: number;
};

export type VendorHit = {
  type: "vendor";
  vendor_name: string;
  api_count: number;
};

export type AuditHit = {
  type: "audit";
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_email: string;
  created_at: string;
};

export type DocHit = {
  type: "doc";
  kind: "feature" | "guide";
  slug: string;
  title: string;
  summary: string;
  group: string;
  href: string;
};

export type PeriodHit = {
  type: "period";
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  /** Statements cut for this period, and how many are still draft. */
  statement_count: number;
  draft_count: number;
};

export type PersonHit = {
  type: "person";
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  job_title: string | null;
  emoji: string | null;
};

export type SearchResults = {
  accounts: AccountHit[];
  invoices: InvoiceHit[];
  groups: GroupHit[];
  apis: ApiHit[];
  manualEntries: ManualEntryHit[];
  vendors: VendorHit[];
  audit: AuditHit[];
  docs: DocHit[];
  periods: PeriodHit[];
  people: PersonHit[];
};

const EMPTY: SearchResults = {
  accounts: [],
  invoices: [],
  groups: [],
  apis: [],
  manualEntries: [],
  vendors: [],
  audit: [],
  docs: [],
  periods: [],
  people: [],
};

// Flattened help corpus (feature + how-to docs), indexed once. Static in-code
// content, so it's fuzzy-filtered in JS rather than queried.
const DOC_INDEX = [
  ...features.map((f) => ({
    type: "doc" as const,
    kind: "feature" as const,
    slug: f.meta.slug,
    title: f.meta.title,
    summary: f.meta.summary,
    group: f.meta.group,
    href: `/help/features/${f.meta.slug}`,
    role: f.meta.role,
  })),
  ...guides.map((g) => ({
    type: "doc" as const,
    kind: "guide" as const,
    slug: g.meta.slug,
    title: g.meta.title,
    summary: g.meta.summary,
    group: g.meta.group,
    href: `/help/guides/${g.meta.slug}`,
    role: g.meta.role,
  })),
];

/**
 * Build a token-ANDed ILIKE condition over a raw SQL searchable expression.
 * Starts from TRUE so an empty token list is a no-op match-all.
 */
type Fragment = postgres.PendingQuery<postgres.Row[]>;
function tokenMatch(sql: postgres.Sql, tokens: string[], expr: (like: string) => Fragment): Fragment {
  return tokens.reduce<Fragment>((cond, t) => sql`${cond} AND ${expr(`%${t}%`)}`, sql`TRUE`);
}

// ── Query scoping ────────────────────────────────────────────────────────────
//
// The grammar (lib/cmd/query.ts) lets a query name what it's about. Three things
// fall out of that, and all three are about *not* answering the wrong question:
//
//   type:   run only the named corpus
//   status: run only the corpora that understand that status word — otherwise
//           a bare `status:pending` would match every account with the empty
//           string and return the whole book
//   month:  same, scoped to the corpora that are period-shaped

type Corpus =
  | "account" | "invoice" | "group" | "api"
  | "manual_entry" | "vendor" | "audit" | "doc" | "period" | "person";

const TYPE_ALIASES: Record<string, Corpus> = {
  account: "account", accounts: "account", client: "account", clients: "account",
  invoice: "invoice", invoices: "invoice", statement: "invoice", statements: "invoice",
  group: "group", groups: "group",
  api: "api", apis: "api",
  entry: "manual_entry", entries: "manual_entry", manual: "manual_entry",
  vendor: "vendor", vendors: "vendor", cost: "vendor", costs: "vendor",
  audit: "audit", log: "audit",
  doc: "doc", docs: "doc", help: "doc", guide: "doc", guides: "doc",
  period: "period", periods: "period", month: "period", months: "period",
  person: "person", people: "person", user: "person", users: "person", team: "person",
};

// Which status words each corpus understands. A value outside its set means the
// query wasn't about that corpus.
const STATUS_VOCAB: Partial<Record<Corpus, string[]>> = {
  invoice: ["draft", "final", "issued"],
  manual_entry: ["draft", "pending", "pending_approval", "approved", "void"],
  person: ["active", "invited", "disabled"],
};

const PERIOD_SHAPED: Corpus[] = ["invoice", "period", "manual_entry"];

function normStatus(corpus: Corpus, value: string): string | null {
  const v = value.trim().toLowerCase();
  const vocab = STATUS_VOCAB[corpus];
  if (!vocab) return null;
  if (corpus === "manual_entry" && v === "pending") return "pending_approval";
  return vocab.includes(v) ? v : null;
}

/** Builds the per-corpus "should this even run" predicate for a parsed query. */
function scope(parsed: ParsedQuery) {
  const f = parsed.filters;
  const wantedType = f.type ? TYPE_ALIASES[f.type.trim().toLowerCase()] : undefined;

  return function runs(corpus: Corpus): boolean {
    if (wantedType && wantedType !== corpus) return false;
    // A field operator names its corpus: `user:` is only about people and the
    // audit trail.
    if (f.user && corpus !== "person" && corpus !== "audit") return false;
    if (f.api && corpus === "person") return false;
    if (f.status && normStatus(corpus, f.status) === null) return false;
    if (f.month && !PERIOD_SHAPED.includes(corpus)) return false;
    return true;
  };
}

/** Space-joined non-empty parts — the term a given corpus should match on. */
function termOf(...parts: (string | undefined)[]): string {
  return parts.filter((p) => p && p.trim()).join(" ").trim();
}

function toks(term: string): string[] {
  return term.split(/\s+/).filter(Boolean);
}

/** De-slugify a retired slug for display: "acme-ltd" → "Acme Ltd". */
function unslug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function searchEntities(
  rawQuery: string,
  opts: {
    includeSandbox: boolean;
    isAdmin: boolean;
    /** Pre-parsed query; parsed here when the caller didn't. */
    parsed?: ParsedQuery;
  }
): Promise<SearchResults> {
  const parsed = opts.parsed ?? parseQuery(rawQuery);
  const f = parsed.filters;
  const q = parsed.text.trim();
  // Operators alone are a valid query — `status:pending` needs no free text.
  if (!q && !parsed.hasOperators) return EMPTY;

  const sql = getSql();
  const { from, to } = resolvePeriod();
  const { includeSandbox, isAdmin } = opts;

  const runs = scope(parsed);
  const month = f.month ? resolveMonth(f.month) : null;

  // Per-corpus search terms: a field operator contributes only to the corpus it
  // names, so `account:acme api:KY1001` narrows both sides instead of looking
  // for one string containing all of it.
  const accountTerm = termOf(q, f.account, f.group);
  const apiTerm = termOf(q, f.api);
  const groupTerm = termOf(q, f.group);
  const personTerm = termOf(q, f.user);
  const invoiceTerm = termOf(q, f.account, month?.label);
  const entryTerm = termOf(q, f.account);
  const auditTerm = termOf(q, f.user);

  // Every corpus needs *something* to match on; an empty term with a status
  // filter is fine (the status is the query), an empty term with nothing is not.
  const tokens = toks(q);

  const [
    accountSummaries,
    formerSlugRows,
    groupSummaries,
    invoiceRows,
    apiRows,
    manualRows,
    vendorRows,
    auditRows,
    periodRows,
    personRows,
  ] = await Promise.all([
      runs("account")
        ? getAccountSummaries({ from, to, includeSandbox })
        : Promise.resolve([] as Awaited<ReturnType<typeof getAccountSummaries>>),
      // Retired slugs — so an account renamed last month is still findable by
      // what everyone still calls it. client_slugs keeps the old slug alive for
      // the redirect layer; this makes search honour it too.
      runs("account") && accountTerm
        ? sql<{ client_id: number; slug: string }[]>`
            SELECT client_id, slug
            FROM client_slugs
            WHERE is_current = FALSE
              AND ${tokenMatch(sql, toks(accountTerm), (like) => sql`slug ILIKE ${like}`)}
            LIMIT 20
          `
        : Promise.resolve([] as { client_id: number; slug: string }[]),
      runs("group")
        ? getGroupSummaries({ from, to, includeSandbox })
        : Promise.resolve([] as Awaited<ReturnType<typeof getGroupSummaries>>),
      sql<
        {
          client_id: number;
          period_id: number;
          period_label: string;
          number: string;
          status: StatementStatus;
          total_revenue: string;
          total_margin: string;
          client_name: string;
        }[]
      >`
        SELECT s.client_id, s.period_id, s.number, s.status,
               s.total_revenue, s.total_margin,
               c.display_name AS client_name, bp.label AS period_label
        FROM statements s
        JOIN clients c ON c.id = s.client_id
        JOIN billing_periods bp ON bp.id = s.period_id
        WHERE ${runs("invoice")}
          AND (${includeSandbox} OR c.is_sandbox = 0)
          AND ${f.status ? sql`s.status = ${normStatus("invoice", f.status)}` : sql`TRUE`}
          AND ${month ? sql`to_char(bp.start_date, 'YYYY-MM') = ${month.month}` : sql`TRUE`}
          AND ${tokenMatch(sql, toks(invoiceTerm), (like) => sql`(c.display_name || ' ' || s.number || ' ' || bp.label) ILIKE ${like}`)}
        ORDER BY bp.start_date DESC
        LIMIT 6
      `,
      sql<{ product_code: string; name: string; category: string | null }[]>`
        SELECT product_code, name, category
        FROM apis
        WHERE ${runs("api")}
          AND is_active = 1
          AND ${tokenMatch(sql, toks(apiTerm), (like) => sql`(name || ' ' || product_code) ILIKE ${like}`)}
        ORDER BY name
        LIMIT 6
      `,
      sql<
        {
          id: number;
          client_name: string;
          effective_date: string;
          status: ManualEntryStatus;
          total_revenue: string;
        }[]
      >`
        SELECT me.id, me.effective_date, me.status, me.total_revenue,
               c.display_name AS client_name
        FROM manual_entries me
        JOIN clients c ON c.id = me.client_id
        WHERE ${runs("manual_entry")}
          AND (${includeSandbox} OR c.is_sandbox = 0)
          AND ${f.status ? sql`me.status = ${normStatus("manual_entry", f.status)}` : sql`TRUE`}
          AND ${month ? sql`to_char(me.effective_date, 'YYYY-MM') = ${month.month}` : sql`TRUE`}
          AND ${tokenMatch(sql, toks(entryTerm), (like) => sql`(c.display_name || ' ' || me.reason || ' ' || me.status || ' ' || me.effective_date::text) ILIKE ${like}`)}
        ORDER BY me.effective_date DESC
        LIMIT 5
      `,
      // Vendor costs and audit are admin-only surfaces.
      isAdmin && runs("vendor") && q
        ? sql<{ vendor_name: string; api_count: number }[]>`
            SELECT vd.canonical_name AS vendor_name,
                   COUNT(vp.id)::int   AS api_count
            FROM vendors vd
            LEFT JOIN vendor_pricing vp ON vp.vendor_id = vd.id
            -- Aliases are searchable: someone looking for a vendor by the name
            -- it used to have should still find it.
            WHERE ${tokenMatch(sql, tokens, (like) => sql`(vd.canonical_name ILIKE ${like} OR EXISTS (SELECT 1 FROM vendor_aliases va WHERE va.vendor_id = vd.id AND va.alias ILIKE ${like}))`)}
            GROUP BY vd.id, vd.canonical_name
            ORDER BY vd.canonical_name
            LIMIT 4
          `
        : Promise.resolve([] as { vendor_name: string; api_count: number }[]),
      isAdmin && runs("audit")
        ? sql<
            {
              id: number;
              action: string;
              entity_type: string;
              entity_id: string | null;
              created_at: string;
              user_email: string;
            }[]
          >`
            SELECT a.id, a.action, a.entity_type, a.entity_id::text AS entity_id,
                   a.created_at, u.email AS user_email
            FROM audit_log a
            JOIN users u ON u.id = a.user_id
            WHERE ${tokenMatch(sql, toks(auditTerm), (like) => sql`(a.action || ' ' || a.entity_type || ' ' || COALESCE(a.entity_id::text, '') || ' ' || u.email || ' ' || COALESCE(u.display_name, '')) ILIKE ${like}`)}
            ORDER BY a.created_at DESC
            LIMIT 4
          `
        : Promise.resolve(
            [] as {
              id: number;
              action: string;
              entity_type: string;
              entity_id: string | null;
              created_at: string;
              user_email: string;
            }[]
          ),
      // Billing periods — "June 2026" is somewhere you navigate to, not just a
      // word that might appear in an invoice label. Carries how many statements
      // are cut and how many are still draft, which is the operationally useful
      // part.
      runs("period")
        ? sql<{ id: number; label: string; start_date: string; end_date: string; statement_count: number; draft_count: number }[]>`
            SELECT bp.id, bp.label, bp.start_date, bp.end_date,
                   COUNT(s.id)::int AS statement_count,
                   COUNT(s.id) FILTER (WHERE s.status = 'draft')::int AS draft_count
            FROM billing_periods bp
            LEFT JOIN statements s ON s.period_id = bp.id
            WHERE ${
              month
                ? sql`to_char(bp.start_date, 'YYYY-MM') = ${month.month}`
                : tokenMatch(sql, tokens, (like) => sql`(bp.label || ' ' || to_char(bp.start_date, 'YYYY-MM')) ILIKE ${like}`)
            }
            GROUP BY bp.id
            ORDER BY bp.start_date DESC
            LIMIT 4
          `
        : Promise.resolve(
            [] as { id: number; label: string; start_date: string; end_date: string; statement_count: number; draft_count: number }[]
          ),
      // People. Admin-only — the user list is an admin surface, and this reads
      // exactly what /admin/users already shows.
      isAdmin && runs("person") && personTerm
        ? sql<{ id: number; display_name: string; email: string; role: string; status: string; job_title: string | null; emoji: string | null }[]>`
            SELECT id, display_name, email, role, status, job_title, emoji
            FROM users
            WHERE ${f.status ? sql`status = ${normStatus("person", f.status)}` : sql`TRUE`}
              AND ${tokenMatch(sql, toks(personTerm), (like) => sql`(COALESCE(display_name, '') || ' ' || email || ' ' || role || ' ' || COALESCE(job_title, '')) ILIKE ${like}`)}
            ORDER BY status DESC, display_name
            LIMIT 5
          `
        : Promise.resolve(
            [] as { id: number; display_name: string; email: string; role: string; status: string; job_title: string | null; emoji: string | null }[]
          ),
    ]);

  // client_id → the retired slug that matched, for the "formerly …" note.
  const formerByClient = new Map<number, string>();
  for (const r of formerSlugRows) {
    if (!formerByClient.has(Number(r.client_id))) formerByClient.set(Number(r.client_id), r.slug);
  }

  const byName = fuzzyFilter(accountSummaries, accountTerm, ["display_name", "group_name"]);
  // Renamed accounts that the name match missed but a retired slug caught.
  const nameHits = new Set(byName.map((c) => c.client_id));
  const byFormer = formerByClient.size
    ? accountSummaries.filter((c) => formerByClient.has(c.client_id) && !nameHits.has(c.client_id))
    : [];
  const accounts: AccountHit[] = [...byName, ...byFormer]
    .slice(0, 6)
    .map((c) => ({
      type: "account",
      id: c.client_id,
      slug: c.slug ?? generateSlug(c.display_name),
      name: c.display_name,
      has_logo: c.has_logo,
      group_name: c.group_name,
      revenue: c.revenue,
      status_pill: c.status_pill,
      unpriced_pairs: c.unpriced_pairs,
      matched_former_name: nameHits.has(c.client_id)
        ? undefined
        : formerByClient.has(c.client_id)
          ? unslug(formerByClient.get(c.client_id)!)
          : undefined,
    }));

  const groups: GroupHit[] = fuzzyFilter(groupSummaries, groupTerm, ["name"])
    .slice(0, 4)
    .map((a) => ({
      type: "group",
      id: a.id,
      name: a.name,
      account_count: a.account_count,
      revenue: a.revenue,
    }));

  const invoices: InvoiceHit[] = invoiceRows.map((r) => ({
    type: "invoice",
    account_slug: generateSlug(r.client_name),
    client_name: r.client_name,
    period_id: Number(r.period_id),
    period_label: r.period_label,
    number: r.number,
    status: r.status,
    revenue: toNumber(r.total_revenue),
    margin_pct: marginPct(r.total_margin, r.total_revenue),
  }));

  const apis: ApiHit[] = apiRows.map((r) => ({
    type: "api",
    code: r.product_code,
    name: r.name,
    category: r.category,
  }));

  const manualEntries: ManualEntryHit[] = manualRows.map((r) => ({
    type: "manual_entry",
    id: Number(r.id),
    client_name: r.client_name,
    effective_date: r.effective_date,
    status: r.status,
    revenue: toNumber(r.total_revenue),
  }));

  const vendors: VendorHit[] = vendorRows.map((r) => ({
    type: "vendor",
    vendor_name: r.vendor_name,
    api_count: Number(r.api_count),
  }));

  const audit: AuditHit[] = auditRows.map((r) => ({
    type: "audit",
    id: Number(r.id),
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    user_email: r.user_email,
    created_at: r.created_at,
  }));

  const docs: DocHit[] = runs("doc")
    ? fuzzyFilter(DOC_INDEX.filter((d) => isAdmin || d.role === "all"), q, [
        "title",
        "summary",
        "group",
      ])
        .slice(0, 5)
        .map(({ role: _role, ...d }) => d)
    : [];

  const periods: PeriodHit[] = periodRows.map((r) => ({
    type: "period",
    id: Number(r.id),
    label: r.label,
    start_date: r.start_date,
    end_date: r.end_date,
    statement_count: Number(r.statement_count),
    draft_count: Number(r.draft_count),
  }));

  const people: PersonHit[] = personRows.map((r) => ({
    type: "person",
    id: Number(r.id),
    name: r.display_name,
    email: r.email,
    role: r.role,
    status: r.status,
    job_title: r.job_title,
    emoji: r.emoji,
  }));

  // `-term` exclusions, applied to each hit's visible text. Done here rather
  // than in SQL so one rule covers the cached reads (accounts, groups) and the
  // in-JS corpora (docs) as well as the queried ones.
  const ex = parsed.excludes;
  const keep = <T>(rows: T[], text: (r: T) => string) =>
    ex.length ? rows.filter((r) => passesExcludes(text(r), ex)) : rows;

  return {
    accounts: keep(accounts, (a) => `${a.name} ${a.group_name ?? ""} ${a.status_pill}`),
    invoices: keep(invoices, (i) => `${i.client_name} ${i.period_label} ${i.number} ${i.status}`),
    groups: keep(groups, (g) => g.name),
    apis: keep(apis, (a) => `${a.name} ${a.code} ${a.category ?? ""}`),
    manualEntries: keep(manualEntries, (m) => `${m.client_name} ${m.status} ${m.effective_date}`),
    vendors: keep(vendors, (v) => v.vendor_name),
    audit: keep(audit, (a) => `${a.action} ${a.entity_type} ${a.user_email}`),
    docs: keep(docs, (d) => `${d.title} ${d.summary} ${d.group}`),
    periods: keep(periods, (p) => p.label),
    people: keep(people, (p) => `${p.name} ${p.email} ${p.role} ${p.job_title ?? ""}`),
  };
}
