import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "backfill-usage-data",
  title: "Backfill a date range",
  summary: "Re-pull a range of past days from the usage log source to fill gaps or pick up source corrections.",
  group: "Data pipeline",
  role: "admin",
  minutes: 3,
};

export default function Body() {
  return (
    <>
      <p>
        Backfill re-pulls each day in a range from the usage log source. Use it when the scheduled
        sync missed days (an outage or a stalled run), or when the source changed data older than
        the three days that each scheduled run re-checks. In the demo, the backfill generates usage
        locally for each day instead of calling an external source.
      </p>

      <H2 id="run">Run a backfill</H2>
      <Steps>
        <Step title="Open Admin → Usage sync">
          The backfill form sits under the refresh button, in the “How this works” card.
        </Step>
        <Step title="Pick “From” and “To” dates">
          Both inclusive. A request covers at most 31 days — for longer spans, run consecutive
          batches.
        </Step>
        <Step title="Click “Backfill range”">
          The button shows a progress label while it works. Then a toast shows the result, for
          example “Backfilled 14 days — 92,310 hits”.
        </Step>
        <Step title="Verify in the run history">
          Each backfilled day appears as its own run with trigger <code>backfill</code>. Check the
          Unmapped column — old data often contains names that predate the current catalog.
        </Step>
      </Steps>

      <Figure
        src="/help/shots/admin-sync.png"
        alt="The Usage sync page showing the backfill form with From and To dates"
        caption="The backfill form: From, To, and Backfill range."
      />

      <Callout variant="info">
        Backfill is idempotent — re-pulling a day replaces that day’s synced rows rather than
        duplicating them, so running it twice is safe. Manual entries are separate records and are
        never touched by sync or backfill.
      </Callout>

      <Callout variant="warn">
        Backfilled revenue is priced by the rates in effect on those dates (temporal pricing). If
        the period was already invoiced and finalized, the invoice keeps its snapshot — reconcile
        differences with an adjustment.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/refresh-usage-data", label: "Refresh usage data now" },
          { href: "/help/guides/resolve-unmapped-names", label: "Resolve unmapped names" },
          { href: "/help/guides/add-an-invoice-adjustment", label: "Add a credit or charge" },
        ]}
      />
    </>
  );
}
