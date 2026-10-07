import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "download-invoice-documents",
  title: "Download invoice PDFs & CSV",
  summary: "Get the customer-facing PDF, the internal PDF with costs and margin, or a CSV for the accounting system.",
  group: "Billing",
  role: "all",
  minutes: 2,
};

export default function Body() {
  return (
    <>
      <p>
        Every invoice — draft or finalized — can be downloaded in three formats from the action bar
        on the invoice page. The on-screen receipt and the downloaded PDF share the same layout, so
        what you preview is what you send.
      </p>

      <Figure
        src="/help/shots/invoice-detail.png"
        alt="The invoice detail page with the CSV, Customer PDF, and Internal PDF buttons"
        caption="The action bar: CSV, Customer PDF, and Internal PDF."
      />

      <H2 id="variants">Pick the right variant</H2>
      <ul>
        <li>
          <strong>Customer PDF</strong> — the account-facing document: line items, prices, revenue,
          and adjustments. No vendor cost, no margin.
        </li>
        <li>
          <strong>Internal PDF</strong> — everything in the customer variant plus vendor cost and
          margin per line and in the totals, and internal metadata such as who added each
          adjustment. Never send this one to an account.
        </li>
        <li>
          <strong>CSV</strong> — the internal data (line items, prices, vendor cost, margin) as a
          flat file for pasting into Tally, QuickBooks, or a spreadsheet.
        </li>
      </ul>

      <H2 id="steps">Download</H2>
      <Steps>
        <Step title="Open the invoice">
          Either the full page (<code>/accounts/&lt;account&gt;/invoices/&lt;period&gt;</code>) or
          the preview pane on the invoices list — both carry the same buttons.
        </Step>
        <Step title="Click CSV, Customer PDF, or Internal PDF">
          The file downloads immediately. Members and admins can both download; no special role is
          required.
        </Step>
      </Steps>

      <Callout variant="warn">
        Downloads of a <em>draft</em> reflect the live numbers at that moment and may change as
        usage syncs or pricing is edited. For anything you send externally, finalize first so the
        numbers are locked and carry a real invoice number.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/finalize-an-invoice", label: "Review and finalize an invoice" },
          { href: "/help/api", label: "API reference (download endpoints)" },
        ]}
      />
    </>
  );
}
