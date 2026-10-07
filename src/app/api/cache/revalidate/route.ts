// Let a process outside the app invalidate the revenue cache.
//
// Every read on the revenue view goes through `cachedRevenueRead`, which is
// `unstable_cache` with a tag and no TTL: an entry never expires on its own,
// only `revalidateTag(REVENUE_TAG)` clears it. App writes call
// `revalidateRevenue()` already, and so do the three sync crons.
//
// Scripts cannot. `revalidateTag` is a Next.js server API and a CLI process is
// not a Next.js server, so scripts such as `npm run migrate` write to the
// database and leave every cached figure
// behind. On Vercel the Data Cache also survives deployments. The daily
// usage-sync cron clears the tag every morning, so without this route a script
// write stays invisible for up to a day. This route lets a script clear the
// cache after it writes.
//
// Auth is the same CRON_SECRET bearer the cron routes use. It is not a data
// endpoint — the only thing it can do is make the app re-read Postgres.

import { NextResponse } from "next/server";
import { revalidateRevenue } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  revalidateRevenue();
  return NextResponse.json({ ok: true, revalidated: "revenue-data", at: new Date().toISOString() });
}
