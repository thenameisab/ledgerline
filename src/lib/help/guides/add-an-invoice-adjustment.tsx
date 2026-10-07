import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "add-an-invoice-adjustment",
  title: "Add a credit or charge to an invoice",
  summary: "Correct a finalized invoice with a signed adjustment line instead of editing locked numbers.",
  group: "Billing",
  role: "admin",
  minutes: 3,
};

export default function Body() {
  return (
    <>
      <p>
        Finalized invoices are locked, so corrections are made as adjustment lines: a{" "}
        <strong>credit</strong> reduces the total (overbilling, goodwill), a{" "}
        <strong>charge</strong> adds to it (late fees, missed items). Each line carries a label, a
        signed amount, and an audit trail of who added it.
      </p>

      <Figure
        src="/help/shots/invoice-detail.png"
        alt="An invoice detail page showing the Credits & adjustments section"
        caption="The “Credits & adjustments” section sits below the line items on finalized invoices."
      />

      <H2 id="add">Add an adjustment</H2>
      <Steps>
        <Step title="Open a finalized invoice">
          Adjustments are editable only while the status is <strong>Final</strong> — drafts derive
          live (fix pricing instead), and issued invoices are closed.
        </Step>
        <Step title="Click “Add credit or adjustment”">
          The button sits under the <strong>Credits &amp; adjustments</strong> section of the
          receipt.
        </Step>
        <Step title="Pick the sign">
          The toggle next to the amount field chooses <strong>−</strong> (credit, reduces the
          total) or <strong>+</strong> (late charge, adds to it).
        </Step>
        <Step title="Fill label, amount, and notes">
          <strong>Label</strong> is required and appears on the customer document (e.g. “April
          overbilling correction”). <strong>Amount ($)</strong> is entered as a positive number —
          the sign comes from the toggle. <strong>Notes</strong> are optional internal context and
          appear only on the internal variant.
        </Step>
        <Step title="Click “Add adjustment”">
          The line lands in the section, the adjustments subtotal and invoice total recompute, and
          the change is recorded in the audit log.
        </Step>
      </Steps>

      <H2 id="remove">Remove an adjustment</H2>
      <p>
        While the invoice is still Final, each adjustment row has an <strong>×</strong> button.
        Once the invoice is issued, adjustments are read-only along with everything else.
      </p>

      <Callout variant="info">
        Adjustments are visible on both PDF variants and the CSV, but the creator’s email and
        timestamp show only on the internal variant.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/finalize-an-invoice", label: "Review and finalize an invoice" },
          { href: "/help/guides/download-invoice-documents", label: "Download PDFs & CSV" },
          { href: "/help/guides/read-the-audit-log", label: "Read the audit log" },
        ]}
      />
    </>
  );
}
