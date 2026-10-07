// Per-account and per-group reads.

import getSql from "../db";
import { formatNumber } from "../format";
import { generateSlug } from "../slug";
import type { DailySeriesRow, ActivityDay } from "./types";
import { toNumber } from "../money";
import { slabRevenueByAccount, slabBreakdownByApi, type SlabBandAgg } from "./slab-revenue";
import { vendorVolumeCostByApi, vendorVolumeCostByDate } from "./vendor-volume-cost";
import { cachedRevenueRead, revalidateRevenue } from "../cache";
import { todayIST } from "./periods";

// Cached wrappers — keyed by their args; busted by revalidateRevenue().
// Only reads that depend *solely* on usage_daily_with_revenue are cached here;
// getAccountApiBreakdown is deliberately left uncached because its `billed` flag
// reads statement_lines, which invoice finalize busts via revalidatePath (not
// the revenue tag) — caching it would make that badge go stale.
export const getAccountSummaries = cachedRevenueRead(getAccountSummariesImpl, ["getAccountSummaries"]);
export const getAccountDailySeries = cachedRevenueRead(getAccountDailySeriesImpl, ["getAccountDailySeries"]);
export const getAccountActivity = cachedRevenueRead(getAccountActivityImpl, ["getAccountActivity"]);
export const getAccountTopApi = cachedRevenueRead(getAccountTopApiImpl, ["getAccountTopApi"]);

export type AccountTopApi = {
  api_code: string;
  api_name: string;
  hits: number;
  revenue: number;
};

export type AccountSummary = {
  client_id: number;
  display_name: string;
  slug: string | null;
  has_logo: boolean;
  account_id: number | null;
  group_name: string | null;
  is_sandbox: number;
  status_pill: "leak" | "historical" | "sandbox" | "ok";
  // True when a non-sandbox account has had logged usage for over a week but has
  // no MSA on file (or its MSA has lapsed). Surfaces a "No MSA" flag.
  msa_missing: boolean;
  revenue: number;
  hits: number;
  apis_used: number;
  // Totals exclude dismissed pairs. unpriced_* = active + historical.
  unpriced_pairs: number;
  unpriced_hits: number;
  // Active = no price in effect as of today (urgent). Historical = priced now,
  // but had unpriced hits before the price's effective date (dismissible).
  active_unpriced_pairs: number;
  active_unpriced_hits: number;
  historical_unpriced_pairs: number;
  historical_unpriced_hits: number;
  last_activity: string | null;
  briefing: string;
  spark: number[];
  top_apis: AccountTopApi[];
  peak_day: { date: string; hits: number } | null;
  active_days: number;
};

export type AccountApiBreakdown = {
  api_code: string;
  api_name: string;
  successful: number;
  successful_no_data: number;
  failed: number;
  in_progress: number;
  hits: number;
  manual_hits: number;
  price_s: number;
  price_snd: number;
  price_f: number;
  price_ip: number;
  vendor: string;
  vendor_cost: number;
  revenue: number;
  margin: number;
  margin_pct: number;
  /** Volume pricing (tier or slab) — revenue is recomputed at the period level, not from the per-day view. */
  is_slab: boolean;
  /** Per-bracket hits + revenue (computed per month, summed over the window). Empty unless is_slab. */
  slab_bands: SlabBandAgg[];
  billed: boolean;
  /** Hits in the window that fell on days with no price in effect (per-day truth). */
  unpriced_hits: number;
  /** none → no unpriced hits. active → no current price. historical → priced now
   *  but had earlier unpriced hits. dismissed → historical, acknowledged as fixed. */
  leak_state: "none" | "active" | "historical" | "dismissed";
  /** Set when the API is stitched into a bundle — bills via the bundle, never "unpriced". */
  bundle_id: number | null;
  bundle_name: string | null;
  bundle_anchor: boolean;
};

function composeBriefing(o: {
  revenue: number;
  hits: number;
  apis_used: number;
  unpriced_pairs: number;
  unpriced_hits: number;
  is_sandbox: number;
}): string {
  if (o.is_sandbox) {
    return `Sandbox traffic — ${formatNumber(o.hits)} hits across ${o.apis_used} APIs. Excluded from headline by default.`;
  }
  const parts: string[] = [];
  parts.push(`${formatNumber(o.hits)} hits across ${o.apis_used} APIs`);
  if (o.unpriced_pairs > 0) {
    parts.push(
      `${o.unpriced_pairs} (account, api) pair${o.unpriced_pairs === 1 ? "" : "s"} unpriced — ${formatNumber(o.unpriced_hits)} hits at risk`
    );
  }
  return parts.join(" · ");
}

export class AccountConflictError extends Error {
  constructor(public field: "display_name" | "slug" | "client_code") {
    super(`Conflict on ${field}`);
  }
}

