import type { FeatureMeta } from "../types";
import { H2, Callout, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "vendor-reconciliation",
  title: "Vendor reconciliation",
  summary:
    "What each vendor says it served, against what Ledgerline counted — a per-month worklist of the pairs where the two disagree, and what the difference costs where a rate exists.",
  group: "Admin",
  role: "admin",
  routes: ["/vendors/reconciliation"],
};

export default function Body() {
  return (
    <>
      <p>
        The rate card answers what a unit costs. Reconciliation answers a different question:
        whether Ledgerline is counting the usage the vendor is going to invoice for. Two systems count
        the same traffic — the vendor&rsquo;s own report, and Ledgerline&rsquo;s usage log — and the
        queue lists every (vendor, SKU) pair where they disagree by more than a little.
      </p>
      <p>
        It exists in two places, with the same rows and the same rules. <strong>Vendors →
        Reconciliation</strong> is the cross-vendor queue, for deciding which vendor to look at
        first. The <strong>Reconciliation</strong> tab on a vendor&rsquo;s own page is the same
        list filtered to that vendor, for working through one. The vendor column is the only
        difference.
      </p>

      <H2 id="two-sides">The two sides</H2>
      <ul>
        <li>
          <strong>Vendor served</strong> — <code>vendor_usage_daily</code>, pulled from the
          upstream <code>vendor_usage_report</code> table by a daily sync. It runs after the
          customer-side usage sync, because comparing today&rsquo;s vendor data against
          yesterday&rsquo;s customer data would manufacture a difference. Each run re-pulls a
          trailing ten days, so a day that lands or is restated late is absorbed.
        </li>
        <li>
          <strong>Ledgerline counted</strong> — <code>usage_daily</code> read directly, not the
          revenue view. No pricing, bundle or revenue logic belongs in a volume check.
        </li>
      </ul>
      <p>
        The header line says how current the vendor side is (&ldquo;vendor data through&rdquo;).
        If it is blank, nothing has been pulled yet — run{" "}
        <code>npm run vendor-sync</code>.
      </p>

      <H2 id="what-counts">What each side counts</H2>
      <ul>
        <li>
          <strong>In-progress units are excluded on both sides.</strong> The vendor table has no
          in-progress column. Counting ours would show a permanent positive difference that is an
          artifact of the schema, not a finding — August&rsquo;s in-progress traffic alone is
          26,864 units.
        </li>
        <li>
          <strong>Sandbox traffic is included.</strong> Ledgerline does not bill a customer for
          sandbox usage, but the question here is what the vendor served, and it served that usage.
        </li>
        <li>
          <strong>Successful, no-data and failed are compared together</strong> as one unit count,
          and priced separately when the difference is valued.
        </li>
      </ul>

      <H2 id="flagging">When a pair is flagged</H2>
      <p>
        A pair is <strong>open</strong> when the difference exceeds <strong>2%</strong> and the
        larger of the two sides carries at least <strong>50 units</strong>. The unit floor is a
        disclosed rule, not a hidden filter: without it the queue fills with pairs like three units
        against one, which is a 200% difference and nothing to investigate. Both numbers are
        stated on the page.
      </p>

      <Callout variant="info" title="The totals agree; the attribution does not">
        Across June to September 2026 the two systems agree on total volume to well under a
        percent, and disagree by up to 349% on individual vendors. So a row here is almost never a
        counting error. It is usually volume a vendor served with no customer behind it — an
        internal test, a retry, usage Ledgerline never logged — or traffic attributed to the wrong
        vendor on one of the two sides.
      </Callout>

      <H2 id="reading-a-row">Reading a row</H2>
      <ul>
        <li>
          <strong>Difference</strong> — Ledgerline&rsquo;s count minus the vendor&rsquo;s, as a number
          and a percentage of the vendor&rsquo;s. Past 999% only the sign is shown; nobody reads a
          661,233% figure.
        </li>
        <li>
          <strong>Gap at our rate</strong> — the unreconciled units priced at this vendor&rsquo;s
          rate for this SKU, outcome by outcome. A <em>positive</em> figure, shown in red, is
          volume the vendor served that Ledgerline never costed: money we are likely to be billed for
          and have not counted. A negative one means Ledgerline counted more than the vendor reports
          serving. That is still a discrepancy, but no money is at stake, so it is shown muted.
        </li>
        <li>
          <strong>no rate</strong> — the pair has no rate on the rate card, so the gap cannot be
          valued. The gap is real either way; only its cost is unknown. Most pairs are in this
          state today, which is why the headline figure is labelled <em>priced gaps only</em>.
        </li>
      </ul>

      <H2 id="unmatched">Vendor names that match no SKU</H2>
      <p>
        The vendor-side table carries no SKU code, only the vendor&rsquo;s own name for each
        SKU. Those names are matched against each SKU&rsquo;s catalog name and its log aliases.
        What does not match reconciles against nothing, so it is listed separately, above the
        table, with its volume.
      </p>
      <p>
        Closing one is the same fix as an unmapped log name: add the vendor&rsquo;s spelling as an
        alias on the right SKU, then re-run <code>npm run vendor-sync</code> to repair the
        history. The sync is idempotent, so re-pulling a window restates it.
      </p>
      <Callout variant="warn" title="An identifier two SKUs both claim is dropped">
        Name matching refuses an ambiguous identifier rather than guessing. If two catalog entries
        claim the same alias, neither gets the traffic and the name reads as unmatched even though
        an alias for it exists. Three such collisions were found catalog-wide; the fix is to
        remove the alias from the SKU that does not serve it.
      </Callout>

      <H2 id="accepting">Accepting an item</H2>
      <p>
        <strong>Accept</strong> records that a difference has been looked at and explained, and
        moves it out of the open list. It is scoped to <strong>one month</strong>, deliberately
        narrower than dismissing an unpriced pair, which suppresses it forever.
        &ldquo;August&rsquo;s Northbeam Telecom gap is internal test traffic&rdquo; says nothing about
        September, and a permanent dismissal would hide the month the gap changes shape. The
        filter strip keeps accepted items one click away, and accepting can be undone.
      </p>

      <H2 id="not">What this does not do</H2>
      <p>
        This compares <em>volume</em>, not an invoice. No vendor bill has ever been loaded into
        Ledgerline, so nothing here has been checked against what a vendor actually charged. A pair
        can reconcile perfectly on units and still be billed at a rate nobody has recorded.
        Reconciliation narrows where to look; the rate card is where the money is decided.
      </p>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>A pair on one side only</strong> — kept, not dropped. A vendor serving a SKU
          Ledgerline never logged, and traffic Ledgerline attributes to a vendor that reports none of it,
          are both findings.
        </li>
        <li>
          <strong>Two vendor names for one SKU</strong> — once both are aliased to the same code
          they reconcile as a single item, not two.
        </li>
        <li>
          <strong>A custom date range</strong> — the comparison follows the range, but an
          acceptance is filed against the month the range opens in.
        </li>
        <li>
          <strong>Who can see this</strong> — admin only, the same gate as the rate card it feeds.
          Editors see the margin vendor costs produce, never a vendor&rsquo;s per-unit rate or this
          queue.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/vendor-costs", label: "Vendor costs" },
          { href: "/help/features/aliases", label: "Name aliases" },
          { href: "/help/features/sku-review", label: "SKU review" },
        ]}
      />
    </>
  );
}
