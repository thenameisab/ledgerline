import type { FeatureMeta } from "../types";
import { H2, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "api-profile",
  title: "API profile",
  summary:
    "One API across all its consumers: revenue, margin, a 90-day heatmap, and a price ladder showing exactly who pays what for the same product.",
  group: "APIs",
  role: "all",
  routes: ["/apis"],
};

export default function Body() {
  return (
    <>
      <p>
        The API profile answers the pricing question the catalog can&rsquo;t: for this one
        product, who consumes it, and at what rate? Because every account negotiates separately,
        the same API can earn ₹2 per hit from one account and ₹9 from another — the price ladder
        makes that spread impossible to miss.
      </p>

      <Figure
        src="/help/shots/api-detail.png"
        alt="API profile with headline revenue, briefing, activity heatmap, and the account consumers table with price ladder"
        caption="Headline, heatmap, and the consumer table with its price ladder."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Headline</strong> — MTD revenue with a MoM delta pill, the written briefing
          (top consumer and share, margin, price spread), and secondary stats: hits, unique
          accounts, average ₹/hit, margin.
        </li>
        <li>
          <strong>Price spread</strong> — when consumers pay different rates, the range
          ("₹X–Y per hit") is surfaced right in the headline.
        </li>
        <li>
          <strong>Activity heatmap</strong> — 90 days of daily hit volume.
        </li>
        <li>
          <strong>Consumers table</strong> — each account with hits, their negotiated price per
          hit, a ladder bar comparing it against the highest payer, and revenue. Accounts consuming
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
          <strong>Edit the API (admin)</strong> — name, category, vendor type, entity type, and
          log aliases, via the edit modal (see{" "}
          <a href="/help/features/api-governance">API governance</a>).
        </li>
        <li>
          <strong>Use the ladder in negotiations</strong> — an outlier at the bottom of the ladder
          is a repricing conversation waiting to happen.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>No consumers</strong> — the table renders empty; the API exists in the catalog
          but nothing routes to it yet.
        </li>
        <li>
          <strong>Single consumer</strong> — no spread to show, so the price-range line is
          omitted rather than printing "₹X–X".
        </li>
        <li>
          <strong>Bundle members</strong> — a member API&rsquo;s own revenue can legitimately read
          zero for a stitched account; the bundle&rsquo;s anchor carries the money.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/api-catalog", label: "API catalog" },
          { href: "/help/features/api-governance", label: "API governance" },
          { href: "/help/features/stitched-bundles", label: "Stitched API bundles" },
          { href: "/help/features/account-pricing", label: "Account pricing" },
        ]}
      />
    </>
  );
}
