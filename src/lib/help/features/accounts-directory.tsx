import type { FeatureMeta } from "../types";
import { H2, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "accounts-directory",
  title: "Accounts directory",
  summary:
    "Every account grouped by group, with status buckets, search, sort, 14-day sparklines — and a create-account modal for admins.",
  group: "Accounts",
  role: "all",
  routes: ["/accounts"],
};

export default function Body() {
  return (
    <>
      <p>
        The directory is the roster: every account Ledgerline knows about, grouped under their parent
        group, with enough signal per row — revenue, hits, a sparkline, a status badge — to spot
        which ones need attention without opening them.
      </p>

      <Figure
        src="/help/shots/accounts.png"
        alt="Accounts directory grouped by group with status filters, search, and per-row sparklines"
        caption="Accounts grouped by group, with filter pills and search along the top."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Status bar</strong> — total account count, combined MTD revenue, and how many
          accounts are flagged.
        </li>
        <li>
          <strong>Filter bar</strong> — bucket pills (all, leak, sandbox), a search box matching
          name and group, and a group picker.
        </li>
        <li>
          <strong>Group sections</strong> — each group renders as a section with its account
          count and revenue share; accounts sort by revenue within the group.
        </li>
        <li>
          <strong>Per row</strong> — avatar (emoji or initials), name with group beneath, a
          status badge (<em>OK</em> / <em>leak</em> / <em>sandbox</em>), MTD revenue, hit count,
          distinct APIs used, and a 14-day revenue sparkline.
        </li>
      </ul>
      <p>
        By default, sandbox accounts park at the bottom — they are test accounts and shouldn&rsquo;t
        crowd the list that matters.
      </p>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Filter and search</strong> — every filter writes to the URL, so a filtered view
          can be bookmarked or shared.
        </li>
        <li>
          <strong>Sort</strong> — choose a sort column and the grouping reorders accordingly.
        </li>
        <li>
          <strong>Open an account</strong> — any row navigates to the account profile.
        </li>
        <li>
          <strong>Create an account (admin)</strong> — the "Create account" button opens a modal:
          display name (required), parent group, GSTIN, billing entity, and an
          "is sandbox" checkbox. On save the list refreshes in place with the new account. GSTIN
          and billing entity flow straight onto the account&rsquo;s invoices, so filling them here
          saves a correction later.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>No accounts yet</strong> — an empty state replaces the table.
        </li>
        <li>
          <strong>Filter matches nothing</strong> — "No accounts match this filter" with a
          one-click "Clear filters" link.
        </li>
        <li>
          <strong>New account, no traffic</strong> — appears immediately with zeroed metrics;
          usage attaches once the daily sync (or an alias mapping) connects log rows to it. The
          directory and the command palette both list an account from the moment it&rsquo;s
          created, not just once it has usage in the window.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/account-profile", label: "Account profile" },
          { href: "/help/features/aliases", label: "Aliases & unmapped names" },
          { href: "/help/guides", label: "How-to guides" },
        ]}
      />
    </>
  );
}
