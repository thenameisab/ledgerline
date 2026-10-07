import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, OpenInApp, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "investigate-an-account",
  title: "Investigate an account",
  summary: "Go from the account list to a full picture of one account — revenue, SKU mix, activity, and leaks.",
  group: "Daily work",
  role: "all",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        When someone asks “what is going on with this account?”, the answer is two clicks away: find
        them on the Accounts page, then read their detail page top to bottom.
      </p>
      <OpenInApp href="/accounts" label="Open Accounts" />

      <H2 id="find">Find the account</H2>
      <Figure
        src="/help/shots/accounts.png"
        alt="The Accounts page with groups, status chips, and sparklines"
        caption="Accounts grouped by group, each row with revenue, units, and a 14-day sparkline."
      />
      <Steps>
        <Step title="Open Accounts (⌘2)">
          Accounts are grouped by group, sorted by revenue. Each row shows the status chip, MTD
          revenue, unit count, distinct SKUs, and a 14-day revenue sparkline.
        </Step>
        <Step title="Narrow the list">
          Use the status pills (for example <strong>Revenue leak</strong> to see only accounts with
          unpriced traffic), the group picker, the search box, or a sort (Revenue, Units, SKUs
          used, Name A→Z). Filters live in the URL, so the view is shareable.
        </Step>
        <Step title="Click the account row">
          You land on <code>/accounts/&lt;name&gt;</code>. The fastest path of all is the command
          palette: press ⌘K and type the account’s name.
        </Step>
      </Steps>
      <Callout variant="info">
        Admins also see a <strong>New account</strong> button in the page header for creating a
        account ahead of its first traffic (display name required; group, legal entity name, and
        Tax ID optional).
      </Callout>

      <H2 id="read">Read the detail page</H2>
      <Figure
        src="/help/shots/account-detail-full.png"
        alt="An account detail page with headline KPIs, activity heatmap, charts, and SKU breakdown"
        caption="Account detail: headline, briefing, heatmap, charts, and the per-SKU breakdown."
      />
      <ul>
        <li>
          <strong>Headline</strong> — revenue for the window with a month-over-month chip, plus
          units, average price per unit, SKUs used, and success rate.
        </li>
        <li>
          <strong>Leak alert</strong> — if any of the account’s traffic is unpriced, an alert shows
          the amount at risk and links straight to <strong>Manage pricing</strong>.
        </li>
        <li>
          <strong>Activity heatmap</strong> — 90 days of daily unit volume; hover any square for the
          exact count.
        </li>
        <li>
          <strong>Charts</strong> — daily revenue &amp; margin, and the call-status split
          (successful / no data / failed / in progress).
        </li>
        <li>
          <strong>SKU breakdown</strong> — every SKU the account used in the window, with units,
          price per unit, revenue, and margin. Rows with units but $0 revenue are tinted red
          (unpriced); rows fed by manual entries carry a MANUAL chip.
        </li>
      </ul>

      <H2 id="act">Act from the header</H2>
      <p>
        The header has <strong>Invoices</strong> (everyone) plus <strong>Manual entry</strong> and{" "}
        <strong>Manage pricing</strong> (admins) — so investigation flows directly into billing or
        a pricing fix.
      </p>

      <Related
        links={[
          { href: "/help/guides/set-account-pricing", label: "Set or edit account pricing" },
          { href: "/help/guides/finalize-an-invoice", label: "Review and finalize an invoice" },
          { href: "/help/guides/log-a-manual-entry", label: "Log a manual entry" },
        ]}
      />
    </>
  );
}
