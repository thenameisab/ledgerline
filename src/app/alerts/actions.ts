"use server";

import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/access";
import { acknowledgeAlert, acknowledgeAlerts, restoreAlert, snoozeAlert } from "@/lib/repos/alerts";

export type AlertActionResult = { ok: true } | { ok: false; error: string };

const STALE = "This alert changed since the page loaded. Reload to see its current state.";

export async function acknowledgeAlertAction(id: number): Promise<AlertActionResult> {
  const guard = await guardAction("alert.act");
  if (!guard.ok) return { ok: false, error: guard.error };
  const ok = await acknowledgeAlert(id, guard.user.id);
  revalidatePath("/alerts");
  return ok ? { ok: true } : { ok: false, error: STALE };
}

export async function acknowledgeAlertsAction(ids: number[]): Promise<AlertActionResult & { count?: number }> {
  const guard = await guardAction("alert.act");
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!Array.isArray(ids) || ids.length > 200 || !ids.every((id) => Number.isInteger(id))) return { ok: false, error: "Invalid alert list." };
  const count = await acknowledgeAlerts(ids, guard.user.id);
  revalidatePath("/alerts");
  return count > 0 ? { ok: true, count } : { ok: false, error: STALE };
}

export async function snoozeAlertAction(id: number, days: number): Promise<AlertActionResult> {
  const guard = await guardAction("alert.act");
  if (!guard.ok) return { ok: false, error: guard.error };
  const ok = await snoozeAlert(id, guard.user.id, days);
  revalidatePath("/alerts");
  return ok ? { ok: true } : { ok: false, error: STALE };
}

export async function restoreAlertAction(id: number): Promise<AlertActionResult> {
  const guard = await guardAction("alert.act");
  if (!guard.ok) return { ok: false, error: guard.error };
  const ok = await restoreAlert(id);
  revalidatePath("/alerts");
  return ok ? { ok: true } : { ok: false, error: STALE };
}
