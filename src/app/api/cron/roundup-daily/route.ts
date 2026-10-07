// The daily revenue roundup email, invoked by a scheduled cron.
// Auth mirrors /api/cron/usage-sync: `Authorization: Bearer <CRON_SECRET>`.
// ?dry=1 renders the email HTML without sending — the debug/preview path.

import { NextResponse } from "next/server";
import { sendDailyRoundup, renderRoundup } from "@/lib/roundup-send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  if (params.get("dry")) {
    const { html } = await renderRoundup("daily", params.get("today") ?? undefined);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const result = await sendDailyRoundup();
  return NextResponse.json({ ok: (result.failed ?? []).length === 0, ...result });
}
