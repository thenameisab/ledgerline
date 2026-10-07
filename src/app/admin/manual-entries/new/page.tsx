import { requireCan } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import getSql from "@/lib/db";
import { listAccounts } from "@/lib/repos/accounts";
import { listApis } from "@/lib/repos/apis";
import { approvalThreshold } from "@/lib/repos/manual-entries";
import { ManualEntryWizard } from "@/components/ManualEntryWizard";

export default async function NewManualEntryPage() {
  await requireCan("manual_entry.edit");
  const sql = getSql();
  const [accounts, apis, vendorRows] = await Promise.all([
    listAccounts(),
    listApis(),
    sql`SELECT DISTINCT vendor FROM usage_daily WHERE vendor IS NOT NULL ORDER BY vendor`,
  ]);
  const vendors = (vendorRows as any[]).map((v) => v.vendor as string);

  return (
    <main>
      <StatusBar
        title="New manual entry"
        subtitle="Log off-stream bulk usage that didn't flow through the Console or SDK"
      />
      <div className="mx-auto w-full max-w-[1200px] px-7 py-6">
        <ManualEntryWizard
          accounts={accounts as any}
          apis={apis as any}
          vendors={vendors}
          approvalThreshold={approvalThreshold()}
        />
      </div>
    </main>
  );
}
