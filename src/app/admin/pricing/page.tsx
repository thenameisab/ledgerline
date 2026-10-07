import { CircleDollarSign } from "lucide-react";
import { requireRole } from "@/lib/access";
import { getUnpricedPairs, getAllPricingPairs } from "@/lib/repos/pricing";
import { StatusBar } from "@/components/StatusBar";
import { PricingMatrix } from "./PricingMatrix";

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  await requireRole("admin");

  const filter = searchParams.filter === "all" ? "all" : "unpriced";
  const [unpriced, all] = await Promise.all([
    getUnpricedPairs(),
    getAllPricingPairs(),
  ]);

  return (
    <main>
      {/* Titled for the queue it is, matching the sidebar's Review entry. The
          "All" filter inside the page is the secondary view. */}
      <StatusBar
        title="Unpriced"
        subtitle={
          unpriced.length === 0
            ? `Every account·SKU pair with traffic has a price · ${all.length} priced`
            : `${unpriced.length} account·SKU pair${unpriced.length === 1 ? "" : "s"} with traffic and no price · ${all.length} priced`
        }
        leading={<CircleDollarSign size={20} strokeWidth={1.75} className="text-ink-muted" />}
      />
      <div className="mx-auto w-full max-w-[1600px] px-7 py-6">
        <PricingMatrix
          filter={filter}
          rows={filter === "unpriced" ? unpriced : all}
          unpricedCount={unpriced.length}
          allCount={all.length}
        />
      </div>
    </main>
  );
}
