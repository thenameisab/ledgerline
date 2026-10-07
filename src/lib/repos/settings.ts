// App-wide shared settings. One authoritative value per key, the same for
// every user.
//
// The sandbox toggle drives BOTH report views and billing: dashboard reads
// pass includeSandbox as an argument (so the revenue cache keys on it), while
// deriveStatement resolves it directly. Toggling busts the settings cache and
// revalidates the report paths so every surface re-reads the new value.

import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";
import { config } from "../config";
import getSql from "../db";
import { revalidateRevenue } from "../cache";
import { alertRecipientsKey, type AlertGroup } from "../alerts/config";

const SETTINGS_TAG = "app-settings";
const INCLUDE_SANDBOX_KEY = "include_sandbox";

async function getSettingImpl(key: string): Promise<string | null> {
  const sql = getSql();
  const [row] = await sql`SELECT value FROM app_settings WHERE key = ${key}`;
  return row ? (row.value as string) : null;
}

const getSettingCached = unstable_cache(getSettingImpl, ["app-setting"], { tags: [SETTINGS_TAG] });

// unstable_cache only works inside the Next server (it needs the incremental
// cache runtime). The seed / CLI harness calls this module too — there, fall
// back to the uncached query rather than crashing.
async function getSetting(key: string): Promise<string | null> {
  try {
    return await getSettingCached(key);
  } catch (e) {
    if (e instanceof Error && /incrementalCache missing/.test(e.message)) {
      return getSettingImpl(key);
    }
    throw e;
  }
}

/** Whether sandbox usage is included app-wide. Missing row → false (default off). */
export async function getIncludeSandbox(): Promise<boolean> {
  return (await getSetting(INCLUDE_SANDBOX_KEY)) === "1";
}

/** Set the shared sandbox preference and invalidate every dependent read. */
export async function setIncludeSandbox(enabled: boolean, actor: string | null) {
  const sql = getSql();
  await sql`
    INSERT INTO app_settings (key, value, updated_by)
    VALUES (${INCLUDE_SANDBOX_KEY}, ${enabled ? "1" : "0"}, ${actor})
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
  `;
  // The setting itself, plus every revenue read whose result depends on it.
  revalidateTag(SETTINGS_TAG);
  revalidateRevenue();
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}

// ── Email recipient lists ────────────────────────────────────────────────────
// Admin-configured distribution lists, stored as a JSON array under one
// app_settings key per list. An empty (or missing) list disables that email —
// the cron skips it. Only allowed-domain addresses are accepted.

export type RoundupKind = "daily" | "weekly" | "monthly";

/** Weekly product usage update. One product, so one value. */
export type UpdateProduct = "usage";

const roundupKey = (kind: RoundupKind) => `roundup.${kind}.recipients`;
const productUpdateKey = (product: UpdateProduct) => `product_update.${product}.recipients`;

export class RoundupRecipientError extends Error {
  constructor(public invalid: string[]) {
    super(`Only @${config.auth.allowedEmailDomain} addresses are allowed: ${invalid.join(", ")}`);
  }
}

async function getRecipientList(key: string): Promise<string[]> {
  const raw = await getSetting(key);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
}

/** Validate, dedupe, and persist one recipient list. */
async function setRecipientList(key: string, emails: string[], actor: string | null): Promise<string[]> {
  const cleaned = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  );
  const domain = config.auth.allowedEmailDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const invalid = cleaned.filter(
    (e) => !new RegExp(`^[a-z0-9._%+-]+@${domain}$`).test(e)
  );
  if (invalid.length > 0) throw new RoundupRecipientError(invalid);

  const sql = getSql();
  await sql`
    INSERT INTO app_settings (key, value, updated_by)
    VALUES (${key}, ${JSON.stringify(cleaned)}, ${actor})
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
  `;
  revalidateTag(SETTINGS_TAG);
  revalidatePath("/admin/settings");
  return cleaned;
}

export async function getRoundupRecipients(kind: RoundupKind): Promise<string[]> {
  return getRecipientList(roundupKey(kind));
}

export async function setRoundupRecipients(
  kind: RoundupKind,
  emails: string[],
  actor: string | null
): Promise<string[]> {
  return setRecipientList(roundupKey(kind), emails, actor);
}

export async function getAlertRecipients(group: AlertGroup): Promise<string[]> {
  return getRecipientList(alertRecipientsKey(group));
}

export async function setAlertRecipients(group: AlertGroup, emails: string[], actor: string | null): Promise<string[]> {
  const saved = await setRecipientList(alertRecipientsKey(group), emails, actor);
  revalidatePath("/admin/settings/alerts");
  return saved;
}

export async function getProductUpdateRecipients(product: UpdateProduct): Promise<string[]> {
  return getRecipientList(productUpdateKey(product));
}

export async function setProductUpdateRecipients(
  product: UpdateProduct,
  emails: string[],
  actor: string | null
): Promise<string[]> {
  return setRecipientList(productUpdateKey(product), emails, actor);
}
