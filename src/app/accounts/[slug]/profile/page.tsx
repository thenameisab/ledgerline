import { notFound, redirect } from "next/navigation";
import { requireCan, can } from "@/lib/access";
import { getAccountBySlug, resolveAccountSlug } from "@/lib/repos/accounts";
import { listMergeTargets } from "@/lib/repos/account-merge";
import { StatusBar } from "@/components/StatusBar";
import { AccountTabs } from "@/components/accounts/AccountTabs";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { AccountProfileForm } from "@/components/accounts/AccountProfileForm";
import { AccountDangerControls } from "@/components/accounts/AccountDangerControls";

export default async function AccountProfileSettingsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCan("account.update");

  const account = await getAccountBySlug(params.slug);
  if (!account) {
    const current = await resolveAccountSlug(params.slug);
    if (current) redirect(`/accounts/${current}/profile`);
    notFound();
  }

  const mayMerge = can(user.role, "account.merge") && !account.deleted_at;
  const mergeTargets = mayMerge ? await listMergeTargets(Number(account.id)) : [];

  return (
    <main>
      <StatusBar
        title="Profile"
        subtitle={account.display_name}
        leading={
          <AccountLogo
            name={account.display_name}
            logoUrl={account.logo_data_url}
            size={32}
          />
        }
      />
      <div className="mx-auto w-full max-w-[1400px] px-7 pt-4">
        <AccountTabs slug={params.slug} showProfile showPricing />
      </div>
      <div className="mx-auto w-full max-w-[1400px] px-7 py-6">
        <AccountProfileForm
          slug={params.slug}
          displayName={account.display_name}
          initial={{
            client_code: account.client_code ?? null,
            billing_entity: account.billing_entity ?? null,
            website: account.website ?? null,
            cs_owner: account.cs_owner ?? null,
            sales_owner: account.sales_owner ?? null,
            logo_data_url: account.logo_data_url ?? null,
            msa_url: account.msa_url ?? null,
            msa_start_date: account.msa_start_date
              ? String(account.msa_start_date).slice(0, 10)
              : null,
            msa_end_date: account.msa_end_date
              ? String(account.msa_end_date).slice(0, 10)
              : null,
          }}
        />

        {mayMerge && (
          <section className="mt-10 rounded-lg border border-bad/40 p-5" aria-label="Danger zone">
            <h2 className="text-sm font-semibold text-ink">Danger zone</h2>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed max-w-[520px]">
              Merge this account into another (records, pricing, and aliases move to the target) or delete it. Both are reversible by an admin for a limited window
              {user.role === "admin" ? "." : " — your request will need admin approval."}
            </p>
            <div className="mt-4">
              <AccountDangerControls
                accountId={Number(account.id)}
                accountName={account.display_name}
                isAdmin={user.role === "admin"}
                mergeTargets={mergeTargets}
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