export async function createAccount(input: {
  display_name: string;
  billing_entity?: string | null;
  account_id?: number | null;
  slug: string;
}): Promise<{ id: number; slug: string }> {
  const sql = getSql();
  try {
    const [row] = await sql`
      INSERT INTO clients (display_name, billing_entity, account_id, slug, log_aliases, status, is_sandbox)
      VALUES (
        ${input.display_name},
        ${input.billing_entity ?? null},
        ${input.account_id ?? null},
        ${input.slug},
        ${"[]"},
        ${"active"},
        ${0}
      )
      RETURNING id, slug
    `;
    await sql`
      INSERT INTO client_slugs (slug, client_id, is_current)
      VALUES (${row.slug}, ${Number(row.id)}, TRUE)
      ON CONFLICT (slug) DO NOTHING
    `;
    return { id: Number(row.id), slug: row.slug as string };
  } catch (err: any) {
    // Postgres unique constraint violation
    if (err?.code === "23505") {
      const detail: string = err.detail ?? "";
      const field = detail.includes("slug") ? "slug" : "display_name";
      throw new AccountConflictError(field);
    }
    throw err;
  }
}

export type AccountProfileFields = {
  display_name: string;
  client_code: string | null;
  billing_entity: string | null;
  website: string | null;
  cs_owner: string | null;
  sales_owner: string | null;
  logo_data_url: string | null;
  msa_url: string | null;
  msa_start_date: string | null;
  msa_end_date: string | null;
};

/** Update an account's editable profile metadata. Throws AccountConflictError on a
 *  duplicate display_name or client_code (the two unique fields here).
 *
 *  A rename recomputes the slug from the new name so the URL follows the name.
 *  The previous slug is retained in client_slugs (is_current = FALSE) so old
 *  links 301-redirect to the new one via resolveAccountSlug. Returns the account's
 *  current slug (unchanged when the name didn't move the slug). */
export async function updateAccountProfile(
  id: number,
  fields: AccountProfileFields
): Promise<{ slug: string }> {
  const sql = getSql();
  const newSlug = generateSlug(fields.display_name);
  try {
    return await sql.begin(async (tx) => {
      const [cur] = await tx`SELECT slug FROM clients WHERE id = ${id}`;
      const oldSlug = cur?.slug as string | undefined;

      await tx`
        UPDATE clients SET
          display_name  = ${fields.display_name},
          client_code   = ${fields.client_code},
          billing_entity = ${fields.billing_entity},
          website       = ${fields.website},
          cs_owner      = ${fields.cs_owner},
          sales_owner   = ${fields.sales_owner},
          logo_data_url = ${fields.logo_data_url},
          msa_url        = ${fields.msa_url},
          msa_start_date = ${fields.msa_start_date},
          msa_end_date   = ${fields.msa_end_date},
          slug          = ${newSlug}
        WHERE id = ${id}
      `;

      if (newSlug !== oldSlug) {
        // A slug already owned by a *different* account (current or historical)
        // is a genuine name collision — surface it like the display_name dup.
        const [owner] = await tx`SELECT client_id FROM client_slugs WHERE slug = ${newSlug}`;
        if (owner && Number(owner.client_id) !== id) {
          throw new AccountConflictError("display_name");
        }
        await tx`UPDATE client_slugs SET is_current = FALSE WHERE client_id = ${id}`;
        if (owner) {
          // Renaming back to a slug this account held before — promote it.
          await tx`UPDATE client_slugs SET is_current = TRUE WHERE slug = ${newSlug}`;
        } else {
          await tx`INSERT INTO client_slugs (slug, client_id, is_current) VALUES (${newSlug}, ${id}, TRUE)`;
        }
        // Keep the outgoing slug as a redirect source (adds it if it was never recorded).
        if (oldSlug) {
          await tx`
            INSERT INTO client_slugs (slug, client_id, is_current)
            VALUES (${oldSlug}, ${id}, FALSE)
            ON CONFLICT (slug) DO NOTHING
          `;
        }
      }
      return { slug: newSlug };
    });
  } catch (err: any) {
    if (err instanceof AccountConflictError) throw err;
    if (err?.code === "23505") {
      const detail: string = err.detail ?? "";
      throw new AccountConflictError(detail.includes("client_code") ? "client_code" : "display_name");
    }
    throw err;
  }
}

/** Given a slug that no live account currently uses, return the account's current
 *  slug if the given one is a historical alias — else null. Drives the redirect
 *  from an old (post-rename) URL to the canonical one. */
export async function resolveAccountSlug(slug: string): Promise<string | null> {
  const sql = getSql();
  const [row] = await sql`
    SELECT c.slug AS current_slug
    FROM client_slugs h JOIN clients c ON c.id = h.client_id
    WHERE h.slug = ${slug}
  `;
  const current = row?.current_slug as string | undefined;
  return current && current !== slug ? current : null;
}

/**
 * Logos (base64 data URIs) for a set of accounts, keyed by id. Accounts without a
 * stored logo are omitted. Kept out of getAccountSummaries so the cached summary
 * payload stays free of heavy base64 blobs — callers fetch only the ids they
 * actually render (e.g. the dashboard portfolio visuals).
 */
export async function getAccountLogos(ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const sql = getSql();
  const rows = await sql`
    SELECT id, logo_data_url FROM clients
    WHERE id = ANY(${ids}) AND logo_data_url IS NOT NULL
  `;
  return new Map((rows as any[]).map((r) => [Number(r.id), r.logo_data_url as string]));
}

