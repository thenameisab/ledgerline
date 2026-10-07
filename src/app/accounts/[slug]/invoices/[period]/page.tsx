import { notFound, redirect } from "next/navigation";
import { StatusBar } from "@/components/StatusBar";
import { InvoiceReceipt } from "@/components/InvoiceReceipt";
import { getAccount, getAccountBySlug, resolveAccountSlug } from "@/lib/repos/accounts";
import { deriveStatement } from "@/lib/repos/statements";
import { formatDateTime } from "@/lib/format";
import { getSessionUser, canViewCost } from "@/lib/access";
import { FileText, Lock } from "lucide-react";
import { InvoiceActions } from "./InvoiceActions";
import { InvoiceExportMenu } from "@/components/invoices/InvoiceExportMenu";

export default async function InvoicePreviewPage({
  params,
}: {
  params: { slug: string; period: string };
}) {
  // Support legacy numeric account IDs
  if (/^\d+$/.test(params.slug)) {
    const legacy = await getAccount(Number(params.slug));
    if (!legacy?.slug) notFound();
    redirect(`/accounts/${legacy.slug}/invoices/${params.period}`);
  }

  const account = await getAccountBySlug(params.slug);
  if (!account) {
    const current = await resolveAccountSlug(params.slug);
    if (current) redirect(`/accounts/${current}/invoices/${params.period}`);
    notFound();
  }
  const accountId = Number(account.id);
  const accountSlug = params.slug;
  const periodId = Number(params.period);

  const [data, user] = await Promise.all([
    deriveStatement(accountId, periodId),
    getSessionUser(),
  ]);
  if (!data) notFound();
  const isAdmin = user?.role === "admin";
  // Editing a finalized invoice is an admin action; reading the margin on it is
  // the derived figure an editor may see.
  const showCost = canViewCost(user?.role ?? "member");


  return (
    <main className="min-h-screen bg-bg">
      <StatusBar
        title={`Invoice ${data.header.number}`}
        subtitle={`${data.header.account.display_name} · ${data.header.period.label}`}
      />

      <div className="px-4 md:px-8 py-6 max-w-screen-xl mx-auto">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-6 pb-5 border-b border-border gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-ink-faint">
            {data.header.status === "draft" ? (
              <span>Draft — derives live from usage</span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <Lock size={11} strokeWidth={1.75} />
                  Numbers locked
                </span>
                <span>Generated {formatDateTime(data.header.generated_at)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <InvoiceActions
              accountId={accountId}
              accountSlug={accountSlug}
              periodId={periodId}
              status={data.header.status}
              hasLines={data.lines.length > 0}
              canAct={!!isAdmin}
              draftNumber={data.header.number}
              periodLabel={data.header.period.label}
            />
            <InvoiceExportMenu accountId={accountId} periodId={periodId} showInternal={!!isAdmin} />
          </div>
        </div>

        <InvoiceReceipt
          data={data}
          accountId={accountId}
          accountSlug={accountSlug}
          periodId={periodId}
          canEdit={!!isAdmin}
          showCost={showCost}
          confidence={showCost ? (data?.cost_confidence ?? null) : null}
        />

        <p className="text-xs text-ink-faint text-center mt-5">
          <FileText size={11} strokeWidth={1.5} className="inline mb-0.5 mr-1" />
          The downloaded PDF matches this layout exactly.
        </p>
      </div>
    </main>
  );
}
