// Per-(account, API) sandbox billing policy.
//
// A "cap" is the number of successful sandbox hits billable in a period:
//   null → all, 0 → none, N → up to N. Rules override the global toggle
//   (app_settings.include_sandbox), which supplies the default when no rule
//   matches. deriveStatement uses resolveSandboxCaps() to bill the right slice
//   of each line's sandbox hits; the admin "surface" view uses listSandboxCases().

import getSql from "../db";
import { getIncludeSandbox } from "./settings";
import { revalidateRevenue } from "../cache";

export type SandboxCap = number | null; // null = all, 0 = none, N = cap

/**
 * Resolver for one account as of a date. `cap(apiCode)` returns the billable
 * successful-sandbox-hit cap for that API, applying rule precedence then the
 * global default.
 */
export async function resolveSandboxCaps(
  accountId: number,
  asOf: string
): Promise<(apiCode: string | null) => SandboxCap> {
  const sql = getSql();
  // Latest rule per (api_code) effective on/before asOf, api-specific and
  // account-wide. DISTINCT ON picks the newest effective_from per bucket.
  const rows = await sql`
    SELECT DISTINCT ON (api_code) api_code, billable_hits
    FROM sandbox_billing_rules
    WHERE client_id = ${accountId} AND effective_from <= ${asOf}
    ORDER BY api_code, effective_from DESC
  `;
  const byApi = new Map<string, SandboxCap>();
  let accountDefault: SandboxCap | undefined = undefined;
  for (const r of rows as unknown as { api_code: string | null; billable_hits: number | null }[]) {
    if (r.api_code === null) accountDefault = r.billable_hits;
    else byApi.set(r.api_code, r.billable_hits);
  }
  const globalDefault: SandboxCap = (await getIncludeSandbox()) ? null : 0;

  return (apiCode: string | null) => {
    if (apiCode !== null && byApi.has(apiCode)) return byApi.get(apiCode)!;
    if (accountDefault !== undefined) return accountDefault;
    return globalDefault;
  };
}

/** Apply a cap to a sandbox hit count. */
export function billedSandboxHits(sandboxHits: number, cap: SandboxCap): number {
  if (cap === null) return sandboxHits;
  return Math.min(sandboxHits, Math.max(0, cap));
}

export type SandboxCase = {
  client_id: number;
  account_slug: string;
  client_name: string;
  api_code: string;
  api_name: string;
  sandbox_successful: number;
  sandbox_hits: number; // all buckets, for context
  cap: SandboxCap; // resolved policy
  rule_scope: "api" | "account" | "global"; // where the policy came from
};

/**
 * Every (account, API) with sandbox successful traffic in [from, to], plus the
 * currently-resolved billing policy. Powers the admin surface where live
 * customers still hitting sandbox are triaged and priced.
 */
export async function listSandboxCases(opts: { from: string; to: string }): Promise<SandboxCase[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT v.client_id, c.slug AS account_slug, c.display_name AS client_name,
           v.api_code, MAX(v.api_name) AS api_name,
           SUM(v.successful) AS sandbox_successful,
           SUM(v.successful + v.successful_no_data + v.failed + v.in_progress) AS sandbox_hits
    FROM usage_daily_with_revenue v
    JOIN clients c ON c.id = v.client_id
    WHERE v.date BETWEEN ${opts.from} AND ${opts.to}
      AND v.client_id IS NOT NULL AND v.api_code IS NOT NULL
      AND COALESCE(v.effective_is_sandbox, 0) = 1
    GROUP BY v.client_id, c.slug, c.display_name, v.api_code
    HAVING SUM(v.successful) > 0
    ORDER BY SUM(v.successful) DESC
  `;

  // Resolve each row's policy. Group by account so we build one resolver each.
  const byAccount = new Map<number, SandboxCase[]>();
  const cases = (rows as any[]).map((r) => ({
    client_id: Number(r.client_id),
    account_slug: r.account_slug as string,
    client_name: r.client_name as string,
    api_code: r.api_code as string,
    api_name: (r.api_name as string) ?? r.api_code,
    sandbox_successful: Number(r.sandbox_successful ?? 0),
    sandbox_hits: Number(r.sandbox_hits ?? 0),
    cap: null as SandboxCap,
    rule_scope: "global" as "api" | "account" | "global",
  }));
  for (const c of cases) {
    if (!byAccount.has(c.client_id)) byAccount.set(c.client_id, []);
    byAccount.get(c.client_id)!.push(c);
  }
  const globalDefault: SandboxCap = (await getIncludeSandbox()) ? null : 0;
  for (const [accountId, group] of byAccount) {
    const ruleRows = await sql`
      SELECT DISTINCT ON (api_code) api_code, billable_hits
      FROM sandbox_billing_rules
      WHERE client_id = ${accountId} AND effective_from <= ${opts.to}
      ORDER BY api_code, effective_from DESC
    `;
    const byApi = new Map<string, SandboxCap>();
    let accountDefault: SandboxCap | undefined;
    for (const r of ruleRows as unknown as { api_code: string | null; billable_hits: number | null }[]) {
      if (r.api_code === null) accountDefault = r.billable_hits;
      else byApi.set(r.api_code, r.billable_hits);
    }
    for (const c of group) {
      if (byApi.has(c.api_code)) {
        c.cap = byApi.get(c.api_code)!;
        c.rule_scope = "api";
      } else if (accountDefault !== undefined) {
        c.cap = accountDefault;
        c.rule_scope = "account";
      } else {
        c.cap = globalDefault;
        c.rule_scope = "global";
      }
    }
  }
  return cases;
}

/**
 * Upsert a sandbox billing rule. api_code null = account-wide default.
 * effective_from defaults to the FY start so a rule covers the open period.
 */
export async function setSandboxBillingRule(opts: {
  accountId: number;
  apiCode: string | null;
  billableHits: SandboxCap;
  effectiveFrom?: string;
  note?: string | null;
  actor: string | null;
}) {
  const sql = getSql();
  const eff = opts.effectiveFrom ?? "2026-04-01";
  // Partial unique indexes differ by api_code shape, so upsert per shape.
  if (opts.apiCode === null) {
    await sql`
      INSERT INTO sandbox_billing_rules (client_id, api_code, effective_from, billable_hits, note, created_by)
      VALUES (${opts.accountId}, NULL, ${eff}, ${opts.billableHits}, ${opts.note ?? null}, ${opts.actor})
      ON CONFLICT (client_id, effective_from) WHERE api_code IS NULL
      DO UPDATE SET billable_hits = EXCLUDED.billable_hits, note = EXCLUDED.note, created_by = EXCLUDED.created_by
    `;
  } else {
    await sql`
      INSERT INTO sandbox_billing_rules (client_id, api_code, effective_from, billable_hits, note, created_by)
      VALUES (${opts.accountId}, ${opts.apiCode}, ${eff}, ${opts.billableHits}, ${opts.note ?? null}, ${opts.actor})
      ON CONFLICT (client_id, api_code, effective_from) WHERE api_code IS NOT NULL
      DO UPDATE SET billable_hits = EXCLUDED.billable_hits, note = EXCLUDED.note, created_by = EXCLUDED.created_by
    `;
  }
  revalidateRevenue();
}

/** Remove a rule (revert that scope to the next level up). */
export async function deleteSandboxBillingRule(id: number) {
  const sql = getSql();
  await sql`DELETE FROM sandbox_billing_rules WHERE id = ${id}`;
  revalidateRevenue();
}