export async function listAccounts(): Promise<any[]> {
  const sql = getSql();
  return sql`
    SELECT id, display_name, account_id, is_sandbox FROM clients
    WHERE deleted_at IS NULL ORDER BY display_name
  ` as unknown as Promise<any[]>;
}

export async function listGroups(): Promise<any[]> {
  const sql = getSql();
  return sql`SELECT id, name FROM accounts ORDER BY name` as unknown as Promise<any[]>;
}

export class GroupConflictError extends Error {
  constructor() {
    super("Conflict on group name");
  }
}

export async function createGroup(name: string): Promise<{ id: number; name: string }> {
  const sql = getSql();
  try {
    const [row] = await sql`
      INSERT INTO accounts (name) VALUES (${name}) RETURNING id, name
    `;
    return { id: Number(row.id), name: row.name as string };
  } catch (err: any) {
    if (err?.code === "23505") throw new GroupConflictError();
    throw err;
  }
}

export async function updateGroup(id: number, name: string): Promise<{ id: number; name: string } | null> {
  const sql = getSql();
  try {
    const [row] = await sql`UPDATE accounts SET name = ${name} WHERE id = ${id} RETURNING id, name`;
    return row ? { id: Number(row.id), name: row.name as string } : null;
  } catch (err: any) {
    if (err?.code === "23505") throw new GroupConflictError();
    throw err;
  }
}

/** Delete a group. Members are orphaned to "(None)" via the FK's ON DELETE SET NULL. */
export async function deleteGroup(id: number): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`DELETE FROM accounts WHERE id = ${id} RETURNING id`;
  const deleted = (rows as any[]).length > 0;
  if (deleted) revalidateRevenue();
  return deleted;
}

/** Move every member of `fromId` to `toId`, then delete the now-empty source group. */
export async function mergeGroup(fromId: number, toId: number): Promise<boolean> {
  if (fromId === toId) return false;
  const sql = getSql();
  let moved = false;
  await sql.begin(async (tx) => {
    const [target] = await tx`SELECT id FROM accounts WHERE id = ${toId}`;
    const [source] = await tx`SELECT id FROM accounts WHERE id = ${fromId}`;
    if (!target || !source) return;
    await tx`UPDATE clients SET account_id = ${toId} WHERE account_id = ${fromId}`;
    await tx`DELETE FROM accounts WHERE id = ${fromId}`;
    moved = true;
  });
  if (moved) revalidateRevenue();
  return moved;
}

/** Set (or clear, with null) an account's group. */
export async function reassignAccountGroup(accountId: number, groupId: number | null): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`UPDATE clients SET account_id = ${groupId} WHERE id = ${accountId} RETURNING id`;
  const updated = (rows as any[]).length > 0;
  if (updated) revalidateRevenue();
  return updated;
}

export type GroupSummary = {
  id: number;
  name: string;
  created_at: string | null;
  account_count: number;
  active_count: number;
  revenue: number;
  /** Highest-revenue member that has a logo; the list shows its logo as the group avatar. */
  logo_account: { display_name: string; slug: string | null } | null;
};

/**
 * All groups with membership counts (from the accounts table, so zero-traffic
 * members still count) and MTD revenue rolled up from the cached account reads.
 */
export async function getGroupSummaries(opts: {
  from: string;
  to: string;
  includeSandbox?: boolean;
}): Promise<GroupSummary[]> {
  const sql = getSql();
  const [groups, counts, summaries] = await Promise.all([
    sql`SELECT id, name, created_at FROM accounts ORDER BY name`,
    sql`
      SELECT account_id,
             COUNT(*)::int AS account_count,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::int AS active_count
      FROM clients WHERE account_id IS NOT NULL GROUP BY account_id
    `,
    getAccountSummaries({ from: opts.from, to: opts.to, includeSandbox: opts.includeSandbox }),
  ]);

  const revByGroup = new Map<number, number>();
  const logoByGroup = new Map<number, (typeof summaries)[number]>();
  for (const s of summaries) {
    if (s.account_id == null) continue;
    revByGroup.set(s.account_id, (revByGroup.get(s.account_id) ?? 0) + s.revenue);
    const cur = logoByGroup.get(s.account_id);
    if (s.has_logo && (!cur || s.revenue > cur.revenue)) logoByGroup.set(s.account_id, s);
  }
  const countByGroup = new Map(
    (counts as any[]).map((c) => [Number(c.account_id), c])
  );

  return (groups as any[]).map((a) => {
    const c = countByGroup.get(Number(a.id));
    const top = logoByGroup.get(Number(a.id));
    return {
      id: Number(a.id),
      name: a.name as string,
      created_at: a.created_at ?? null,
      account_count: c ? Number(c.account_count) : 0,
      active_count: c ? Number(c.active_count) : 0,
      revenue: revByGroup.get(Number(a.id)) ?? 0,
      logo_account: top ? { display_name: top.display_name, slug: top.slug } : null,
    };
  });
}

export type GroupMember = {
  id: number;
  display_name: string;
  slug: string | null;
  has_logo: boolean;
  status: string;
  is_sandbox: number;
  revenue: number;
  hits: number;
  last_activity: string | null;
};

