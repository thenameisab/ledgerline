"use server";

import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/access";
import getSql from "@/lib/db";
import { recordAudit } from "@/lib/repos/audit";
import { revalidateRevenue } from "@/lib/cache";

export type LeakActionResult = { ok: true } | { ok: false; error: string };

// Acknowledge a *historical* leak (a now-priced pair with unbilled hits before
// its effective date) as fixed/expected. Drops the pair from every leak surface.
// Never affects an *active* leak — a pair with no current price stays flagged.
export async function dismissHistoricalLeak(
  accountId: number,
  apiCode: string,
  slug: string
): Promise<LeakActionResult> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) return { ok: false, error: guard.error };

  const sql = getSql();
  await sql`
    INSERT INTO leak_dismissals (client_id, api_code, dismissed_by)
    VALUES (${accountId}, ${apiCode}, ${guard.user.id})
    ON CONFLICT (client_id, api_code) DO NOTHING
  `;
  await recordAudit({
    user_id: guard.user.id,
    action: "leak.dismiss",
    entity_type: "leak_dismissal",
    entity_id: `${accountId}:${apiCode}`,
  });

  revalidatePath(`/accounts/${slug}`);
  revalidatePath("/accounts");
  revalidateRevenue();
  return { ok: true };
}

// Undo a dismissal — the historical leak resurfaces.
export async function restoreHistoricalLeak(
  accountId: number,
  apiCode: string,
  slug: string
): Promise<LeakActionResult> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) return { ok: false, error: guard.error };

  const sql = getSql();
  await sql`
    DELETE FROM leak_dismissals
    WHERE client_id = ${accountId} AND api_code = ${apiCode}
  `;
  await recordAudit({
    user_id: guard.user.id,
    action: "leak.restore",
    entity_type: "leak_dismissal",
    entity_id: `${accountId}:${apiCode}`,
  });

  revalidatePath(`/accounts/${slug}`);
  revalidatePath("/accounts");
  revalidateRevenue();
  return { ok: true };
}
