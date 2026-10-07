import type { FeatureMeta } from "../types";
import { H2, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "sku-page",
  title: "SKU page",
  summary:
    "One SKU across all its consumers: revenue, margin, a 90-day heatmap, and a price ladder showing exactly who pays what for the same product.",
  group: "SKUs",
  role: "all",
  routes: ["/skus"],
};

export default function Body() {
  return (
    <>
      <p>
        The SKU page answers the pricing question the catalog can&rsquo;t: for this one
        product, who consumes it, and at what rate? Because every account negotiates separately,
        the same SKU can earn $2.40 per 1M tokens from one account and $3.00 from another — the price ladder
        makes that spread impossible to miss.
      </p>

      <Figure
        src="/help/shots/api-detail.png"
        alt="SKU page with headline revenue, briefing, activity heatmap, and the account consumers table with price ladder"
        caption="Headline, heatmap, and the consumer table with its price ladder."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Subtitle</strong> — the SKU code, the billing unit (&ldquo;Billed per 1M
          tokens&rdquo;), and the vendor type.
        </li>
        <li>
          <strong>Headline</strong> — MTD revenue with a MoM delta pill, the written briefing
          (top consumer and share, margin, price spread), and secondary stats: units, unique
          accounts, average price per unit (for example &ldquo;$2.85 / 1M tokens&rdquo;), margin.
        </li>
        <li>
          <strong>Price spread</strong> — when consumers pay different rates, the range
          ("$X–$Y") is surfaced right in the headline.
        </li>
        <li>
          <strong>Activity heatmap</strong> — 90 days of daily usage in units.
        </li>
        <li>
          <strong>Consumers table</strong> — each account with units, their negotiated price per
          unit, a ladder bar comparing it against the highest payer, and revenue. Accounts consuming
          through a bundle carry a <em>stitched</em> chip; accounts with no price row carry a red{" "}
          <em>unpriced</em> chip.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Jump to a consumer</strong> — account names link to their profiles; their price
          row lives on the account&rsquo;s pricing page.
        </li>
        <li>
          <strong>Edit the SKU (admin)</strong> — name, category, billing unit, vendor type, entity type,
          and log aliases, via the edit modal (see{" "}
          <a href="/help/features/sku-governance">SKU governance</a>).
        </li>
        <li>
          <strong>Use the ladder in negotiations</strong> — an outlier at the bottom of the ladder
          is a repricing conversation waiting to happen.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>No consumers</strong> — the table renders empty; the SKU exists in the catalog
          but nothing routes to it yet.
        </li>
        <li>
          <strong>Single consumer</strong> — no spread to show, so the price-range line is
          omitted rather than printing "$X–$X".
        </li>
        <li>
          <strong>Bundle members</strong> — a member SKU&rsquo;s own revenue can legitimately read
          zero for a stitched account; the bundle&rsquo;s anchor carries the money.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/sku-catalog", label: "SKU catalog" },
          { href: "/help/features/sku-governance", label: "SKU governance" },
          { href: "/help/features/stitched-bundles", label: "Stitched SKU bundles" },
          { href: "/help/features/account-pricing", label: "Account pricing" },
        ]}
      />
    </>
  );
}
