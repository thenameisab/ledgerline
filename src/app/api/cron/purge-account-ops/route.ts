// Daily purge of expired account merge/delete undo windows, invoked by a
// scheduled cron. Operations still 'executed' past their
// reverse_deadline get their soft-deleted source account hard-deleted and are
// marked 'purged' — the point at which a merge/delete becomes permanent.
//
// Auth mirrors /api/cron/usage-sync: Vercel sends
// `Authorization: Bearer <CRON_SECRET>`; that header check is the gate.

import { NextResponse } from "next/server";
import { purgeExpiredAccountOperations } from "@/lib/repos/account-merge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { purged } = await purgeExpiredAccountOperations();
  return NextResponse.json({ ok: true, purged });
}
