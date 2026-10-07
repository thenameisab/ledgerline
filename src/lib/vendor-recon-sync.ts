/**
 * Pull vendor-side usage into `vendor_usage_daily`.
 *
 * Mirrors lib/usage-sync.ts in shape — fetch a window, resolve names to
 * product codes, upsert — but the two are deliberately separate modules. The
 * customer-side sync owns revenue; this one owns nothing but a comparison
 * input, so a failure here must never be able to disturb billable usage.
 *
 * The API match is name-based, which #118 otherwise retired in favour of
 * Product Code. It is unavoidable: `vendor_usage_report` carries no code column,
 * only a display name and an endpoint slug. The mitigation is that it reuses
 * the catalog's existing identity set — `product_code`, `name`, and
 * `log_aliases` — so every alias the alias queue has ever recorded already
 * counts, and an unmatched name is stored with `api_code = NULL` and surfaced
 * as a worklist item rather than dropped. Adding an alias and re-running the
 * sync repairs history.
 *
 * No "server-only": scripts/vendor-recon-sync.ts runs this from the CLI.
 */

import getSql from "./db";
import { resolveVendors } from "./vendor-registry";
import { parseAliases } from "./repos/apis";
import { fetchVendorUsage, type VendorUsageRow } from "./metabase-vendor";

export type VendorSyncResult = {
  from: string;
  to: string;
  rows_fetched: number;
  rows_written: number;
  /** Rows whose vendor-side API name matched nothing in the catalog. */
  unmatched_rows: number;
  unmatched_hits: number;
  unmatched_names: string[];
  dates: number;
  vendors: number;
};

/**
 * Every string the catalog answers to → product code.
 *
 * Built from code, name and aliases, lowercased. When two APIs claim the same
 * identifier the first wins and the second is skipped: an ambiguous name must
 * not silently attach vendor volume to one of two candidates, so it is left
 * unmatched and shows up in the queue. `/admin/api-review` already surfaces
 * catalog duplicates as their own worklist.
 */
async function catalogIndex(): Promise<Map<string, string>> {
  const sql = getSql();
  const rows = (await sql`SELECT product_code, name, log_aliases FROM apis`) as any[];
  const index = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const r of rows) {
    for (const ident of [r.product_code, r.name, ...parseAliases(r.log_aliases)]) {
      const key = String(ident ?? "").trim().toLowerCase();
      if (!key) continue;
      const existing = index.get(key);
      if (existing && existing !== r.product_code) {
        ambiguous.add(key);
        continue;
      }
      index.set(key, r.product_code);
    }
  }
  for (const key of ambiguous) index.delete(key);
  return index;
}

/**
 * Sync a closed date range. Idempotent: the unique key is
 * (date, vendor, raw_api_name, raw_api_slug) and every column is overwritten,
 * so re-running a window restates it rather than accumulating.
 *
 * Rows are written in batches. A window is not wrapped in one transaction:
 * a partial window is a smaller reconciliation, not a wrong one, and an
 * all-or-nothing pull of four months would be a single long-held lock.
 */
export async function syncVendorUsage(from: string, to: string): Promise<VendorSyncResult> {
  const sql = getSql();
  const fetched = await fetchVendorUsage(from, to);
  const index = await catalogIndex();

  const unmatchedNames = new Set<string>();
  let unmatchedRows = 0;
  let unmatchedHits = 0;
  const dates = new Set<string>();
  const vendors = new Set<string>();

  type Prepared = VendorUsageRow & { vendor: string; api_code: string | null };
  const prepared: Prepared[] = [];
  // vendor_usage_daily keeps the vendor as text — it is an outside record, like
  // raw_api_name beside it. Resolving through the registry is what keeps
  // that text on the same spelling the usage side uses, so the two still
  // reconcile after a rename.
  const registry = await resolveVendors(sql, fetched.map((r) => r.vendor));
  for (const r of fetched) {
    const vendor = registry.get(r.vendor)?.name ?? null;
    if (!vendor || !r.report_date || !r.type_label) continue;
    // Match on the display name; the slug is a fallback for names the catalog
    // records as an alias in slug form.
    const code =
      index.get(r.type_label.toLowerCase()) ?? index.get(r.api_name.toLowerCase()) ?? null;
    if (!code) {
      unmatchedRows++;
      unmatchedHits += r.successful + r.successful_no_data + r.failed;
      unmatchedNames.add(r.type_label);
    }
    dates.add(r.report_date);
    vendors.add(vendor);
    prepared.push({ ...r, vendor, api_code: code });
  }

  let written = 0;
  const BATCH = 500;
  for (let i = 0; i < prepared.length; i += BATCH) {
    const batch = prepared.slice(i, i + BATCH);
    const res = await sql`
      INSERT INTO vendor_usage_daily ${sql(
        batch.map((r) => ({
          date: r.report_date,
          vendor: r.vendor,
          api_code: r.api_code,
          raw_api_name: r.type_label,
          raw_api_slug: r.api_name,
          successful: r.successful,
          successful_no_data: r.successful_no_data,
          failed: r.failed,
        })),
        "date",
        "vendor",
        "api_code",
        "raw_api_name",
        "raw_api_slug",
        "successful",
        "successful_no_data",
        "failed"
      )}
      ON CONFLICT (date, vendor, raw_api_name, raw_api_slug) DO UPDATE SET
        api_code           = EXCLUDED.api_code,
        successful         = EXCLUDED.successful,
        successful_no_data = EXCLUDED.successful_no_data,
        failed             = EXCLUDED.failed,
        synced_at          = NOW()
    `;
    written += (res as any).count ?? batch.length;
  }

  return {
    from,
    to,
    rows_fetched: fetched.length,
    rows_written: written,
    unmatched_rows: unmatchedRows,
    unmatched_hits: unmatchedHits,
    unmatched_names: [...unmatchedNames].sort(),
    dates: dates.size,
    vendors: vendors.size,
  };
}

/** Latest vendor-side date on our side. Null when nothing has synced yet. */
export async function vendorUsageThrough(): Promise<string | null> {
  const sql = getSql();
  const [row] = await sql`SELECT MAX(date)::text AS d FROM vendor_usage_daily`;
  return ((row as any)?.d as string | null) ?? null;
}
