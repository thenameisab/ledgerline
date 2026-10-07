// Daily usage sync, invoked by a scheduled cron at 11:00 IST,
// with retry runs (?mode=retry) at 13:00 and 17:00 IST.
//
// Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled
// invocations when the CRON_SECRET env var is set. The middleware exempts
// /api/cron from the session-cookie redirect; this header check is the real
// gate.
//
// Each run:
//   1. Re-syncs the trailing RESYNC_WINDOW closed days (yesterday included).
//      Metabase can restate a recent day as in-progress hits settle; pulling
//      the window again absorbs that.
//   2. Self-heals gaps: any older date since SYNC_EPOCH not yet COVERED gets
//      re-pulled (capped per run). "Covered" = a successful run that landed data;
//      a pull that returned only Metabase's checksum row (day not yet populated
//      upstream) does NOT count, so a late-arriving day stays on the heal list
//      until its data actually lands. A day of downtime repairs itself the next
//      morning; a late-populated day repairs itself once Metabase has it.

import { NextResponse } from "next/server";
import { syncDate, type SyncDateResult } from "@/lib/usage-sync";
import { revalidateRevenue } from "@/lib/cache";
import { missingSyncDates, SYNC_EPOCH } from "@/lib/repos/sync-runs";
import { yesterdayIST, shiftISO } from "@/lib/repos/periods";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RESYNC_WINDOW = 3; // yesterday + 2 days before it
// Older uncovered dates healed per run. Sized to close any realistic gap in a
// single morning while staying well inside maxDuration —
// each date is one Metabase pull. A larger historical backfill uses /api/sync/backfill.
const HEAL_CAP = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const yday = yesterdayIST();
  const missing = await missingSyncDates({ from: SYNC_EPOCH, to: yday, cap: HEAL_CAP + RESYNC_WINDOW });

  // Retry runs (13:00 and 17:00 IST) exist because yesterday's data is often
  // not in Metabase at 11:00. They pull only dates that are still uncovered and
  // skip the trailing re-sync, so a day that already synced is not pulled again.
  const retry = new URL(req.url).searchParams.get("mode") === "retry";
  if (retry && missing.length === 0) {
    return NextResponse.json({ ok: true, retry: true, synced: [] });
  }

  const dates: string[] = [];
  if (!retry) for (let i = RESYNC_WINDOW - 1; i >= 0; i--) dates.push(shiftISO(yday, -i));
  for (const d of missing) {
    if (!dates.includes(d) && dates.length < RESYNC_WINDOW + HEAL_CAP) dates.push(d);
  }
  dates.sort();

  const results: SyncDateResult[] = [];
  for (const d of dates) {
    results.push(await syncDate(d, "cron"));
  }

  const failed = results.filter((r) => r.status === "error");
  if (results.length > failed.length) revalidateRevenue();
  return NextResponse.json(
    {
      ok: failed.length === 0,
      synced: results.map((r) => ({
        date: r.date,
        status: r.status,
        rows: r.rows_inserted,
        hits: r.total_hits,
        unmapped_clients: r.unmapped_clients.length,
        unmapped_apis: r.unmapped_apis.length,
        ...(r.error ? { error: r.error } : {}),
      })),
    },
    { status: failed.length > 0 ? 500 : 200 }
  );
}
