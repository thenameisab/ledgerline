import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "invoices",
  title: "Invoices & statements",
  summary:
    "Per-account billing periods with a draft → final → issued lifecycle: drafts derive live from usage, finalizing locks the numbers and assigns a LL-YYYY-NNNN invoice number.",
  group: "Billing",
  role: "all",
  routes: ["/accounts"],
};

export default function Body() {
  return (
    <>
      <p>
        Every account has one statement per billing period. While a period is open, the statement
        is a <strong>draft</strong> — it re-derives from usage and pricing every time you look at
        it, so it is always current and never authoritative. When the month is settled, an admin{" "}
        <strong>finalizes</strong> it, which snapshots every line into the database and allocates
        a real invoice number. <strong>Issuing</strong> then records that it was sent to the
        customer.
      </p>

      <Figure
        src="/help/shots/account-invoices.png"
        alt="Account invoices list with status tabs, billing periods on the left, and a live receipt preview on the right"
        caption="Billing periods on the left, the selected period&rsquo;s receipt on the right."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Status tabs</strong> — All · Draft · Final · Issued, with counts.
        </li>
        <li>
          <strong>Period list</strong> — one row per billing period with its status chip and
          revenue; empty periods render dimmed.
        </li>
        <li>
          <strong>The receipt</strong> — header (invoice number or draft placeholder, period,
          generated timestamp), a bill-to block (legal name, GSTIN, billing entity), and line
          items: date, API, hits, successful hits, price per hit, revenue, vendor cost, margin.
          Negative-margin lines are tinted red; manual-entry lines carry a <em>MANUAL</em> chip.
          Totals close with subtotal, adjustments, final revenue, vendor cost, and margin.
        </li>
        <li>
          <strong>Stitched bundles appear as one line</strong> — APIs stitched into a bundle for
          this account roll up under the bundle name rather than listing each member API.
        </li>
      </ul>

      <Callout variant="info" title="Numbering">
        Drafts carry a placeholder of the form <code>LL-DRAFT-YYYYMM-NNNN</code>. Real numbers —{" "}
        <code>LL-YYYY-NNNN</code> — are allocated from a yearly sequence only at finalization, so
        the numbered series has no gaps from abandoned drafts.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Browse and download (everyone)</strong> — pick any period and export it as PDF
          or CSV (see <a href="/help/features/invoice-exports">PDF & CSV exports</a>).
        </li>
        <li>
          <strong>Finalize (admin)</strong> — a confirmation modal previews the next invoice
          number and warns that numbers lock. Confirming snapshots the header and every line.
        </li>
        <li>
          <strong>Adjust (admin)</strong> — add signed credits or charges to a finalized invoice
          (see <a href="/help/features/invoice-adjustments">Adjustments</a>).
        </li>
        <li>
          <strong>Issue (admin)</strong> — marks the finalized invoice as sent to the customer.
        </li>
      </ul>

      <Callout variant="warn" title="Finalized pairs lock pricing">
        Once a (account, API) pair appears on a finalized invoice, its history is part of an issued
        number. Later price edits for that pair <em>supersede</em> — they apply from their
        effective date forward and never rewrite the finalized lines.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Empty period</strong> — the card is dimmed with "No usage logged"; there is
          nothing to finalize.
        </li>
        <li>
          <strong>Finalizing an empty statement</strong> — rejected; an invoice needs at least one
          line.
        </li>
        <li>
          <strong>Already finalized / already issued</strong> — the actions are idempotent-safe:
          re-attempting surfaces a clear error instead of double-allocating a number.
        </li>
        <li>
          <strong>Late usage in a draft month</strong> — drafts re-derive, so usage that lands
          after you previewed simply appears next view. Finalized statements never change.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/invoice-adjustments", label: "Adjustments" },
          { href: "/help/features/invoice-exports", label: "PDF & CSV exports" },
          { href: "/help/features/stitched-bundles", label: "Stitched API bundles" },
          { href: "/help/math", label: "How line amounts are computed" },
        ]}
      />
    </>
  );
}
