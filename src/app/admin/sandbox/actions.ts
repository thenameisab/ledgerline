"use server";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/access";
import { setSandboxBillingRule } from "@/lib/repos/sandbox-billing";
import { setIncludeSandbox } from "@/lib/repos/settings";

// The app-wide default: the base of the precedence chain that account-wide and
// per-API rules override. It sits on the same page as those rules. Admin-only — editors set
// per-pair rules but don't move the app-wide default.
export async function setSandboxPreference(enabled: boolean) {
  const guard = await guardAction("vendor_pricing.edit");
  if (!guard.ok) return guard;
  await setIncludeSandbox(enabled, guard.user.email);
  revalidatePath("/admin/sandbox");
  return { ok: true as const };
}

// mode → billable_hits: none = 0, all = null, cap = the given number.
export async function saveSandboxRule(input: {
  accountId: number;
  apiCode: string;
  mode: "none" | "all" | "cap";
  hits?: number;
}) {
  const guard = await guardAction("sandbox_billing.edit");
  if (!guard.ok) return guard;

  const billableHits =
    input.mode === "none" ? 0 : input.mode === "all" ? null : Math.max(0, Math.trunc(input.hits ?? 0));

  await setSandboxBillingRule({
    accountId: input.accountId,
    apiCode: input.apiCode,
    billableHits,
    actor: guard.user.email,
  });
  revalidatePath("/admin/sandbox");
  return { ok: true as const };
}
