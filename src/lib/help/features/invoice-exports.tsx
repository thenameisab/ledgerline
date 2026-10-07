import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "invoice-exports",
  title: "PDF & CSV exports",
  summary:
    "Every statement exports as a customer-facing PDF, an internal PDF with vendor cost and margin, or a CSV — same numbers, different audiences.",
  group: "Billing",
  role: "all",
  routes: ["/accounts"],
};

export default function Body() {
  return (
    <>
      <p>
        One statement, three exports. The <strong>customer PDF</strong> is what you send out; the{" "}
        <strong>internal PDF</strong> adds the economics you would never show a customer; the{" "}
        <strong>CSV</strong> is for pasting line items into accounting tools. All three derive
        from exactly the same statement data, so they can never disagree.
      </p>

      <Figure
        src="/help/shots/invoice-detail.png"
        alt="Invoice detail page with download actions for customer PDF, internal PDF, and CSV"
        caption="Download actions live on the invoice detail and list pages."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Customer PDF</strong> — revenue columns only: per-SKU units, outcome counts,
          prices, and revenue. Closes with a "Thank you for choosing Ledgerline" block. No vendor
          cost, no margin, anywhere.
        </li>
        <li>
          <strong>Internal PDF</strong> — the same lines plus vendor cost and margin per line, a
          totals strip with margin %, and an "Internal — for review" footer.
        </li>
        <li>
          <strong>CSV</strong> — one row per line item. The internal variant carries the full
          column set (per-outcome prices, revenue, vendor cost, margin, and an{" "}
          <code>is_estimated</code> flag); the customer variant stops at revenue.
        </li>
      </ul>

      <Callout variant="info" title="Branding">
        Exports are branded <strong>Ledgerline</strong> — the legal billing identity — while the
        product UI is Ledgerline. That difference is deliberate: customers see the company, operators
        see the tool.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Download from any state</strong> — drafts export too, for previewing what a
          customer would receive before finalizing.
        </li>
        <li>
          <strong>Pick the variant</strong> — separate buttons for customer PDF, internal PDF, and
          CSV on the invoice pages. Members and admins can both download.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Draft watermark</strong> — draft PDFs carry a faint diagonal watermark so a
          preview can never be mistaken for an issued invoice.
        </li>
        <li>
          <strong>Estimated vendor costs</strong> — lines whose vendor cost is still a placeholder
          are flagged in the internal exports; the customer variant is unaffected since it shows
          no costs.
        </li>
        <li>
          <strong>Adjustments included</strong> — finalized invoices with adjustments export with
          the adjustments section and adjusted totals.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/invoices", label: "Invoices & statements" },
          { href: "/help/features/invoice-adjustments", label: "Adjustments" },
          { href: "/help/features/vendor-costs", label: "Vendor costs" },
          { href: "/help/api/endpoints", label: "Export endpoints (API reference)" },
        ]}
      />
    </>
  );
}
