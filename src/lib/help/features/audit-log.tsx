import type { FeatureMeta } from "../types";
import { H2, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "audit-log",
  title: "Audit log",
  summary:
    "A filterable, paginated trail of every state change — pricing edits, invites, approvals, finalizations — with before/after values on each event.",
  group: "Admin",
  role: "admin",
  routes: ["/admin/audit"],
};

export default function Body() {
  return (
    <>
      <p>
        Every change that affects money or access in Ledgerline writes an audit event: who did it,
        when, to what, and the values before and after. The audit log makes "who changed this
        price and when?" a thirty-second lookup instead of an archaeology project.
      </p>

      <Figure
        src="/help/shots/admin-audit.png"
        alt="Audit log with filter dropdowns and a table of events with expandable change summaries"
        caption="Events with compact change summaries; expand any row for full before/after."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Filter bar</strong> — narrow by user, by action type (e.g.{" "}
          <code>pricing.update</code>, <code>user.invite</code>,{" "}
          <code>manual_entry.approve</code>), or by entity type. Filters live in the URL, so a
          filtered view is shareable.
        </li>
        <li>
          <strong>Event rows</strong> — timestamp, the acting user, an action badge, the entity it
          touched (linked where a page exists), and a compact change summary like{" "}
          <code>price_successful: 4.00 → 5.50</code>.
        </li>
        <li>
          <strong>Expandable detail</strong> — each row discloses the full before and after
          snapshots for changes too wide for one line.
        </li>
        <li>
          <strong>Pagination</strong> — 50 events per page, with Newer/Older links that preserve
          your filters.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Answer "who and when"</strong> — filter to an entity or action and read the
          sequence.
        </li>
        <li>
          <strong>Reconstruct a number</strong> — pricing, vendor cost, adjustment, and manual
          entry events together explain any figure on an invoice.
        </li>
        <li>
          <strong>Jump to the entity</strong> — entity references link to the live record where
          one exists.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Read-only by design</strong> — there is no edit or delete; even admins can only
          read. Voided entries and disabled users keep their history.
        </li>
        <li>
          <strong>No events for a filter</strong> — an empty state ("Nothing matches these filters
          yet") rather than a bare table.
        </li>
        <li>
          <strong>Reads are not logged</strong> — the log records state changes, not page views.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/user-management", label: "User management" },
          { href: "/help/features/account-pricing", label: "Account pricing" },
          { href: "/help/features/manual-entries", label: "Manual entries" },
        ]}
      />
    </>
  );
}
