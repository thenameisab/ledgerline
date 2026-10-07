import Link from "next/link";
import { requireCan, getSessionUser, can } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { SandboxRuleForm } from "@/components/admin/SandboxRuleForm";
import { SandboxGlobalToggle } from "@/components/admin/SandboxGlobalToggle";
import { listSandboxCases } from "@/lib/repos/sandbox-billing";
import { getIncludeSandbox } from "@/lib/repos/settings";
import { resolvePeriod } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function SandboxBillingPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string };
}) {
  await requireCan("sandbox_billing.edit");
  const user = await getSessionUser();
  const window = resolvePeriod(searchParams);
  const [cases, globalOn] = await Promise.all([listSandboxCases(window), getIncludeSandbox()]);
  // Same guard the action enforces — the app-wide default is admin-only.
  const canSetDefault = can(user?.role ?? "member", "vendor_pricing.edit");

  return (
    <main>
      <StatusBar
        title="Sandbox billing"
        subtitle={
          cases.length === 0
            ? "No sandbox traffic this period."
            : `${cases.length} account·SKU pair${cases.length === 1 ? "" : "s"} using sandbox this period`
        }
      />
      <div className="mx-auto w-full max-w-[1100px] px-7 pt-5">
        <DateRangePicker from={window.from} to={window.to} />
      </div>
      <div className="mx-auto w-full max-w-[1100px] px-7 py-6 space-y-5">
        <p className="text-sm text-ink-muted max-w-2xl">
          Live customers sometimes keep calling the sandbox environment. Each pair below can be
          billed in full, in part (up to a capped number of successful units per period), or not at
          all. A per-SKU rule overrides an account-wide rule, which overrides the app-wide default
          below. Rules take effect on the next invoice compute.
        </p>

        {/* The whole chain on one page: default first, then the overrides. */}
        <SandboxGlobalToggle enabled={globalOn} canEdit={canSetDefault} />

        {cases.length > 0 && (
          <div className="elev-1 bg-bg-raised rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted border-b border-border">
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">SKU</th>
                  <th className="px-4 py-2.5 font-medium text-right">Sandbox successful</th>
                  <th className="px-4 py-2.5 font-medium">Billing policy</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={`${c.client_id}:${c.api_code}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/accounts/${c.account_slug}`}
                        className="text-ink hover:text-accent-ink"
                      >
                        {c.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {c.api_name}{" "}
                      <span className="text-ink-faint font-mono text-xs">{c.api_code}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                      {c.sandbox_successful.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-2.5">
                      <SandboxRuleForm
                        accountId={c.client_id}
                        apiCode={c.api_code}
                        sandboxSuccessful={c.sandbox_successful}
                        cap={c.cap}
                        ruleScope={c.rule_scope}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
