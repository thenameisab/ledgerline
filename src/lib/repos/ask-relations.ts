// Cross-entity relationships — "accounts using this SKU", "SKUs used by X".
//
// There's no dedicated page for these, so the palette answers them inline
// (rows in the answer card). Both run over usage_daily_with_revenue for the
// current month. Read-only.

import getSql from "@/lib/db";
import { generateSlug } from "@/lib/slug";
import { formatMoney } from "@/lib/format";
import { mtdRange } from "@/lib/repos/periods";
import { listAccounts } from "@/lib/repos/accounts";
import { fuzzyFilter } from "@/lib/fuzzy";
import type { AskResult } from "./ask";

// Only explicit relation phrasing — never a bare "sku" + "for", which would
// hijack plain revenue questions like "revenue for the Atlas Pro SKU".
// "api" is still accepted as a synonym for "sku".
export function isRelationQuestion(raw: string): boolean {
  const t = raw.toLowerCase();
  if (t.includes("unpriced")) return false; // that's the unpriced intent, not a relation
  if (accountsByApiPhrasing(t)) return true;
  if (/\b(what|which)\s+(apis?|skus?)\b/.test(t)) return true;
  if (/\b(apis?|skus?)\s+(used\s+|consumed\s+)?by\b/.test(t)) return true;
  if (/\b(apis?|skus?)\b/.test(t) && /\b(does|do)\b/.test(t) && /\b(use|uses|using|consume|consumes)\b/.test(t)) return true;
  return false;
}

function accountsByApiPhrasing(t: string): boolean {
  if (/\b(who uses|consumers? of)\b/.test(t)) return true;
  if (/\baccounts?\b/.test(t) && /\b(use|uses|using)\b/.test(t)) return true;
  return false;
}

function residue(raw: string): string {
  return raw
    .toLowerCase()
    // The lookarounds keep words inside hyphenated SKU codes (the "IN" in
    // ATL-PRO-IN) from being stripped as stop words.
    .replace(/(?<![\w-])(who|uses?|using|consumers?|of|which|accounts?|that|use|used|consume|consumes|what|apis?|skus?|does|do|for|by|this|the|in|on|month|mtd)(?![\w-])/g, " ")
    .replace(/[?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function answerRelation(
  raw: string,
  opts: { includeSandbox: boolean }
): Promise<AskResult> {
  const sql = getSql();
  const { from, to } = mtdRange();
  const sandboxFilter = opts.includeSandbox ? sql`TRUE` : sql`v.effective_is_sandbox = 0`;
  const ent = residue(raw);
  if (!ent) return { ok: false, message: "Which SKU or account? Try “accounts using ATL-PRO-IN”." };

  const t = raw.toLowerCase();

  if (accountsByApiPhrasing(t)) {
    // Resolve the SKU (by code or name), then list accounts that called it.
    const apis = await sql<{ product_code: string; name: string }[]>`
      SELECT product_code, name FROM apis WHERE is_active = 1
    `;
    const api = fuzzyFilter(apis, ent, ["name", "product_code"])[0];
    if (!api) return { ok: false, message: "Couldn't find that SKU. Try its name or SKU code." };

    // COUNT(*) OVER() = total distinct accounts (groups) before the LIMIT.
    const rows = await sql<{ client_name: string; rev: string; total: number }[]>`
      SELECT v.client_name, SUM(v.revenue) AS rev, COUNT(*) OVER()::int AS total
      FROM usage_daily_with_revenue v
      WHERE v.api_code = ${api.product_code}
        AND v.date BETWEEN ${from} AND ${to}
        AND ${sandboxFilter}
      GROUP BY v.client_name
      ORDER BY rev DESC
      LIMIT 8
    `;
    if (rows.length === 0) {
      return { ok: false, message: `No usage for ${api.name} (${api.product_code}) this month.` };
    }
    const total = Number(rows[0].total);
    const shown = total > rows.length ? ` · top ${rows.length} of ${total}` : "";
    return {
      ok: true,
      value: `${total} account${total === 1 ? "" : "s"}`,
      label: `Using ${api.name} (${api.product_code})${shown} · this month`,
      assumptions: opts.includeSandbox ? "sandbox included" : "sandbox excluded",
      drilldown: { href: `/skus/${api.product_code}`, label: "View SKU" },
      rows: rows.map((r) => ({
        label: r.client_name,
        value: formatMoney(Number(r.rev), { compact: true }),
        href: `/accounts/${generateSlug(r.client_name)}`,
      })),
    };
  }

  // SKUs used by an account.
  const accounts = await listAccounts();
  const account = fuzzyFilter(accounts, ent, ["display_name"])[0];
  if (!account) return { ok: false, message: "Couldn't find that account. Try the account name." };

  const rows = await sql<{ api_name: string; api_code: string; rev: string; total: number }[]>`
    SELECT v.api_name, v.api_code, SUM(v.revenue) AS rev, COUNT(*) OVER()::int AS total
    FROM usage_daily_with_revenue v
    WHERE v.client_id = ${Number(account.id)}
      AND v.date BETWEEN ${from} AND ${to}
    GROUP BY v.api_name, v.api_code
    ORDER BY rev DESC
    LIMIT 8
  `;
  if (rows.length === 0) {
    return { ok: false, message: `No SKU usage for ${account.display_name} this month.` };
  }
  const total = Number(rows[0].total);
  const shown = total > rows.length ? ` · top ${rows.length} of ${total}` : "";
  return {
    ok: true,
    value: `${total} SKU${total === 1 ? "" : "s"}`,
    label: `Used by ${account.display_name}${shown} · this month`,
    assumptions: "ranked by revenue",
    drilldown: { href: `/accounts/${generateSlug(account.display_name)}`, label: "View account" },
    rows: rows.map((r) => ({
      label: `${r.api_name} · ${r.api_code}`,
      value: formatMoney(Number(r.rev), { compact: true }),
      href: `/skus/${r.api_code}`,
    })),
  };
}
