// Daily vendor-side usage pull, invoked by a scheduled cron.
//
// Scheduled after /api/cron/usage-sync: the reconciliation compares the two
// sides, so pulling the vendor side first would compare today's vendor data
// against yesterday's customer data and manufacture a delta.
//
// Auth is the same CRON_SECRET bearer check the other cron routes use; the
// middleware exempts /api/cron from the session-cookie redirect, so this
// header is the real gate.
//
// Each run re-pulls a trailing window rather than only yesterday.
// `vendor_usage_report` is populated upstream, sometimes by hand — a day can land or be restated late, and the sync is idempotent
// (unique on date + vendor + api name), so re-pulling a window costs one
// query and absorbs both cases.

import { NextResponse } from "next/server";
import { syncVendorUsage } from "@/lib/vendor-recon-sync";
import { revalidateRevenue } from "@/lib/cache";
import { yesterdayIST, shiftISO } from "@/lib/repos/periods";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Long enough to absorb a late upstream populate or a manual restatement,
// short enough to stay one cheap query.
const RESYNC_DAYS = 10;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const to = yesterdayIST();
  const from = shiftISO(to, -(RESYNC_DAYS - 1));
  try {
    const r = await syncVendorUsage(from, to);
    revalidateRevenue();
    return NextResponse.json({
      ok: true,
      from: r.from,
      to: r.to,
      rows: r.rows_written,
      dates: r.dates,
      vendors: r.vendors,
      unmatched_rows: r.unmatched_rows,
      unmatched_hits: r.unmatched_hits,
      unmatched_names: r.unmatched_names,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, from, to, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
