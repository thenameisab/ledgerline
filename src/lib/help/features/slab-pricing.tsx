import type { FeatureMeta } from "../types";
import { H2, Callout, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "slab-pricing",
  title: "Usage-slab pricing",
  summary:
    "Graduated volume tiers per API: the more hits an account sends in a period, the cheaper each hit — priced marginally on the period's total volume.",
  group: "Pricing",
  role: "admin",
  routes: ["/accounts"],
};

export default function Body() {
  return (
    <>
      <p>
        Some contracts price an API on volume: the first slice of monthly hits at one rate, the
        next slice cheaper, and so on. Usage-slab pricing encodes that directly on an account&rsquo;s
        pricing row. Tiers are <strong>graduated</strong> — like income-tax brackets — over the
        period&rsquo;s <strong>total hits</strong>: a month of 45,000 hits with tiers 0&ndash;40k at
        ₹15 and 40k+ at ₹13 bills 40,000&nbsp;×&nbsp;₹15 + 5,000&nbsp;×&nbsp;₹13, not all 45,000 at
        one rate.
      </p>

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>A <em>tier</em> toggle</strong> on each API row in the pricing table. A flat row
          shows the four per-hit rates; a tiered row shows a tier summary (&ldquo;3 tiers · ₹15 →
          ₹13 → ₹11&rdquo;) and an edit button.
        </li>
        <li>
          <strong>The tier editor</strong> — a small grid of hit ranges, each with its own price for
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
          single per-hit rate.
        </li>
      </ul>

      <Callout variant="info" title="Bands are on total volume, prices are per outcome">
        Each tier is selected by the period&rsquo;s total hits across all four outcomes; within a
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
          <strong>Not revenue leak</strong> — a tiered API counts as priced even though its flat
          columns are 0, so it never shows up in the unpriced/leak callouts.
        </li>
        <li>
          <strong>New APIs add as flat</strong> — add the API first, then toggle it to tiered.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/account-pricing", label: "Account pricing" },
          { href: "/help/features/stitched-bundles", label: "Stitched API bundles" },
          { href: "/help/guides/set-slab-pricing", label: "Set up tiered pricing" },
          { href: "/help/math#slabs", label: "Slab pricing math" },
        ]}
      />
    </>
  );
}
