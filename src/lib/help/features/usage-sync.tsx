import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "usage-sync",
  title: "Usage sync",
  summary:
    "The data pipeline: a system-status board, a daily pull from the usage log source, re-syncs of recent days, automatic gap healing, manual refresh, and date-range backfills.",
  group: "Admin",
  role: "admin",
  routes: ["/admin/sync"],
};

export default function Body() {
  return (
    <>
      <p>
        Every number in Ledgerline comes from usage data. The usage sync pulls daily usage from the
        usage log source and writes it to the database. In a live deployment, a scheduled job runs
        the sync once a day for the previous day. In the demo, no external source is called. The
        sync generates usage locally from the recent history of each account and API pair. The sync
        page shows the run history, a manual refresh, and a backfill form for re-pulling a date
        range.
      </p>

      <Figure
        src="/help/shots/admin-sync.png"
        alt="Usage sync page with the system status board, refresh button, backfill form, and run history"
        caption="System status, refresh, backfill, and the run history with per-run unmapped counts."
      />

      <H2 id="system-status">System status</H2>
      <p>
        The page opens with a <strong>System status</strong> board. It has one card for each
        service that Ledgerline depends on. Each card shows a health pill and the time of the last
        activity. The overall banner shows the worst status of all cards.
      </p>
      <ul>
        <li>
          <strong>Database</strong> — a live ping on each page load. The card shows the round-trip
          latency, or <em>Down</em> if the connection fails.
        </li>
        <li>
          <strong>Usage sync</strong> — <em>Up to date</em>, <em>N days behind</em>,{" "}
          <em>errored</em>, or <em>stalled</em>, with the last date that has usage. The status comes
          from the run history and from gap detection back to the sync start date.
        </li>
        <li>
          <strong>Scheduled job</strong> — <em>On schedule</em>, or the time since the last
          scheduled run. The demo does not schedule the sync, so this card shows the age of the
          last scheduled run, or <em>Never fired</em>.
        </li>
        <li>
          <strong>Monthly usage import</strong> — the latest date loaded by a command-line import,
          or <em>Not configured</em> if no import has run.
        </li>
        <li>
          <strong>Outbound email</strong> — whether mail credentials are set. The demo has no mail
          credentials, so emails are skipped.
        </li>
      </ul>
      <Callout variant="info" title="Status is computed on each load">
        Each card is computed from existing data and live checks when the page loads. There is no
        separate status table. A pill that is not green tells you where to look. A degraded sync
        usually clears on the next run. A down database is an infrastructure problem.
      </Callout>

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Missing-data banner</strong> — if a date since the sync start date has no usage
          rows, a banner lists each such date. The next scheduled sync fills them, or you can
          backfill the range now.
        </li>
        <li>
          <strong>Run history</strong> — one row per run and date: start time, the business date it
          pulled, the trigger (cron, manual, or backfill), status, rows inserted, total hits, and
          unmapped name counts that link to Aliases. Failed runs are tinted red and show the error.
          A run with no update for more than 30 minutes shows as <em>stalled</em>. A run that
          succeeded but inserted zero rows is marked <em>no data</em>, which means the source had
          no rows for that day when the sync ran.
        </li>
        <li>
          <strong>Refresh button</strong> — re-pulls today and the two previous days and reports
          what changed.
        </li>
        <li>
          <strong>Backfill form</strong> — a from and to date range to re-pull past days.
        </li>
      </ul>

      <H2 id="how-it-behaves">How the pipeline behaves</H2>
      <ul>
        <li>
          <strong>Recent days are re-synced</strong> — each scheduled run re-syncs the last three
          closed days, because the source can change a recent day as in-progress hits settle.
        </li>
        <li>
          <strong>Idempotent per date</strong> — a sync deletes the rows it synced earlier for a
          date and inserts the new pull in one transaction. Re-running a day does not duplicate or
          orphan rows.
        </li>
        <li>
          <strong>Gap healing</strong> — each scheduled run also re-pulls older dates since the
          sync start date that have no run with inserted rows, up to sixty dates per run. In the
          demo, the sync start date is the first day of the month two months before today. A
          successful pull with zero rows does not count as coverage. The date stays on the list
          until the source has data for it.
        </li>
        <li>
          <strong>API matching by code only</strong> — a row maps to an API by its{" "}
          <em>Product Code</em>, and only when that code is an active catalog entry. A blank or
          unknown code uses an admin override if one exists. Otherwise the row is held for{" "}
          <a href="/help/features/api-review">API review</a>. Account names map by name in
          Aliases. The sync never matches an API by name and never creates catalog records.
        </li>
      </ul>

      <Callout variant="info" title="Manual entries are not changed">
        The sync replaces only the rows it got from the usage logs. Usage from approved manual
        entries has a different source and stays through every re-sync and backfill.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Refresh now</strong> — after you fix aliases, or when you need current numbers
          before the next scheduled run. In the demo, a refresh also runs the vendor-side usage
          pull and the alert check.
        </li>
        <li>
          <strong>Backfill a range</strong> — for past gaps or source corrections. Each date in the
          range appears as its own run row.
        </li>
        <li>
          <strong>Resolve unmapped names</strong> — click the unmapped count on a run to open
          Aliases for account names. Unknown API codes are resolved in{" "}
          <a href="/help/features/api-review">API review</a>.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>No runs yet</strong> — the page shows an empty state until the first run.
        </li>
        <li>
          <strong>Source unavailable</strong> — the run records an error and is tinted red. No
          partial data is saved, and the next successful scheduled run fills the missed date.
        </li>
        <li>
          <strong>Cron authentication</strong> — the scheduled endpoint requires a secret bearer
          token (<code>CRON_SECRET</code>). It does not use user sessions.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/aliases", label: "Aliases & unmapped names" },
          { href: "/help/features/settings", label: "Settings" },
          { href: "/help/api/integrations", label: "Integrations (API reference)" },
        ]}
      />
    </>
  );
}