export type GroupDetail = {
  id: number;
  name: string;
  created_at: string | null;
  members: GroupMember[];
};

/** One group plus its member accounts (all of them — including zero-traffic). */
export async function getGroupDetail(
  id: number,
  opts: { from: string; to: string; includeSandbox?: boolean }
): Promise<GroupDetail | null> {
  const sql = getSql();
  const [acct] = await sql`SELECT id, name, created_at FROM accounts WHERE id = ${id}`;
  if (!acct) return null;

  const [members, summaries] = await Promise.all([
    sql`SELECT id, display_name, slug, (logo_data_url IS NOT NULL) AS has_logo, status, is_sandbox FROM clients WHERE account_id = ${id} AND deleted_at IS NULL ORDER BY display_name`,
    // Honor the same sandbox toggle as the groups list (default off) so the
    // two pages agree; sandbox members still appear in the list below, at ₹0
    // when excluded.
    getAccountSummaries({ from: opts.from, to: opts.to, includeSandbox: opts.includeSandbox }),
  ]);
  const sById = new Map(summaries.map((s) => [s.client_id, s]));

  return {
    id: Number(acct.id),
    name: acct.name as string,
    created_at: acct.created_at ?? null,
    members: (members as any[]).map((m) => {
      const s = sById.get(Number(m.id));
      return {
        id: Number(m.id),
        display_name: m.display_name as string,
        slug: (m.slug as string | null) ?? null,
        has_logo: Boolean(m.has_logo),
        status: m.status as string,
        is_sandbox: Number(m.is_sandbox),
        revenue: s?.revenue ?? 0,
        hits: s?.hits ?? 0,
        last_activity: s?.last_activity ?? null,
      };
    }),
  };
}

export async function getAccount(id: number): Promise<any> {
  const sql = getSql();
  const [row] = await sql`
    SELECT c.*, a.name AS group_name
    FROM clients c LEFT JOIN accounts a ON a.id = c.account_id
    WHERE c.id = ${id}
  `;
  return row ?? null;
}

export async function getAccountBySlug(slug: string): Promise<any> {
  const sql = getSql();
  const [row] = await sql`
    SELECT c.*, a.name AS group_name
    FROM clients c LEFT JOIN accounts a ON a.id = c.account_id
    WHERE c.slug = ${slug}
  `;
  return row ?? null;
}

