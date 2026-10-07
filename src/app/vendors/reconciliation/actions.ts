"use server";

import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/access";
import getSql from "@/lib/db";
import { recordAudit } from "@/lib/repos/audit";
import { revalidateRevenue } from "@/lib/cache";

export type ReconActionResult = { ok: true } | { ok: false; error: string };

/**
 * Accept a reconciliation delta for one month.
 *
 * Deliberately narrower than `leak_dismissals`, which suppresses a pair
 * forever. A delta is a fact about a period: "August's Verisys gap is internal
 * test traffic" says nothing about September, and a permanent dismissal would
 * hide the month the gap changes shape. Each month is accepted on its own.
 *
 * Gated on `vendor_pricing.edit`, which is admin-only — the same gate as the
 * rate card this queue exists to feed. Editors never see vendor cost.
 */
export async function dismissReconDelta(input: {
  vendor: string;
  /** Null for a vendor-side API name with no catalog match. */
  apiCode: string | null;
  /** Set only when apiCode is null — identifies the unmatched name. */
  rawApiName: string | null;
  /** Any date inside the month being accepted. */
  periodFrom: string;
  reason?: string;
}): Promise<ReconActionResult> {
  const guard = await guardAction("vendor_pricing.edit");
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!input.vendor) return { ok: false, error: "vendor required" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodFrom)) {
    return { ok: false, error: "invalid period" };
  }
  // An unmatched item is identified by its raw name; a matched one by its code.
  const rawName = input.apiCode ? null : (input.rawApiName ?? null);
  if (!input.apiCode && !rawName) return { ok: false, error: "api required" };

  const sql = getSql();
  await sql`
    INSERT INTO vendor_recon_dismissals
      (vendor, api_code, raw_api_name, period_month, dismissed_by, reason)
    VALUES (
      ${input.vendor}, ${input.apiCode}, ${rawName},
      DATE_TRUNC('month', ${input.periodFrom}::date)::date,
      ${guard.user.id}, ${input.reason ?? null}
    )
    ON CONFLICT (vendor, COALESCE(api_code, ''), COALESCE(raw_api_name, ''), period_month)
    DO NOTHING
  `;
  await recordAudit({
    user_id: guard.user.id,
    action: "vendor_recon.dismiss",
    entity_type: "vendor_recon_dismissal",
    entity_id: `${input.vendor}:${input.apiCode ?? rawName}:${input.periodFrom.slice(0, 7)}`,
    after: { reason: input.reason ?? null },
  });

  // Both surfaces the row appears on: the cross-vendor queue and this vendor's
  // own tab. revalidateRevenue() busts the cached rows behind both; these keep
  // the routes themselves honest.
  revalidatePath("/vendors/reconciliation");
  revalidatePath(`/vendors/${encodeURIComponent(input.vendor)}/reconciliation`);
  revalidateRevenue();
  return { ok: true };
}

/** Undo an acceptance — the delta returns to the open list for that month. */
export async function restoreReconDelta(input: {
  vendor: string;
  apiCode: string | null;
  rawApiName: string | null;
  periodFrom: string;
}): Promise<ReconActionResult> {
  const guard = await guardAction("vendor_pricing.edit");
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodFrom)) {
    return { ok: false, error: "invalid period" };
  }
  const rawName = input.apiCode ? null : (input.rawApiName ?? null);

  const sql = getSql();
  await sql`
    DELETE FROM vendor_recon_dismissals
    WHERE vendor = ${input.vendor}
      AND COALESCE(api_code, '') = ${input.apiCode ?? ""}
      AND COALESCE(raw_api_name, '') = ${rawName ?? ""}
      AND period_month = DATE_TRUNC('month', ${input.periodFrom}::date)::date
  `;
  await recordAudit({
    user_id: guard.user.id,
    action: "vendor_recon.restore",
    entity_type: "vendor_recon_dismissal",
    entity_id: `${input.vendor}:${input.apiCode ?? rawName}:${input.periodFrom.slice(0, 7)}`,
  });

  // Both surfaces the row appears on: the cross-vendor queue and this vendor's
  // own tab. revalidateRevenue() busts the cached rows behind both; these keep
  // the routes themselves honest.
  revalidatePath("/vendors/reconciliation");
  revalidatePath(`/vendors/${encodeURIComponent(input.vendor)}/reconciliation`);
  revalidateRevenue();
  return { ok: true };
}
