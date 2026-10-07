import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "account-pricing",
  title: "Account pricing",
  summary:
    "The per-account price book: four prices per SKU (one per call outcome), dated rows that apply prospectively, and supersede semantics that never rewrite history.",
  group: "Pricing",
  role: "admin",
  routes: ["/accounts"],
};

export default function Body() {
  return (
    <>
      <p>
        Every account negotiates their own rates, and those rates change over time. The pricing
        page is that contract as data: one row per (account, SKU) pair, four prices per row — one
        for each call outcome — and an effective-from date on everything. Revenue for any day is
        computed against the prices that were in force <em>that day</em>.
      </p>

      <Figure
        src="/help/shots/account-pricing.png"
        alt="Account pricing page with per-SKU rows showing four outcome prices and effective dates"
        caption="The price book: one row per SKU, four outcome prices, effective dates."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Priced rows</strong> — SKU name and code, status, effective-from date, and four
          prices: per successful, per no-data, per failed, and per in-progress unit. Each price is per unit of the SKU's billing unit, for example $3.00 per 1M tokens. Charging
          differently per outcome is the norm here (e.g. full price on success, a reduced rate on
          no-data, nothing on failure).
        </li>
        <li>
          <strong>Unpriced SKUs</strong> — SKUs this account has actually called with no price row
          yet, listed with an "unpriced" badge and when they were first used. This is the
          account-level view of revenue leak.
        </li>
        <li>
          <strong>Stitched bundles</strong> — if the account has bundles, they appear as a group
          with their member SKUs (see{" "}
          <a href="/help/features/stitched-bundles">Stitched SKU bundles</a>).
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Edit a price</strong> — click into the cell, type, and confirm. The edit writes
          a <em>new</em> dated row; the old row stays in history.
        </li>
        <li>
          <strong>Price an unpriced SKU</strong> — set rates on a leak row and the traffic starts
          counting from the price&rsquo;s effective date.
        </li>
        <li>
          <strong>Add a SKU</strong> — pick from the catalog to add a row before traffic even
          arrives.
        </li>
        <li>
          <strong>Void a row</strong> — retires the pair from active pricing without deleting its
          history.
        </li>
        <li>
          <strong>Create a bundle</strong> — stitch several SKUs into one invoice line.
        </li>
      </ul>

      <Callout variant="warn" title="Prospective only — and supersede after billing">
        Price changes apply from their effective date forward; Ledgerline has no retroactive price
        edits. Once a pair appears on a <em>finalized</em> invoice, edits supersede: the new row
        governs future usage, and the finalized lines stay exactly as issued.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>One active row per pair</strong> — a (account, SKU) pair can have only one
          non-voided row in force at a time; a new effective date closes the previous row.
        </li>
        <li>
          <strong>Validation</strong> — prices must be $0 or more; $0 is a legitimate "no charge"
          rate and is different from having no row at all (which is a leak).
        </li>
        <li>
          <strong>Members</strong> — editing is admin and editor only; members see pricing
          outcomes on the account profile but cannot open the book.
        </li>
        <li>
          <strong>Audited</strong> — every pricing change lands in the audit log with before and
          after values.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/stitched-bundles", label: "Stitched SKU bundles" },
          { href: "/help/features/unpriced-traffic", label: "Unpriced traffic detection" },
          { href: "/help/features/audit-log", label: "Audit log" },
          { href: "/help/math", label: "Temporal pricing math" },
        ]}
      />
    </>
  );
}