async function getAccountSummariesImpl(opts: {
  from: string;
  to: string;
  includeSandbox?: boolean;
}): Promise<AccountSummary[]> {
  const sql = getSql();
  const today = todayIST();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;

  const [rows, leakRows, groupRows, groups, sparkRows, topApiRows, firstActivityRows] = await Promise.all([
    // Driven from the accounts table (not the usage view) so freshly created
    // accounts with no usage in the window still appear, with zeroed metrics.
    sql`
      SELECT
        c.id AS client_id,
        c.display_name AS display_name,
        c.msa_start_date AS msa_start_date,
        c.msa_end_date AS msa_end_date,
        COALESCE(agg.is_sandbox, c.is_sandbox) AS is_sandbox,
        COALESCE(agg.revenue, 0) AS revenue,
        COALESCE(agg.hits, 0) AS hits,
        COALESCE(agg.apis_used, 0) AS apis_used,
        agg.last_activity AS last_activity
      FROM clients c
      LEFT JOIN (
        SELECT
          v.client_id,
          MAX(v.is_sandbox) AS is_sandbox,
          SUM(revenue) AS revenue,
          SUM(successful + successful_no_data + failed + in_progress) AS hits,
          COUNT(DISTINCT v.api_code) AS apis_used,
          MAX(v.date) AS last_activity
        FROM usage_daily_with_revenue v
        WHERE v.client_id IS NOT NULL
          AND v.date BETWEEN ${opts.from} AND ${opts.to}
        ${sandboxCond}
        GROUP BY v.client_id
      ) agg ON agg.client_id = c.id
      WHERE c.deleted_at IS NULL
      ${opts.includeSandbox ? sql`` : sql`AND c.is_sandbox = 0`}
    `,
    // Per-account leak classification (per-day truth). A pair is unpriced for a
    // day when that day had no price in effect. We split those hits into:
    //   active     — the pair has no price in effect as of today
    //   historical — the pair is priced now, but had unpriced hits earlier
    // and drop pairs the operator has dismissed as fixed. `priced` is the set of
    // pairs with a non-zero price effective on/before today (IST).
    sql`
      WITH priced AS (
        SELECT DISTINCT client_id, api_code
        FROM pricing
        WHERE effective_from <= ${today}
          AND (price_successful > 0 OR price_successful_no_data > 0
               OR price_failed > 0 OR price_in_progress > 0)
      )
      SELECT
        vu.client_id,
        COALESCE(SUM(CASE WHEN vu.unp AND pr.api_code IS NULL THEN vu.h ELSE 0 END), 0) AS active_hits,
        COUNT(DISTINCT CASE WHEN vu.unp AND pr.api_code IS NULL THEN vu.api_code END) AS active_pairs,
        COALESCE(SUM(CASE WHEN vu.unp AND pr.api_code IS NOT NULL AND d.api_code IS NULL THEN vu.h ELSE 0 END), 0) AS hist_hits,
        COUNT(DISTINCT CASE WHEN vu.unp AND pr.api_code IS NOT NULL AND d.api_code IS NULL THEN vu.api_code END) AS hist_pairs
      FROM (
        SELECT v.client_id, v.api_code,
          (v.successful + v.successful_no_data + v.failed + v.in_progress) AS h,
          (v.p_s = 0 AND v.p_snd = 0 AND v.p_f = 0 AND v.p_ip = 0
           AND v.bundle_id IS NULL AND v.p_model NOT IN ('slab', 'tier')
           AND (v.successful + v.successful_no_data + v.failed + v.in_progress) > 0) AS unp
        FROM usage_daily_with_revenue v
        WHERE v.client_id IS NOT NULL
          AND v.date BETWEEN ${opts.from} AND ${opts.to}
        ${sandboxCond}
      ) vu
      LEFT JOIN priced pr ON pr.client_id = vu.client_id AND pr.api_code = vu.api_code
      LEFT JOIN leak_dismissals d ON d.client_id = vu.client_id AND d.api_code = vu.api_code
      GROUP BY vu.client_id
    `,
    sql`SELECT id, account_id, slug, (logo_data_url IS NOT NULL) AS has_logo FROM clients`,
    sql`SELECT id, name FROM accounts`,
    sql`
      SELECT v.client_id, v.date,
        SUM(revenue) AS revenue,
        SUM(successful + successful_no_data + failed + in_progress) AS hits
      FROM usage_daily_with_revenue v
      WHERE v.client_id IS NOT NULL AND v.date BETWEEN ${opts.from} AND ${opts.to}
      GROUP BY v.client_id, v.date
    `,
    sql`
      SELECT client_id, api_code, api_name, hits, revenue, rn
      FROM (
        SELECT
          v.client_id,
          v.api_code,
          v.api_name,
          SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits,
          SUM(v.revenue) AS revenue,
          ROW_NUMBER() OVER (
            PARTITION BY v.client_id
            ORDER BY SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) DESC
          ) AS rn
        FROM usage_daily_with_revenue v
        WHERE v.client_id IS NOT NULL AND v.api_code IS NOT NULL
          AND v.date BETWEEN ${opts.from} AND ${opts.to}
        GROUP BY v.client_id, v.api_code, v.api_name
      ) sub
      WHERE rn <= 3
    `,
    // All-time earliest logged usage per account — drives the "logged usage for
    // over a week" half of the missing-MSA flag (independent of the window).
    sql`
      SELECT client_id, MIN(date) AS first_date
      FROM usage_daily_with_revenue
      WHERE client_id IS NOT NULL
      GROUP BY client_id
    `,
  ]);

  // Volume-priced APIs (tier/slab) read as 0 in the per-day view; add each
  // account's recomputed volume revenue for the window back onto the totals
  // (and movers deltas).
  const slabByAccount = await slabRevenueByAccount({
    from: opts.from,
    to: opts.to,
    includeSandbox: opts.includeSandbox,
  });

  const groupIdByAccount = new Map(
    (groupRows as any[]).map((a) => [Number(a.id), a.account_id != null ? Number(a.account_id) : null])
  );
  const slugByAccount = new Map(
    (groupRows as any[]).map((a) => [Number(a.id), (a.slug as string | null) ?? null])
  );
  const hasLogoByAccount = new Map(
    (groupRows as any[]).map((a) => [Number(a.id), Boolean(a.has_logo)])
  );
  const groupNamesById = new Map(
    (groups as any[]).map((a) => [Number(a.id), a.name as string])
  );

  const sparkByAccount = new Map<number, Map<string, number>>();
  const dailyHitsByAccount = new Map<number, Map<string, number>>();
  for (const s of sparkRows as any[]) {
    const cid = Number(s.client_id);
    if (!sparkByAccount.has(cid)) sparkByAccount.set(cid, new Map());
    sparkByAccount.get(cid)!.set(s.date, toNumber(s.revenue));
    if (!dailyHitsByAccount.has(cid)) dailyHitsByAccount.set(cid, new Map());
    dailyHitsByAccount.get(cid)!.set(s.date, Number(s.hits ?? 0));
  }

  const topApisByAccount = new Map<number, AccountTopApi[]>();
  for (const t of topApiRows as any[]) {
    const cid = Number(t.client_id);
    if (!topApisByAccount.has(cid)) topApisByAccount.set(cid, []);
    topApisByAccount.get(cid)!.push({
      api_code: t.api_code,
      api_name: t.api_name ?? t.api_code,
      hits: Number(t.hits ?? 0),
      revenue: toNumber(t.revenue),
    });
  }

  const firstActivityByAccount = new Map<number, string>();
  for (const f of firstActivityRows as any[]) {
    if (f.first_date) firstActivityByAccount.set(Number(f.client_id), String(f.first_date).slice(0, 10));
  }
  // An account is flagged when its earliest usage is more than a week old.
  const msaUsageCutoff = new Date(today);
  msaUsageCutoff.setDate(msaUsageCutoff.getDate() - 7);
  const msaCutoffIso = msaUsageCutoff.toISOString().slice(0, 10);

  const leakByAccount = new Map<
    number,
    { active_hits: number; active_pairs: number; hist_hits: number; hist_pairs: number }
  >();
  for (const l of leakRows as any[]) {
    leakByAccount.set(Number(l.client_id), {
      active_hits: Number(l.active_hits ?? 0),
      active_pairs: Number(l.active_pairs ?? 0),
      hist_hits: Number(l.hist_hits ?? 0),
      hist_pairs: Number(l.hist_pairs ?? 0),
    });
  }

  // Build date range for spark
  const dateRange: string[] = [];
  {
    const start = new Date(opts.from);
    const end = new Date(opts.to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dateRange.push(d.toISOString().slice(0, 10));
    }
  }

  return (rows as any[]).map((r) => {
    const cid = Number(r.client_id);
    const revenue = toNumber(r.revenue) + (slabByAccount.get(cid) ?? 0);
    const groupId = groupIdByAccount.get(cid) ?? null;
    const groupName = groupId != null ? groupNamesById.get(groupId) ?? null : null;
    const spark = dateRange.map((d) => sparkByAccount.get(cid)?.get(d) ?? 0);

    const hits = Number(r.hits ?? 0);
    const leak = leakByAccount.get(cid) ?? { active_hits: 0, active_pairs: 0, hist_hits: 0, hist_pairs: 0 };
    const active_unpriced_hits = leak.active_hits;
    const active_unpriced_pairs = leak.active_pairs;
    const historical_unpriced_hits = leak.hist_hits;
    const historical_unpriced_pairs = leak.hist_pairs;
    const unpriced_hits = active_unpriced_hits + historical_unpriced_hits;
    const unpriced_pairs = active_unpriced_pairs + historical_unpriced_pairs;

    // Active (no current price) outranks historical (priced, residual past
    // hits). Both use the same >20%-of-traffic noise floor as before.
    let status_pill: AccountSummary["status_pill"] = "ok";
    if (r.is_sandbox) status_pill = "sandbox";
    else if (active_unpriced_hits > 0 && active_unpriced_hits / Math.max(hits, 1) > 0.2) status_pill = "leak";
    else if (historical_unpriced_hits > 0 && historical_unpriced_hits / Math.max(hits, 1) > 0.2)
      status_pill = "historical";

    // MSA in place = has a start date and has not lapsed (end date absent or
    // still in the future). Missing-MSA flag only applies to non-sandbox accounts
    // that have been generating usage for over a week.
    const msaStart = r.msa_start_date ? String(r.msa_start_date).slice(0, 10) : null;
    const msaEnd = r.msa_end_date ? String(r.msa_end_date).slice(0, 10) : null;
    const msaInPlace = msaStart != null && (msaEnd == null || msaEnd >= today);
    const firstDate = firstActivityByAccount.get(cid) ?? null;
    const msa_missing =
      !Number(r.is_sandbox) && firstDate != null && firstDate <= msaCutoffIso && !msaInPlace;

    const briefing = composeBriefing({
      revenue,
      hits,
      apis_used: Number(r.apis_used ?? 0),
      unpriced_pairs,
      unpriced_hits,
      is_sandbox: Number(r.is_sandbox),
    });

    const dailyHits = dailyHitsByAccount.get(cid);
    let peak: { date: string; hits: number } | null = null;
    let activeDays = 0;
    if (dailyHits) {
      for (const [date, h] of dailyHits) {
        if (h > 0) activeDays++;
        if (!peak || h > peak.hits) peak = { date, hits: h };
      }
    }

    return {
      client_id: cid,
      display_name: r.display_name,
      slug: slugByAccount.get(cid) ?? null,
      has_logo: hasLogoByAccount.get(cid) ?? false,
      account_id: groupId,
      group_name: groupName,
      is_sandbox: Number(r.is_sandbox),
      status_pill,
      msa_missing,
      revenue,
      hits,
      apis_used: Number(r.apis_used ?? 0),
      unpriced_pairs,
      unpriced_hits,
      active_unpriced_pairs,
      active_unpriced_hits,
      historical_unpriced_pairs,
      historical_unpriced_hits,
      last_activity: r.last_activity,
      briefing,
      spark,
      top_apis: topApisByAccount.get(cid) ?? [],
      peak_day: peak,
      active_days: activeDays,
    };
  });
}

