"use server";
import { guardAction } from "@/lib/access";
import {
  setRoundupRecipients,
  setProductUpdateRecipients,
  RoundupRecipientError,
  type RoundupKind,
  type UpdateProduct,
} from "@/lib/repos/settings";
import { sendRoundup } from "@/lib/roundup-send";
import { sendProductUpdate } from "@/lib/product-update-send";
import { isDateCovered } from "@/lib/repos/sync-runs";
import { todayIST, shiftISO } from "@/lib/repos/periods";

export type RoundupActionResult =
  | { ok: true; recipients?: string[]; subject?: string }
  | { ok: false; error: string };

/** Save one roundup kind's recipient list. Comma/space/newline separated input. */
export async function saveRoundupRecipients(
  kind: RoundupKind,
  raw: string
): Promise<RoundupActionResult> {
  // user.manage is admin-only in the policy — editors never reach this.
  const guard = await guardAction("user.manage");
  if (!guard.ok) return { ok: false, error: guard.error };
  const emails = raw.split(/[\s,;]+/).filter(Boolean);
  try {
    const recipients = await setRoundupRecipients(kind, emails, guard.user.email);
    return { ok: true, recipients };
  } catch (err) {
    if (err instanceof RoundupRecipientError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Build the real roundup and send it to the signed-in admin only. */
export async function sendRoundupTest(kind: RoundupKind): Promise<RoundupActionResult> {
  const guard = await guardAction("user.manage");
  if (!guard.ok) return { ok: false, error: guard.error };
  const res = await sendRoundup(kind, [guard.user.email]);
  const failure = res.failed?.[0];
  if (failure) return { ok: false, error: failure.error };
  return { ok: true, subject: res.subject };
}

/**
 * Send the roundup to its configured recipient list right now (on demand),
 * rather than waiting for the cron. Daily still respects the sync-readiness
 * gate — but silently (no operator alert email; the admin sees why in the UI).
 */
export async function sendRoundupNow(kind: RoundupKind): Promise<RoundupActionResult> {
  const guard = await guardAction("user.manage");
  if (!guard.ok) return { ok: false, error: guard.error };

  if (kind === "daily") {
    const yesterday = shiftISO(todayIST(), -1);
    if (!(await isDateCovered(yesterday))) {
      return { ok: false, error: `Not sent — ${yesterday} usage hasn't synced yet.` };
    }
  }

  const res = await sendRoundup(kind);
  if (res.skipped) return { ok: false, error: "No recipients configured — add some and save first." };
  const failure = res.failed?.[0];
  if (failure) return { ok: false, error: failure.error };
  return { ok: true, recipients: res.sent, subject: res.subject };
}

// ── Weekly product updates ───────────────────────────────────────────────────
// Same admin-only guard and result shape as the roundups; one list per product.

export async function saveProductUpdateRecipients(
  product: UpdateProduct,
  raw: string
): Promise<RoundupActionResult> {
  const guard = await guardAction("user.manage");
  if (!guard.ok) return { ok: false, error: guard.error };
  const emails = raw.split(/[\s,;]+/).filter(Boolean);
  try {
    const recipients = await setProductUpdateRecipients(product, emails, guard.user.email);
    return { ok: true, recipients };
  } catch (err) {
    if (err instanceof RoundupRecipientError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Build the real product update and send it to the signed-in admin only. */
export async function sendProductUpdateTest(product: UpdateProduct): Promise<RoundupActionResult> {
  const guard = await guardAction("user.manage");
  if (!guard.ok) return { ok: false, error: guard.error };
  const res = await sendProductUpdate(product, [guard.user.email]);
  const failure = res.failed?.[0];
  if (failure) return { ok: false, error: failure.error };
  return { ok: true, subject: res.subject };
}

/** Send the product update to its configured list right now. */
export async function sendProductUpdateNow(product: UpdateProduct): Promise<RoundupActionResult> {
  const guard = await guardAction("user.manage");
  if (!guard.ok) return { ok: false, error: guard.error };
  const res = await sendProductUpdate(product);
  if (res.skipped) return { ok: false, error: "No recipients configured — add some and save first." };
  const failure = res.failed?.[0];
  if (failure) return { ok: false, error: failure.error };
  return { ok: true, recipients: res.sent, subject: res.subject };
}
