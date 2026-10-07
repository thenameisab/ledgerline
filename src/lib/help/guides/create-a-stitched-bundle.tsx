import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "create-a-stitched-bundle",
  title: "Create a stitched SKU bundle",
  summary: "Bill several SKUs as one product: pick the members, mark the anchor, and set one agreed price.",
  group: "Pricing",
  role: "admin",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        Some contracts price several SKUs as a single product. For example, a realtime voice agent
        uses <code>VOX-STT-RT</code> (speech-to-text) and <code>VOX-AGENT</code> (the agent) for
        each minute of a call, but the contract bills one price per minute. A <em>stitch</em>{" "}
        models this. Usage still logs per SKU, but the account is billed once per unit of the{" "}
        <strong>anchor</strong> SKU at the agreed price. The other members bill $0 and do not
        count as revenue leak.
      </p>

      <H2 id="create">Create the stitch</H2>
      <Steps>
        <Step title="Open the account’s pricing page">
          From the account detail page, click <strong>Manage pricing</strong>. The{" "}
          <strong>Stitch SKUs</strong> button appears once the account has at least two price rows.
        </Step>
        <Step title="Click “Stitch SKUs” and name the bundle">
          Give it the contract’s name for the product, e.g. “Realtime Voice Agent”.
        </Step>
        <Step title="Pick the member SKUs and mark the anchor">
          Check at least two SKUs, then select the <strong>anchor</strong> radio on the SKU whose
          unit count equals one stitched unit. In the voice example, the anchor is{" "}
          <code>VOX-AGENT</code>, because one agent minute is one billed minute.
        </Step>
        <Step title="Set the agreed price ($ per stitched unit)">
          Four rates (S / ND / F / IP), applied to the anchor SKU’s units by status. At least one
          must be non-zero.
        </Step>
        <Step title="Set “Effective from” and click “Create stitch”">
          Usage before the effective date keeps individual pricing; finalized invoices are never
          affected.
        </Step>
      </Steps>

      <Figure
        src="/help/shots/account-pricing.png"
        alt="The pricing table showing a stitched bundle group above the individual SKU rows"
        caption="A stitch renders as a header row with the bundle price, members indented beneath it."
      />

      <H2 id="after">How a stitch reads afterwards</H2>
      <ul>
        <li>
          In the pricing table the bundle is one editable row (chip: <em>stitched · N SKUs</em>);
          members show <em>anchor</em> or <em>included</em> chips and “$0 · in stitch”.
        </li>
        <li>
          On invoices the stitch appears as a single line at the bundle price — members are not
          listed separately.
        </li>
        <li>
          On the SKU page, accounts billed through a bundle carry a <em>stitched</em> chip in
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
