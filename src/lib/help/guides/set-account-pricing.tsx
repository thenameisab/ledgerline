import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Kbd, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "set-account-pricing",
  title: "Set or edit account pricing",
  summary: "Edit per-SKU rates on an account's price book, add new SKUs, and understand how temporal pricing protects history.",
  group: "Pricing",
  role: "admin",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        Each account has a price book: one row per SKU, with four rates — per successful (S),
        no-data (ND), failed (F), and in-progress (IP) unit. A unit is the SKU&rsquo;s billing
        unit, for example 1M tokens or one message. Edits are staged in the table and saved
        in one batch.
      </p>

      <Figure
        src="/help/shots/account-pricing.png"
        alt="The account pricing table with editable rate cells and the Stitch SKUs and Add SKU buttons"
        caption="The pricing editor. Edited rows are highlighted until you save."
      />

      <H2 id="edit">Edit existing rates</H2>
      <Steps>
        <Step title="Open the account’s pricing page">
          From the account detail page, click <strong>Manage pricing</strong> (next to the SKU
          breakdown). The page is admin and editor only.
        </Step>
        <Step title="Type into the rate cells">
          Each row has four $ inputs: <strong>S</strong>, <strong>ND</strong>, <strong>F</strong>,{" "}
          <strong>IP</strong> ($ per unit). Press <Kbd>Enter</Kbd> or click away to commit a cell;{" "}
          <Kbd>Esc</Kbd> restores its previous value. Changed rows turn accent-tinted and gain an{" "}
          <em>edited</em> chip.
        </Step>
        <Step title="Save the batch">
          A sticky bar appears at the bottom counting unsaved changes. Click{" "}
          <strong>Save change</strong> (or <strong>Save N changes</strong>) to write them all, or{" "}
          <strong>Discard</strong> to throw them away. Use the <strong>×</strong> at the end of a
          row to revert just that row.
        </Step>
      </Steps>

      <H2 id="add">Add a SKU to the price book</H2>
      <Steps>
        <Step title="Click “Add SKU”">
          The button appears in the header when there are catalog SKUs this account does not yet
          have a row for.
        </Step>
        <Step title="Fill the new row">
          Pick the SKU from the dropdown, enter the four rates, and set{" "}
          <strong>Effective from</strong> (defaults to today). The row saves with the rest of the
          batch.
        </Step>
      </Steps>

      <H2 id="temporal">How temporal pricing behaves</H2>
      <p>Three rules keep history honest:</p>
      <ul>
        <li>
          <strong>Prospective edits.</strong> A rate change applies from its effective date
          forward; usage already priced under the old rate keeps it.
        </li>
        <li>
          <strong>Billed rows are protected.</strong> Rows carrying a <em>billed</em> lock chip
          have appeared on a finalized invoice. Editing one does not rewrite it — a new row is
          inserted effective today, shown as “→ today” in the Effective from column.
        </li>
        <li>
          <strong>Unpriced rows backfill.</strong> Rows flagged <em>unpriced</em> (red) have logged
          traffic but no rate. Saving a rate inserts a row effective from the pair’s first usage,
          shown as “→ &lt;date&gt;”, so the traffic already logged starts billing.
        </li>
      </ul>

      <Callout variant="warn">
        Finalized invoices are never changed by pricing edits — their numbers are snapshotted. If a
        finalized invoice billed the wrong rate, correct it with an invoice adjustment instead.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/fix-unpriced-traffic", label: "Fix unpriced traffic" },
          { href: "/help/guides/create-a-stitched-bundle", label: "Create a stitched SKU bundle" },
          { href: "/help/guides/add-an-invoice-adjustment", label: "Add a credit or charge to an invoice" },
          { href: "/help/math", label: "Temporal pricing math" },
        ]}
      />
    </>
  );
}
