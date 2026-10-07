// Weekly product update email (API usage), invoked by a scheduled cron on
// Mondays. Auth mirrors the other crons:
// `Authorization: Bearer <CRON_SECRET>`.
//
// Skipped when the recipient list is empty. ?dry=1 renders the HTML without
// sending; &today=YYYY-MM-DD rebuilds a historical send.

import { NextResponse } from "next/server";
import { sendProductUpdate, renderProductUpdate } from "@/lib/product-update-send";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  if (params.get("dry")) {
    const { html } = await renderProductUpdate("usage", params.get("today") ?? undefined);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const results = [];
  try {
    results.push(await sendProductUpdate("usage"));
  } catch (e) {
    results.push({ product: "usage", failed: [{ to: "*", error: e instanceof Error ? e.message : String(e) }] });
  }
  const ok = results.every((r) => (r.failed ?? []).length === 0);
  return NextResponse.json({ ok, results });
}
