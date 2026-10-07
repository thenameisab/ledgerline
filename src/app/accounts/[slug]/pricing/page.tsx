import { notFound, redirect } from "next/navigation";
import { requireCan, can } from "@/lib/access";
import { getAccountBySlug, resolveAccountSlug } from "@/lib/repos/accounts";
import {
  getAccountPricing,
  getAccountUnpricedUsage,
  getAccountPricingContext,
} from "@/lib/repos/pricing";
import { getAccountBundles } from "@/lib/repos/bundles";
import { listApis } from "@/lib/repos/apis";
import { StatusBar } from "@/components/StatusBar";
import { AccountTabs } from "@/components/accounts/AccountTabs";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { PricingTable } from "./PricingTable";

export default async function PricingPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCan("pricing.edit");

  const account = await getAccountBySlug(params.slug);
  if (!account) {
    const current = await resolveAccountSlug(params.slug);
    if (current) redirect(`/accounts/${current}/pricing`);
    notFound();
  }

  const [pricingRows, unpricedUsage, allApis, bundles, context] = await Promise.all([
    getAccountPricing(Number(account.id)),
    getAccountUnpricedUsage(Number(account.id)),
    listApis(),
    getAccountBundles(Number(account.id)),
    getAccountPricingContext(Number(account.id)),
  ]);

  // APIs stitched into a bundle render inside their bundle group; their
  // individual pricing rows (if any) are ignored by the revenue view.
  const bundledCodes = new Set(bundles.flatMap((b) => b.members.map((m) => m.api_code)));

  // Used-but-unpriced APIs appear as default zero-price rows (the pairs the
  // account page flags as a revenue leak) — no manual "Add API" step needed.
  const rows = [
    ...unpricedUsage.map((u) => ({
      api_code: u.api_code,
      api_name: u.api_name,
      price_successful: 0,
      price_successful_no_data: 0,
      price_failed: 0,
      price_in_progress: 0,
      pricing_model: "flat" as const,
      slabs: [],
      effective_from: "",
      billed: false,
      unpriced: true,
      first_used: u.first_used,
      usage_hits: u.hits,
    })),
    ...pricingRows.filter((r) => !bundledCodes.has(r.api_code)),
  ];

  const shownCodes = new Set([...rows.map((r) => r.api_code), ...bundledCodes]);
  const availableApis = (allApis as any[])
    .filter((a) => !shownCodes.has(a.product_code))
    .map((a) => ({ product_code: a.product_code as string, name: a.name as string }));

  return (
    <main>
      <StatusBar
        title="Pricing"
        subtitle={account.display_name}
        leading={
          <AccountLogo name={account.display_name} logoUrl={account.logo_data_url} size={32} />
        }
      />
      <div className="px-7 pt-4">
        <AccountTabs slug={params.slug} showProfile={can(user.role, "account.update")} showPricing />
      </div>
      <div className="px-7 py-6">
        <PricingTable
          accountId={Number(account.id)}
          slug={params.slug}
          accountName={account.display_name}
          rows={rows}
          bundles={bundles}
          availableApis={availableApis}
          context={context}
        />
      </div>
    </main>
  );
}
