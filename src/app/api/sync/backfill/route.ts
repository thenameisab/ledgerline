// Admin-triggered Metabase backfill for a date range. Each day is one
// Metabase query + one transaction (see lib/usage-sync.ts), so the range is
// capped to stay inside the function timeout. Split larger ranges into
// several requests.

import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { syncRange } from "@/lib/usage-sync";
import { revalidateRevenue } from "@/lib/cache";
import { yesterdayIST } from "@/lib/repos/periods";

export const maxDuration = 300;

const MAX_RANGE_DAYS = 31;

const BackfillSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("sync.backfill");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }

  const parsed = BackfillSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const { from, to } = parsed.data;

  if (from > to) {
    return NextResponse.json({ ok: false, error: "from must be on or before to" }, { status: 400 });
  }
  const yday = yesterdayIST();
  if (to > yday) {
    return NextResponse.json(
      { ok: false, error: `Usage data closes daily — latest selectable date is ${yday}` },
      { status: 400 }
    );
  }
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  if (days > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { ok: false, error: `range too large (${days} days, max ${MAX_RANGE_DAYS}) — split it into smaller ranges` },
      { status: 400 }
    );
  }

  const results = await syncRange(from, to, "backfill");
  const failed = results.filter((r) => r.status === "error");
  if (results.length > failed.length) revalidateRevenue();

  await recordAudit({
    user_id: guard.user.id,
    action: "sync.backfill",
    entity_type: "sync",
    entity_id: `${from}..${to}`,
    after: {
      days: results.length,
      failed: failed.length,
      total_hits: results.reduce((a, r) => a + r.total_hits, 0),
    },
  });

  return NextResponse.json({
    ok: failed.length === 0,
    results: results.map((r) => ({
      date: r.date,
      status: r.status,
      rows: r.rows_inserted,
      hits: r.total_hits,
      ...(r.error ? { error: r.error } : {}),
    })),
  });
}
