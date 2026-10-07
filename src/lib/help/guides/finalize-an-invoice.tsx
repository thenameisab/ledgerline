import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "finalize-an-invoice",
  title: "Review and finalize an invoice",
  summary: "Walk a billing period from live draft to a locked, numbered invoice, then mark it issued.",
  group: "Billing",
  role: "admin",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        Every billing period starts as a <strong>draft</strong> that derives live from usage and
        pricing — it changes as data changes. Finalizing snapshots the numbers, allocates the next
        invoice number, and locks the period. Issuing then records that it was sent to the
        customer.
      </p>

      <H2 id="review">Review the draft</H2>
      <Figure
        src="/help/shots/account-invoices.png"
        alt="The account invoices page with period list on the left and receipt preview on the right"
        caption="The invoices page: periods on the left, live receipt preview on the right."
      />
      <Steps>
        <Step title="Open the account’s invoices">
          From the account detail page click <strong>Invoices</strong>. Periods are listed on the
          left with status pills; the tabs filter by <strong>All</strong> / <strong>Draft</strong>{" "}
          / <strong>Final</strong> / <strong>Issued</strong>.
        </Step>
        <Step title="Select the period">
          The right pane shows the receipt: bill-to details, line items with hits, price per hit
          and revenue, and totals. Drafts are labelled “Draft — derives live from usage”. Click the
          invoice number to open the full-page view.
        </Step>
        <Step title="Sanity-check the lines">
          Manual-entry lines carry a MANUAL chip; stitched bundles appear as a single line; rows
          with negative margin are tinted red. If a rate is wrong, fix pricing first — the draft
          recomputes instantly.
        </Step>
      </Steps>

      <H2 id="finalize">Finalize</H2>
      <Steps>
        <Step title="Click “Finalize invoice”">
          Available on drafts that have at least one line, in both the preview pane and the
          full-page view.
        </Step>
        <Step title="Confirm in the dialog">
          “Finalize this invoice?” shows the period and the next invoice number in the{" "}
          <code>LL-YYYY-NNNN</code> sequence. Click <strong>Finalize</strong> to lock and snapshot
          the header and lines.
        </Step>
      </Steps>
      <Callout variant="warn" title="Finalizing locks the numbers">
        After finalizing, pricing changes no longer affect this invoice. Corrections happen through
        credits and adjustments, not by editing lines.
      </Callout>

      <H2 id="issue">Issue to customer</H2>
      <Figure
        src="/help/shots/invoice-detail.png"
        alt="A finalized invoice detail page with the action bar"
        caption="A finalized invoice: locked numbers, adjustments section, and download buttons."
      />
      <Steps>
        <Step title="Click “Issue to customer” on a finalized invoice">
          The dialog “Issue invoice to customer?” confirms the invoice number — the numbers are
          already locked; issuing just records the send.
        </Step>
        <Step title="Download and send">
          Use <strong>Customer PDF</strong> for the account-facing document. Add any credits or
          charges <em>before</em> issuing — adjustments are editable only while the status is
          Final.
        </Step>
      </Steps>

      <Related
        links={[
          { href: "/help/guides/add-an-invoice-adjustment", label: "Add a credit or charge" },
          { href: "/help/guides/download-invoice-documents", label: "Download PDFs & CSV" },
          { href: "/help/math", label: "Invoice math" },
        ]}
      />
    </>
  );
}
