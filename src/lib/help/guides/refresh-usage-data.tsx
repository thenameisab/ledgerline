import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "refresh-usage-data",
  title: "Refresh usage data now",
  summary: "Pull the latest usage from the usage log source now, without waiting for the next scheduled sync.",
  group: "Data pipeline",
  role: "admin",
  minutes: 2,
};

export default function Body() {
  return (
    <>
      <p>
        In a live deployment, a scheduled job pulls the previous day from the usage log source once
        a day. It also re-checks the last few days for changes and fills missed dates. When you need
        current numbers, for example before a review, start a pull by hand. In the demo, the pull
        does not call an external source. It generates usage locally from the recent history of
        each account and SKU pair.
      </p>

      <Figure
        src="/help/shots/admin-sync.png"
        alt="The Usage sync page with the Refresh now button and run history table"
        caption="Usage sync: the refresh button, backfill form, and run history."
      />

      <H2 id="refresh">Trigger a refresh</H2>
      <Steps>
        <Step title="Open Admin → Usage sync">
          The subtitle shows how fresh the data is: “Data through &lt;date&gt; · pulled
          &lt;time&gt;”.
        </Step>
        <Step title="Click “Refresh now”">
          Ledgerline re-pulls today and the two previous days. The button shows a progress label
          while it runs. Then a toast shows the result, for example “Refreshed — +1,240 units since
          the last pull” or “no changes since the last pull”. In the demo, a refresh also runs the
          vendor-side usage pull and the alert check.
        </Step>
        <Step title="Check the run history">
          The new run appears at the top of the table with its trigger, status, rows inserted, and
          unit count.
        </Step>
      </Steps>
      <Callout variant="tip">
        You can also start a refresh from the command palette (⌘K) with the{" "}
        <strong>Refresh usage data</strong> action.
      </Callout>

      <H2 id="history">Read the run history</H2>
      <ul>
        <li>
          <strong>Status</strong> — <em>success</em>, <em>error</em> (hover for the message),{" "}
          <em>running…</em>, or <em>stalled</em> (a run that never finished within ~30 minutes,
          usually a platform timeout).
        </li>
        <li>
          <strong>Unmapped</strong> — if a run pulled rows whose account or SKU names did not match
          the catalog, the count links straight to the Alias mapper. Revenue for those rows starts
          counting the moment they are mapped.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/guides/backfill-usage-data", label: "Backfill a date range" },
          { href: "/help/guides/resolve-unmapped-names", label: "Resolve unmapped names" },
          { href: "/help/api", label: "API reference (sync endpoints)" },
        ]}
      />
    </>
  );
}
