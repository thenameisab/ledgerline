import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "account-profile",
  title: "Account profile",
  summary:
    "One account's whole story: headline revenue with a written briefing, a 90-day activity heatmap, daily charts, and a per-SKU revenue breakdown.",
  group: "Accounts",
  role: "all",
  routes: ["/accounts"],
};

export default function Body() {
  return (
    <>
      <p>
        The account profile is where account conversations start. It puts the account&rsquo;s
        month-to-date revenue, usage rhythm, and per-SKU economics on one page, and flags — in
        dollars — anything that should have been billed but wasn&rsquo;t.
      </p>

      <Figure
        src="/help/shots/account-detail.png"
        alt="Account profile with headline revenue, briefing, activity heatmap, and secondary stats"
        caption="The headline section: revenue, MoM delta, briefing, and quick stats."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Status bar</strong> — account name, group, billing entity and Tax ID, plus a
          status chip (OK / leak / sandbox). On the right: an Invoices button for everyone, and a
          "+ Manual entry" button for admins.
        </li>
        <li>
          <strong>Missing-MSA flag</strong> — an account with over a week of logged usage and no
          Master Service Agreement on file is flagged in the status bar, so an unsigned account
          doesn&rsquo;t stay invisible.
        </li>
        <li>
          <strong>Headline</strong> — MTD revenue with a day-scaled MoM delta pill, the written
          briefing, and secondary stats: units, average price per unit, SKUs used, success rate, and
          the top SKU with its revenue share.
        </li>
        <li>
          <strong>Leak alert</strong> — if any of this account&rsquo;s traffic is unpriced, an
          alert states the amount at risk and the number of unpriced SKU pairs, with a
          "Manage pricing" link straight to the fix.
        </li>
        <li>
          <strong>Activity heatmap</strong> — 90 days of usage in GitHub-style weekly columns;
          darker cells mean more units. Quiet weeks and ramp-ups are visible at a glance.
        </li>
        <li>
          <strong>Charts</strong> — daily revenue and margin, plus the call-status mix for this
          account.
        </li>
        <li>
          <strong>SKU breakdown</strong> — a table per SKU: units, successful units, price per unit,
          revenue, and margin. Rows with traffic but zero revenue are tinted red (unpriced), and
          rows that include manual-entry usage carry a <em>MANUAL</em> chip.
        </li>
      </ul>

      <Figure
        src="/help/shots/account-detail-full.png"
        alt="Full account profile including charts and the per-SKU breakdown table"
        caption="Further down: charts and the per-SKU breakdown."
      />

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Change the date window</strong> — the headline, charts, and breakdown all
          re-fetch.
        </li>
        <li>
          <strong>Open invoices</strong> — jump to this account&rsquo;s billing periods.
        </li>
        <li>
          <strong>Manage pricing (admin)</strong> — opens the per-account price book.
        </li>
        <li>
          <strong>Log a manual entry (admin)</strong> — the wizard opens pre-scoped to this
          account.
        </li>
        <li>
          <strong>Hover anything truncated</strong> — full SKU and account names reveal on hover.
        </li>
      </ul>

      <Callout variant="tip">
        The red rows in the SKU breakdown are the same traffic counted in the dashboard&rsquo;s
        "Money at risk" card — pricing them here clears both.
      </Callout>

      <H2 id="profile-tab">The Profile tab</H2>
      <p>
        Admins and editors get a second tab, next to Overview, for editing the account&rsquo;s own
        details:
      </p>
      <ul>
        <li>
          <strong>Name, account ID, and legal name</strong> — the display name shown everywhere,
          the unique account code, and the billing entity used on invoices.
        </li>
        <li>
          <strong>Website and logo</strong> — a website enables "Fetch from logo.dev"; a logo can
          also be uploaded directly or dragged onto the drop zone.
        </li>
        <li>
          <strong>CS and Sales owner</strong> — searchable pickers scoped to each team.
        </li>
        <li>
          <strong>MSA</strong> — a link to the signed Master Service Agreement plus its start
          date and (optional, for open-ended terms) end date. This is what drives the missing-MSA
          flag above.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>No usage in the window</strong> — KPI tiles show "—" and charts render empty;
          the briefing says the account is quiet.
        </li>
        <li>
          <strong>Sandbox account</strong> — the chip and briefing both flag it; its numbers stay
          out of org-level reports unless sandbox is toggled on.
        </li>
        <li>
          <strong>Legacy links</strong> — old numeric account URLs redirect to the slug form, so
          bookmarks keep working.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/guides/edit-an-account-profile", label: "Edit an account's profile" },
          { href: "/help/features/account-pricing", label: "Account pricing" },
          { href: "/help/features/invoices", label: "Invoices & statements" },
          { href: "/help/features/manual-entries", label: "Manual entries" },
          { href: "/help/features/briefing-panel", label: "Briefing panel" },
        ]}
      />
    </>
  );
}
