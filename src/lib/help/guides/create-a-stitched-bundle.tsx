import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "create-a-stitched-bundle",
  title: "Create a stitched API bundle",
  summary: "Bill several APIs as one product: pick the members, mark the anchor, and set one agreed price.",
  group: "Pricing",
  role: "admin",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        Some contracts price a chain of APIs as a single call — for example a KYC journey that hits
        three internal APIs but bills once. A <em>stitch</em> models exactly that: usage still logs
        per API, but the account is billed once per hit of the <strong>anchor</strong> API at the
        agreed price, and the other members bill ₹0 without counting as revenue leak.
      </p>

      <H2 id="create">Create the stitch</H2>
      <Steps>
        <Step title="Open the account’s pricing page">
          From the account detail page, click <strong>Manage pricing</strong>. The{" "}
          <strong>Stitch APIs</strong> button appears once the account has at least two price rows.
        </Step>
        <Step title="Click “Stitch APIs” and name the bundle">
          Give it the contract’s name for the product, e.g. “KYC Prefill Combo”.
        </Step>
        <Step title="Pick the member APIs and mark the anchor">
          Check at least two APIs, then select the <strong>anchor</strong> radio on the API whose
          hit count equals one stitched call — usually the entry point of the chain.
        </Step>
        <Step title="Set the agreed price (₹/stitched call)">
          Four rates (S / ND / F / IP), applied to the anchor API’s hits by status. At least one
          must be non-zero.
        </Step>
        <Step title="Set “Effective from” and click “Create stitch”">
          Usage before the effective date keeps individual pricing; finalized invoices are never
          affected.
        </Step>
      </Steps>

      <Figure
        src="/help/shots/account-pricing.png"
        alt="The pricing table showing a stitched bundle group above the individual API rows"
        caption="A stitch renders as a header row with the bundle price, members indented beneath it."
      />

      <H2 id="after">How a stitch reads afterwards</H2>
      <ul>
        <li>
          In the pricing table the bundle is one editable row (chip: <em>stitched · N APIs</em>);
          members show <em>anchor</em> or <em>included</em> chips and “₹0 · in stitch”.
        </li>
        <li>
          On invoices the stitch appears as a single line at the bundle price — members are not
          listed separately.
        </li>
        <li>
          On the API detail page, accounts billed through a bundle carry a <em>stitched</em> chip in
          the consumers table.
        </li>
      </ul>

      <H2 id="edit">Edit or unstitch</H2>
      <p>
        Edit the bundle’s rates directly in its row and save like any other pricing change. To
        dissolve it, click the unlink icon at the end of the bundle row and confirm{" "}
        <strong>Unstitch</strong> — members return to individual pricing.
      </p>

      <Callout variant="warn">
        Once a stitch has billed on a finalized invoice it gains a <em>billed</em> lock: price
        edits insert a new row effective today, and unstitching is locked entirely.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/set-account-pricing", label: "Set or edit account pricing" },
          { href: "/help/guides/finalize-an-invoice", label: "Review and finalize an invoice" },
          { href: "/help/math", label: "Bundle pricing math" },
        ]}
      />
    </>
  );
}