export async function getAccountApiBreakdown(
  accountId: number,
  opts: { from: string; to: string; includeSandbox?: boolean }
): Promise<AccountApiBreakdown[]> {
  const sql = getSql();
  const today = todayIST();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;

  const [rows, billedRows, pricedRows, dismissedRows, slabCorr, volumeCost] = await Promise.all([
    sql`
      SELECT
        v.api_code,
        v.api_name,
        SUM(v.successful)         AS successful,
        SUM(v.successful_no_data) AS successful_no_data,
        SUM(v.failed)             AS failed,
        SUM(v.in_progress)        AS in_progress,
        SUM(CASE WHEN v.source IN ('manual','import')
                 THEN v.successful + v.successful_no_data + v.failed + v.in_progress
                 ELSE 0 END)      AS manual_hits,
        SUM(v.revenue)            AS revenue,
        SUM(v.vendor_cost)        AS vendor_cost,
        -- Per-day truth: hits on days that had no price in effect.
        SUM(CASE WHEN v.p_s = 0 AND v.p_snd = 0 AND v.p_f = 0 AND v.p_ip = 0
                 AND v.bundle_id IS NULL AND v.p_model NOT IN ('slab', 'tier')
                 AND (v.successful + v.successful_no_data + v.failed + v.in_progress) > 0
                 THEN (v.successful + v.successful_no_data + v.failed + v.in_progress)
                 ELSE 0 END)      AS unpriced_hits,
        MAX(v.p_s)   AS p_s,
        MAX(v.p_snd) AS p_snd,
        MAX(v.p_f)   AS p_f,
        MAX(v.p_ip)  AS p_ip,
        MAX(v.bundle_id)   AS bundle_id,
        MAX(v.bundle_name) AS bundle_name,
        MAX(v.bundle_anchor) AS bundle_anchor,
        MAX(CASE WHEN v.p_model IN ('slab', 'tier') THEN 1 ELSE 0 END) AS is_slab
      FROM usage_daily_with_revenue v
      WHERE v.client_id = ${accountId} AND v.date BETWEEN ${opts.from} AND ${opts.to}
      ${sandboxCond}
      GROUP BY v.api_code, v.api_name
      ORDER BY revenue DESC,
               (SUM(v.successful) + SUM(v.successful_no_data) + SUM(v.failed) + SUM(v.in_progress)) DESC
    `,
    sql`
      SELECT DISTINCT sl.api_code
      FROM statement_lines sl
      JOIN statements s ON s.id = sl.statement_id
      WHERE s.client_id = ${accountId} AND s.status IN ('final','issued')
    `,
    sql`
      SELECT DISTINCT api_code FROM pricing
      WHERE client_id = ${accountId} AND effective_from <= ${today}
        AND (price_successful > 0 OR price_successful_no_data > 0
             OR price_failed > 0 OR price_in_progress > 0)
    `,
    sql`SELECT api_code FROM leak_dismissals WHERE client_id = ${accountId}`,
    // Volume-priced APIs (tier/slab) price to ₹0 in the per-day view (their
    // period-total math can't live there). Recompute their revenue PER CALENDAR
    // MONTH (brackets reset monthly — the billing truth) and add it back, with a
    // per-bracket breakdown. includeSandbox matches this read's sandbox filter.
    slabBreakdownByApi({ accountId, from: opts.from, to: opts.to, includeSandbox: !!opts.includeSandbox }),
    // And the mirror of it on the cost side: a vendor rate that changes with
    // volume also costs ₹0 per day, so this account's share of the month's
    // real cost is added back per API.
    vendorVolumeCostByApi({ clientId: accountId, from: opts.from, to: opts.to, includeSandbox: !!opts.includeSandbox }),
  ]);

  const billedCodes = new Set((billedRows as any[]).map((r) => r.api_code));
  const pricedCodes = new Set((pricedRows as any[]).map((r) => r.api_code));
  const dismissedCodes = new Set((dismissedRows as any[]).map((r) => r.api_code));

  const mapped = (rows as any[]).map((r) => {
    const successful = Number(r.successful ?? 0);
    const successful_no_data = Number(r.successful_no_data ?? 0);
    const failed = Number(r.failed ?? 0);
    const in_progress = Number(r.in_progress ?? 0);
    const hits = successful + successful_no_data + failed + in_progress;
    // View revenue is 0 for volume-priced days; add the per-month revenue.
    const slab = slabCorr.get(r.api_code);
    const revenue = toNumber(r.revenue) + (slab?.revenue ?? 0);
    const vendor_cost = toNumber(r.vendor_cost) + (volumeCost.get(r.api_code) ?? 0);
    const margin = revenue - vendor_cost;
    const unpriced_hits = Number(r.unpriced_hits ?? 0);
    let leak_state: AccountApiBreakdown["leak_state"] = "none";
    if (unpriced_hits > 0) {
      if (!pricedCodes.has(r.api_code)) leak_state = "active";
      else if (dismissedCodes.has(r.api_code)) leak_state = "dismissed";
      else leak_state = "historical";
    }
    return {
      api_code: r.api_code ?? "—",
      api_name: r.api_name ?? r.api_code ?? "—",
      successful,
      successful_no_data,
      failed,
      in_progress,
      hits,
      manual_hits: Number(r.manual_hits ?? 0),
      price_s: toNumber(r.p_s),
      price_snd: toNumber(r.p_snd),
      price_f: toNumber(r.p_f),
      price_ip: toNumber(r.p_ip),
      vendor: "—",
      vendor_cost,
      revenue,
      margin,
      margin_pct: revenue > 0 ? (margin / revenue) * 100 : 0,
      is_slab: Number(r.is_slab ?? 0) === 1,
      slab_bands: slab?.bands ?? [],
      unpriced_hits,
      leak_state,
      billed: billedCodes.has(r.api_code),
      bundle_id: r.bundle_id != null ? Number(r.bundle_id) : null,
      bundle_name: r.bundle_name ?? null,
      bundle_anchor: Number(r.bundle_anchor ?? 0) === 1,
    };
  });

  // Re-sort on corrected revenue: slab rows priced to 0 in the SQL ORDER BY.
  return mapped.sort((a, b) => b.revenue - a.revenue || b.hits - a.hits);
}

