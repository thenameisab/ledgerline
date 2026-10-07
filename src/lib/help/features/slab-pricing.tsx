import type { FeatureMeta } from "../types";
import { H2, Callout, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "slab-pricing",
  title: "Usage-slab pricing",
  summary:
    "Graduated volume tiers per SKU: the more units an account uses in a period, the cheaper each unit — priced marginally on the period's total volume.",
  group: "Pricing",
  role: "admin",
  routes: ["/accounts"],
};

export default function Body() {
  return (
    <>
      <p>
        Some contracts price a SKU on volume: the first slice of monthly units at one rate, the
        next slice cheaper, and so on. Usage-slab pricing encodes that directly on an account&rsquo;s
        pricing row. Tiers are <strong>graduated</strong> — like income-tax brackets — over the
        period&rsquo;s <strong>total units</strong>: a month of 1.2M SMS messages with tiers
        0&ndash;1M at $0.0079 per message and 1M+ at $0.0065 bills
        1,000,000&nbsp;×&nbsp;$0.0079 + 200,000&nbsp;×&nbsp;$0.0065 = $9,200, not all 1.2M at one
        rate.
      </p>

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>A <em>tier</em> toggle</strong> on each SKU row in the pricing table. A flat row
          shows the four per-unit rates; a tiered row shows a tier summary (&ldquo;3 tiers · $0.0079 →
          $0.0065 → $0.0052&rdquo;) and an edit button.
        </li>
        <li>
          <strong>The tier editor</strong> — a small grid of unit ranges, each with its own price for
          the four outcomes (successful, no-data, failed, in-progress). Leave a column at 0 when an
          outcome isn&rsquo;t billed.
        </li>
        <li>
          <strong>Correct totals everywhere</strong> — invoices, the dashboard headline, biggest
          movers, money-at-risk and the invoice-list drafts all reflect the graduated revenue.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Make a row tiered</strong> — click <em>tier</em>, add ranges, and set each
          tier&rsquo;s rates. Tiers must start at 0, be contiguous (no gaps or overlaps), and end in
          one open-ended top tier.
        </li>
        <li>
          <strong>Edit tiers</strong> — reopen the editor; saving follows the same temporal rules as
          flat pricing (a billed pair supersedes with a new dated row rather than rewriting history).
        </li>
        <li>
          <strong>Switch back to flat</strong> — <em>use flat</em> drops the tiers and restores a
          single per-unit rate.
        </li>
      </ul>

      <Callout variant="info" title="Bands are on total volume, prices are per outcome">
        Each tier is selected by the period&rsquo;s total units across all four outcomes; within a
        tier, that band&rsquo;s volume is split across outcomes by the period&rsquo;s mix and priced
        at the tier&rsquo;s per-outcome rate. When only the successful price is set, this reduces to
        the obvious graduated calculation.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Period-total, not per-day</strong> — because a tier depends on the whole
          period&rsquo;s volume, slab revenue is computed when an invoice (or dashboard window) is
          assembled, not day by day.
        </li>
        <li>
          <strong>Not revenue leak</strong> — a tiered SKU counts as priced even though its flat
          columns are 0, so it never shows up in the unpriced/leak callouts.
        </li>
        <li>
          <strong>New SKUs add as flat</strong> — add the SKU first, then toggle it to tiered.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/account-pricing", label: "Account pricing" },
          { href: "/help/features/stitched-bundles", label: "Stitched SKU bundles" },
          { href: "/help/guides/set-slab-pricing", label: "Set up tiered pricing" },
          { href: "/help/math#slabs", label: "Slab pricing math" },
        ]}
      />
    </>
  );
}
