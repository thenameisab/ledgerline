"use server";

import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/access";
import { recordAudit } from "@/lib/repos/audit";
import { AlertConfigError, saveAlertConfig } from "@/lib/repos/alerts";
import { setAlertRecipients, RoundupRecipientError } from "@/lib/repos/settings";
import { sendAlertTestEmail } from "@/lib/alerts/email";
import { ALERT_GROUPS, type AlertGroup } from "@/lib/alerts/config";
import type { RoundupActionResult } from "@/app/admin/settings/actions";

export type AlertSettingsResult = { ok: true } | { ok: false; error: string; field?: string };

/** Save rule switches and thresholds (stored form: shares as fractions). Admin only. */
export async function saveAlertSettings(input: {
  enabled: Record<string, boolean>;
  thresholds: Record<string, number>;
}): Promise<AlertSettingsResult> {
  // user.manage is admin-only in the policy, as for the other Settings tabs.
  const guard = await guardAction("user.manage");
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const { before, after } = await saveAlertConfig(input, guard.user.email);
    await recordAudit({
      user_id: guard.user.id,
      action: "alerts.config.update",
      entity_type: "app_setting",
      entity_id: "alerts.config",
      before,
      after,
    });
  } catch (err) {
    if (err instanceof AlertConfigError) return { ok: false, error: err.message, field: err.field };
    throw err;
  }
  revalidatePath("/admin/settings/alerts");
  return { ok: true };
}

// ── Alert email recipients ───────────────────────────────────────────────────
// Same admin-only guard and result shape as the roundup lists.

const isGroup = (g: string): g is AlertGroup => ALERT_GROUPS.some((x) => x.id === g);

/** Save one group's recipient list. Comma, space or newline separated input. */
export async function saveAlertRecipients(group: AlertGroup, raw: string): Promise<RoundupActionResult> {
  const guard = await guardAction("user.manage");
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!isGroup(group)) return { ok: false, error: "Unknown alert group." };
  const emails = raw.split(/[\s,;]+/).filter(Boolean);
  try {
    const recipients = await setAlertRecipients(group, emails, guard.user.email);
    return { ok: true, recipients };
  } catch (err) {
    if (err instanceof RoundupRecipientError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Send a test daily or critical alert email to the signed-in admin only. Writes nothing. */
export async function sendAlertEmailTest(kind: "daily" | "critical"): Promise<RoundupActionResult> {
  const guard = await guardAction("user.manage");
  if (!guard.ok) return { ok: false, error: guard.error };
  if (kind !== "daily" && kind !== "critical") return { ok: false, error: "Unknown email type." };
  const res = await sendAlertTestEmail(kind, guard.user.email);
  if (!res.ok) return res;
  return { ok: true, subject: res.subject };
}