export type AccountSandboxUsage = {
  api_code: string;
  api_name: string;
  hits: number;
  /** Revenue NOT billed because this usage is classified sandbox. */
  suppressed_revenue: number;
  first_day: string;
  last_day: string;
};

/**
 * Per-API usage classified as sandbox for an account in the window — i.e. rows
 * whose effective_is_sandbox = 1, whether from the account default
 * (clients.is_sandbox) or a per-(account,api) override. `suppressed_revenue` is
 * what the daily view would have billed; volume-priced APIs read 0 here (their
 * period total can't live in the per-day view), same caveat as the daily charts.
 * Empty when the account has no sandbox usage.
 */
export async function getAccountSandboxUsage(
  accountId: number,
  opts: { from: string; to: string }
): Promise<AccountSandboxUsage[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      v.api_code,
      v.api_name,
      SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS hits,
      SUM(v.revenue) AS suppressed_revenue,
      MIN(v.date) AS first_day,
      MAX(v.date) AS last_day
    FROM usage_daily_with_revenue v
    WHERE v.client_id = ${accountId}
      AND v.date BETWEEN ${opts.from} AND ${opts.to}
      AND COALESCE(v.effective_is_sandbox, 0) = 1
      AND (v.successful + v.successful_no_data + v.failed + v.in_progress) > 0
    GROUP BY v.api_code, v.api_name
    ORDER BY hits DESC
  `;
  return (rows as any[]).map((r) => ({
    api_code: r.api_code ?? "—",
    api_name: r.api_name ?? r.api_code ?? "—",
    hits: Number(r.hits ?? 0),
    suppressed_revenue: toNumber(r.suppressed_revenue),
    first_day: r.first_day,
    last_day: r.last_day,
  }));
}

async function getAccountDailySeriesImpl(
  accountId: number,
  opts: { from: string; to: string; includeCost?: boolean; includeSandbox?: boolean }
): Promise<DailySeriesRow[]> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT date,
      SUM(revenue)     AS revenue,
      SUM(vendor_cost) AS vendor_cost,
      SUM(successful + successful_no_data + failed + in_progress) AS hits
    FROM usage_daily_with_revenue v
    WHERE v.client_id = ${accountId} AND date BETWEEN ${opts.from} AND ${opts.to}
    ${sandboxCond}
    GROUP BY date
    ORDER BY date
  `;
  // Volume-priced vendor rates cost ₹0 per day in the view; the month's blended
  // rate lands on the days that earned it, so the series still sums to the month.
  const volumeByDate = await vendorVolumeCostByDate({
    clientId: accountId,
    from: opts.from,
    to: opts.to,
    includeSandbox: opts.includeSandbox,
  });
  return (rows as any[]).map((r) => {
    const vendor_cost = toNumber(r.vendor_cost) + (volumeByDate.get(r.date) ?? 0);
    return {
      date: r.date,
      revenue: toNumber(r.revenue),
      vendor_cost: opts.includeCost ? vendor_cost : null,
      margin: opts.includeCost ? toNumber(r.revenue) - vendor_cost : null,
      hits: Number(r.hits ?? 0),
    };
  });
}

