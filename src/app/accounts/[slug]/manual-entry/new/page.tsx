import { notFound, redirect } from "next/navigation";
import { StatusBar } from "@/components/StatusBar";
import getSql from "@/lib/db";
import { getAccount, getAccountBySlug, resolveAccountSlug, listAccounts } from "@/lib/repos/accounts";
import { listApis } from "@/lib/repos/apis";
import { approvalThreshold } from "@/lib/repos/manual-entries";
import { ManualEntryWizard } from "@/components/ManualEntryWizard";

export default async function AccountManualEntryNewPage({
  params,
}: {
  params: { slug: string };
}) {
  // Support legacy numeric account IDs
  if (/^\d+$/.test(params.slug)) {
    const legacy = await getAccount(Number(params.slug));
    if (!legacy?.slug) notFound();
    redirect(`/accounts/${legacy.slug}/manual-entry/new`);
  }

  const account = await getAccountBySlug(params.slug);
  if (!account) {
    const current = await resolveAccountSlug(params.slug);
    if (current) redirect(`/accounts/${current}/manual-entry/new`);
    notFound();
  }
  const accountId = Number(account.id);

  const sql = getSql();
  const [apis, allAccounts, vendorRows] = await Promise.all([
    listApis(),
    listAccounts(),
    sql`SELECT DISTINCT vendor FROM usage_daily WHERE vendor IS NOT NULL ORDER BY vendor`,
  ]);

  const vendors = (vendorRows as any[]).map((v) => v.vendor as string);
  const accountsOpt = (allAccounts as any[]).filter((c) => Number(c.id) === accountId);

  return (
    <main>
      <StatusBar
        title={`Manual entry · ${account.display_name}`}
        subtitle="Log off-stream bulk usage. After saving, the lines appear in the API breakdown below."
      />
      <div className="mx-auto w-full max-w-[1200px] px-7 py-6">
        <ManualEntryWizard
          accounts={accountsOpt}
          apis={apis as any}
          vendors={vendors}
          approvalThreshold={approvalThreshold()}
          lockedAccountId={accountId}
          returnTo={`/accounts/${params.slug}`}
        />
      </div>
    </main>
  );
}
