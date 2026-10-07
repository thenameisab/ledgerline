import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "invoice-adjustments",
  title: "Invoice adjustments",
  summary:
    "Signed credits and charges on finalized invoices — corrections without reopening locked numbers, each with a label and an audit trail.",
  group: "Billing",
  role: "admin",
  routes: ["/accounts"],
};

export default function Body() {
  return (
    <>
      <p>
        Finalizing an invoice locks its lines — that is the point. But the real world still
        produces goodwill credits, late fees, and corrections. Adjustments are the escape valve:
        signed amounts appended <em>below</em> the locked line items, changing the total without
        ever touching the snapshot.
      </p>

      <Figure
        src="/help/shots/invoice-detail.png"
        alt="Invoice detail page showing the receipt with its totals and adjustments section"
        caption="Adjustments sit between the locked line items and the final total."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>An Adjustments section</strong> on finalized invoices, listing each adjustment
          with its label and signed amount — credits negative, charges positive.
        </li>
        <li>
          <strong>Recomputed totals</strong> — subtotal, adjustments, and the final revenue line
          beneath them.
        </li>
        <li>
          <strong>Nothing on drafts</strong> — drafts re-derive from live usage, so corrections
          there belong in pricing or manual entries, not adjustments. The section only appears
          once an invoice is final.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Add a credit or charge</strong> — enter a label (required), a positive amount,
          and pick the sign with a credit/charge toggle. The form applies the sign for you, so
          there is no minus-sign bookkeeping to get wrong.
        </li>
        <li>
          <strong>Remove an adjustment</strong> — possible while the invoice is still in the{" "}
          <em>final</em> state, for fixing a mistyped adjustment before sending.
        </li>
        <li>
          <strong>Export with adjustments</strong> — PDFs and CSVs regenerate with the adjustments
          and new totals included.
        </li>
      </ul>

      <Callout variant="warn" title="Issued invoices are closed">
        Once an invoice is issued to the customer, adjustments can no longer be added or removed.
        A post-issue correction belongs on the next period&rsquo;s invoice.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Zero or negative input</strong> — the amount field takes a positive number only;
          the sign comes from the toggle. Empty labels are rejected.
        </li>
        <li>
          <strong>Audit trail</strong> — every add and remove is recorded in the audit log with
          who, when, and the amounts.
        </li>
        <li>
          <strong>Member role</strong> — members see existing adjustments on the receipt but get
          no add/remove controls.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/invoices", label: "Invoices & statements" },
          { href: "/help/features/invoice-exports", label: "PDF & CSV exports" },
          { href: "/help/features/audit-log", label: "Audit log" },
        ]}
      />
    </>
  );
}
