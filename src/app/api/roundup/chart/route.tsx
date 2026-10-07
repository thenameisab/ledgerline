// Signed PNG endpoint for the roundup email's concentration + quadrant charts.
// Public (an email image proxy carries no session) — the HMAC sig in the URL is the
// only credential, and no revenue data rides in the query string: the snapshot
// is recomputed from (kind, today). See lib/roundup-image.ts + middleware.ts.

import { NextResponse } from "next/server";
import { buildRoundupData } from "@/lib/roundup";
import { renderChartImage } from "@/lib/emails/roundup-chart-image";
import { verifyChartSig, type ChartType } from "@/lib/roundup-image";
import type { RoundupKind } from "@/lib/repos/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KINDS = new Set<RoundupKind>(["daily", "weekly", "monthly"]);
const TYPES = new Set<ChartType>(["concentration", "quadrant"]);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind") as RoundupKind | null;
  const type = q.get("type") as ChartType | null;
  const today = q.get("today");
  const sig = q.get("sig");

  if (!kind || !type || !today || !sig || !KINDS.has(kind) || !TYPES.has(type)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  if (!verifyChartSig(kind, type, today, sig)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const data = await buildRoundupData(kind, today);
  const img = await renderChartImage(type, data);
  // Snapshot is immutable for a past date; let email image proxies cache it.
  img.headers.set("Cache-Control", "public, max-age=86400, immutable");
  return img;
}
