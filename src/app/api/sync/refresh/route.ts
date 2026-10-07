// Manual "refresh now": re-pulls today and the two prior days from Metabase
// and returns a before/after diff (per-day totals + biggest account movers).
// Unlike the cron, this includes today's partial data — that's the point of
// a midday refresh; tomorrow's cron re-pull corrects the partial day.

import { NextResponse } from "next/server";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { refreshLatest } from "@/lib/usage-sync";
import { revalidateRevenue } from "@/lib/cache";
import { syncVendorUsage } from "@/lib/vendor-recon-sync";
import { runPendingAlerts } from "@/lib/alerts/run";
import { shiftISO } from "@/lib/repos/periods";

// Demo mode: the demo has no scheduled crons, so a refresh also runs the two
// jobs that are otherwise scheduled after the usage sync: the vendor-side pull for
// reconciliation, and the alert check. Alert emails are not sent here.
const MOCK = process.env.MOCK_INTEGRATIONS === "true";

export const maxDuration = 300;

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("sync.refresh");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }

  const diff = await refreshLatest();
  const failed = diff.dates.filter((d) => d.status === "error");

  if (MOCK) {
    // Through diff.to (today): the refresh just pulled today's partial usage,
    // and the mock vendor side mirrors whatever usage exists.
    try {
      await syncVendorUsage(shiftISO(diff.to, -9), diff.to);
      await runPendingAlerts({ trigger: "manual" });
    } catch (e) {
      console.error("[refresh] mock follow-up jobs failed:", e);
    }
  }

  await recordAudit({
    user_id: guard.user.id,
    action: "sync.refresh",
    entity_type: "sync",
    entity_id: `${diff.from}..${diff.to}`,
    after: {
      hits_before: diff.hits_before,
      hits_after: diff.hits_after,
      failed: failed.length,
    },
  });

  revalidateRevenue();
  return NextResponse.json({ ok: failed.length === 0, diff });
}
