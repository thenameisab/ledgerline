import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "log-a-manual-entry",
  title: "Log a manual entry",
  summary: "Book off-stream bulk usage into revenue with the wizard, the live preview, and the approval workflow.",
  group: "Data pipeline",
  role: "admin",
  minutes: 6,
};

export default function Body() {
  return (
    <>
      <p>
        Manual entries capture usage that never reached the usage logs — a bulk batch job run from a
        support ticket, a one-off run agreed over email. The wizard prices the units through the
        same temporal pricing join as synced usage, so the revenue lands consistently in KPIs and
        invoices.
      </p>

      <H2 id="start">Start an entry</H2>
      <p>Two entry points, same wizard:</p>
      <ul>
        <li>
          <strong>From an account</strong> — the <strong>Manual entry</strong> button on the account
          detail page. The account field is locked (“scoped”) and you return to the account when
          done.
        </li>
        <li>
          <strong>From the admin index</strong> — <strong>New entry</strong> on Admin → Manual
          entries, with an account picker.
        </li>
      </ul>

      <Figure
        src="/help/shots/manual-entry-wizard.png"
        alt="The manual entry wizard with entry details, usage lines, and the live preview"
        caption="The wizard: 1 Entry details, 2 Usage lines, 3 Preview."
      />

      <H2 id="fill">Fill the form</H2>
      <Steps>
        <Step title="1 · Entry details">
          Set the <strong>Effective date</strong> (when the work happened — it determines which
          prices and which invoice period apply). <strong>Reason</strong> is required so the entry
          is traceable (e.g. “Offline batch embedding run for Q2 archive import”); <strong>Reference</strong> is
          an optional ticket or email pointer.
        </Step>
        <Step title="2 · Usage lines">
          For each SKU: pick it from the dropdown (or <strong>+ Create new SKU…</strong> to add one
          to the catalog inline), set the <strong>Channel</strong> (Bulk / Integration / Console),
          optionally a <strong>Vendor</strong> for cost attribution, and the unit counts —{" "}
          <strong>Successful</strong>, <strong>No data</strong>, <strong>Failed</strong>,{" "}
          <strong>In progress</strong>. Use <strong>Add line</strong> for more SKUs; every line
          needs at least one non-zero count.
        </Step>
        <Step title="3 · Preview">
          The preview refreshes automatically a beat after you type (or click{" "}
          <strong>Refresh</strong>). It shows per-line revenue from the authoritative server-side
          pricing join, flags lines with “No pricing — revenue will be 0”, and warns when the total
          “Exceeds $500 — admin approval required”.
        </Step>
      </Steps>

      <H2 id="submit">Save, post, or send for approval</H2>
      <Steps>
        <Step title="Save draft">
          Stores the entry without booking revenue — useful while you chase missing numbers.
        </Step>
        <Step title="Approve & post (totals at or below $500)">
          Books the revenue immediately. It appears in KPIs, the account’s SKU breakdown (with a
          MANUAL chip), and the draft invoice for that period.
        </Step>
        <Step title="Submit for approval (totals above $500)">
          The entry moves to <em>Pending approval</em> and books nothing yet. Pending totals are
          surfaced in an orange box on Admin → Manual entries until someone acts.
        </Step>
      </Steps>
      <Callout variant="info">
        The $500 threshold is the default; deployments can override it with the{" "}
        <code>MANUAL_ENTRY_APPROVAL_THRESHOLD</code> environment variable.
      </Callout>

      <H2 id="approve">Approve or void an entry</H2>
      <Figure
        src="/help/shots/admin-manual-entries.png"
        alt="The Manual entries admin list with status tabs and the pending-approval box"
        caption="Admin → Manual entries: status tabs, pending-approval total, and the entry list."
      />
      <Steps>
        <Step title="Open the entry from Admin → Manual entries">
          Filter by status tab (All / Draft / Pending approval / Approved / Void) and click the
          entry to see its lines, totals, and audit trail.
        </Step>
        <Step title="Approve & post">
          On a draft or pending entry, books the revenue immediately.
        </Step>
        <Step title="Void entry">
          Type a <strong>Void reason</strong> and click <strong>Confirm void</strong>.
        </Step>
      </Steps>
      <Callout variant="danger">
        Voiding deletes the materialised usage rows — revenue and KPIs revert immediately. The
        entry itself stays in the audit trail, but there is no un-void; re-create the entry if it
        was voided by mistake.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/fix-unpriced-traffic", label: "Fix unpriced traffic" },
          { href: "/help/guides/create-or-edit-a-sku", label: "Create or edit a SKU" },
          { href: "/help/guides/finalize-an-invoice", label: "Review and finalize an invoice" },
        ]}
      />
    </>
  );
}
