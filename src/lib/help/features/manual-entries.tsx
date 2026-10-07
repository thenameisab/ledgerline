import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "manual-entries",
  title: "Manual entries",
  summary:
    "Book off-stream bulk usage — work done over email or tickets — into revenue, with a live-priced preview and an approval gate above ₹50,000.",
  group: "Billing",
  role: "admin",
  routes: ["/admin/manual-entries"],
};

export default function Body() {
  return (
    <>
      <p>
        Not all billable work flows through the API logs: bulk verifications run from a ticket, a
        one-off batch delivered over email. Manual entries put that work on the books so the month
        ends complete. Each entry records what happened, why, and for whom — and is priced through
        the same temporal price book as logged traffic, so it lands on invoices exactly like
        organic usage.
      </p>

      <Figure
        src="/help/shots/manual-entry-wizard.png"
        alt="Manual entry wizard with entry details, usage lines, and a live revenue preview"
        caption="The wizard: details, per-API usage lines, and a debounced live preview."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>The wizard</strong> — reachable from an account profile (account pre-locked, shown
          as a "SCOPED" chip) or from the admin index (account picker). Three sections: entry
          details (effective date, a required reason, an optional reference for the source ticket
          or email), repeating usage lines (API, hits-via context, optional vendor, and hit counts
          per outcome), and a live preview.
        </li>
        <li>
          <strong>Live preview</strong> — recomputes about a third of a second after you stop
          typing: total revenue, per-line revenue, yellow chips on lines with no pricing, and
          whether the total crosses the approval threshold.
        </li>
        <li>
          <strong>The admin index</strong> (<code>/admin/manual-entries</code>) — approved
          off-stream revenue as a KPI, an orange box totalling what awaits approval, status tabs
          (All / Draft / Pending approval / Approved / Void), and a table of entries with reason,
          revenue, status, and creator.
        </li>
      </ul>

      <Figure
        src="/help/shots/admin-manual-entries.png"
        alt="Manual entries admin index with status tabs and the pending-approval summary"
        caption="The cross-account index with its approval queue."
      />

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Create an entry</strong> — fill the form; the preview prices it as you go. An
          API missing from the catalog can be created inline from the picker without leaving the
          wizard.
        </li>
        <li>
          <strong>Submit</strong> — below the threshold, an admin&rsquo;s submit auto-approves and
          the revenue appears in KPIs immediately (an editor&rsquo;s submit never auto-approves).
          Above the threshold, the entry parks in <em>pending approval</em> and counts nowhere
          until an admin or editor approves it.
        </li>
        <li>
          <strong>Approve or void</strong> — from the entry detail page. Voiding removes the
          materialised usage rows, so revenue reverts immediately — the audit record stays.
        </li>
      </ul>

      <Callout variant="warn" title="The ₹50,000 gate">
        Entries whose previewed revenue exceeds the approval threshold (default ₹50,000, set by
        the <code>MANUAL_ENTRY_APPROVAL_THRESHOLD</code> environment variable) require a second
        admin. Pending entries do not count in KPIs or invoices.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Validation</strong> — a reason is required, at least one usage line, each line
          needs an API and at least one non-zero hit count.
        </li>
        <li>
          <strong>Unpriced lines are allowed</strong> — they save with a warning and surface as
          revenue leak until the pair is priced.
        </li>
        <li>
          <strong>Every transition is audited</strong> — create, submit, approve, void, and any
          inline API creation all write audit events.
        </li>
        <li>
          <strong>Navigating away mid-form</strong> — unsaved wizard state is lost; there is no
          draft autosave.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/account-pricing", label: "Account pricing" },
          { href: "/help/features/unpriced-traffic", label: "Unpriced traffic detection" },
          { href: "/help/features/audit-log", label: "Audit log" },
          { href: "/help/guides", label: "How-to guides" },
        ]}
      />
    </>
  );
}
