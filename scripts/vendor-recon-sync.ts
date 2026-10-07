/**
 * Pull vendor-side usage from Metabase into `vendor_usage_daily`.
 *
 *   npm run vendor-sync                  # everything the vendor table holds
 *   npm run vendor-sync -- 2026-08-01 2026-08-31
 *
 * Idempotent — re-running a window restates it. Run it after adding an API
 * alias to re-resolve names that were previously unmatched.
 *
 * Portfolio: with MOCK_INTEGRATIONS=true (the default in .env.local) the
 * vendor side is the local mock in lib/metabase-vendor.ts. Needs the
 * embedded database running (npm run dev).
 */
import { syncVendorUsage } from "../src/lib/vendor-recon-sync";
import { vendorUsageCoverage } from "../src/lib/metabase-vendor";

async function main() {
  const [argFrom, argTo] = process.argv.slice(2);
  let from = argFrom;
  let to = argTo;

  if (!from || !to) {
    const cov = await vendorUsageCoverage();
    if (!cov) {
      console.log("vendor_usage_report is empty — nothing to sync.");
      process.exit(0);
    }
    from = cov.from;
    to = cov.to;
    console.log(`no range given — using the vendor table's own coverage ${from} → ${to}`);
  }

  const r = await syncVendorUsage(from, to);
  console.log(
    `\n${r.from} → ${r.to}: ${r.rows_fetched} rows fetched, ${r.rows_written} written ` +
      `across ${r.dates} dates and ${r.vendors} vendors`
  );
  if (r.unmatched_rows > 0) {
    console.log(
      `\n${r.unmatched_rows} rows (${r.unmatched_hits.toLocaleString("en-IN")} hits) matched no API in the catalog:`
    );
    for (const n of r.unmatched_names) console.log(`  - ${n}`);
    console.log(
      "\nAdd each as an alias on the right API (/admin/sku-review or the API form)," +
        " then re-run this sync to repair history."
    );
  }
  process.exit(0);
}
main().catch((e) => {
  console.error("vendor sync failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