async function getAccountActivityImpl(
  accountId: number,
  opts: { from: string; to: string; includeSandbox?: boolean }
): Promise<ActivityDay[]> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT date,
      SUM(successful + successful_no_data + failed + in_progress) AS hits,
      SUM(revenue) AS revenue
    FROM usage_daily_with_revenue v
    WHERE v.client_id = ${accountId} AND v.date BETWEEN ${opts.from} AND ${opts.to}
    ${sandboxCond}
    GROUP BY date
    ORDER BY date
  `;
  return (rows as any[]).map((r) => ({
    date: r.date,
    hits: Number(r.hits ?? 0),
    revenue: toNumber(r.revenue),
  }));
}

async function getAccountTopApiImpl(
  accountId: number,
  opts: { from: string; to: string; includeSandbox?: boolean }
): Promise<{ name: string; revenue: number; share: number } | null> {
  const sql = getSql();
  const sandboxCond = opts.includeSandbox ? sql`` : sql`AND COALESCE(v.effective_is_sandbox, 0) = 0`;
  const rows = await sql`
    SELECT v.api_code, v.api_name, SUM(v.revenue) AS revenue
    FROM usage_daily_with_revenue v
    WHERE v.client_id = ${accountId} AND v.date BETWEEN ${opts.from} AND ${opts.to}
      AND v.api_code IS NOT NULL
    ${sandboxCond}
    GROUP BY v.api_code, v.api_name
    ORDER BY revenue DESC
  `;
  if (!rows.length) return null;
  const total = (rows as any[]).reduce((s, r) => s + toNumber(r.revenue), 0);
  if (total === 0) return null;
  const top = rows[0] as any;
  return {
    name: top.api_name ?? top.api_code,
    revenue: toNumber(top.revenue),
    share: (toNumber(top.revenue) / total) * 100,
  };
}
