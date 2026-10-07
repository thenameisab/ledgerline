import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "resolve-unmapped-names",
  title: "Resolve unmapped names (aliases)",
  summary: "Map raw account names to canonical accounts, and resolve unmatched API codes, so their hits start counting as revenue.",
  group: "Data pipeline",
  role: "admin",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        When the sync pulls usage it cannot attribute, the rows are kept with their raw labels and
        earn nothing — that is the “silent loss” bucket on the dashboard. There are two separate
        paths, because accounts and APIs match differently:
      </p>
      <ul>
        <li>
          <strong>Account names</strong> still match by name and aliases — resolve them in{" "}
          <strong>Admin → Aliases</strong>.
        </li>
        <li>
          <strong>API codes</strong> match by Product Code only (no name or alias fallback) —
          resolve them in the new <strong>Admin → API review</strong> queue.
        </li>
      </ul>
      <p>Revenue starts counting the moment a row resolves on either path.</p>

      <Figure
        src="/help/shots/admin-aliases.png"
        alt="The Alias mapper with unmapped names, hit counts, and resolution dropdowns"
        caption="The Alias mapper: unattributed hits KPI on top, one resolver row per raw name."
      />

      <H2 id="accounts">Resolve unmapped account names</H2>
      <Steps>
        <Step title="Open Admin → Aliases">
          The <strong>Accounts</strong> tab is the default. The KPI shows unattributed hits this
          month; each row lists a raw name, its hits, and when it was last seen.
        </Step>
        <Step title="Pick the target in the “Map to” dropdown">
          Choose the canonical account the raw name belongs to. If the account genuinely does not
          exist yet, create it first from the Accounts page (<strong>New account</strong>) and come
          back.
        </Step>
        <Step title="Click “Resolve”">
          The button flips to “Resolved”. Existing usage rows re-attribute, and future syncs map
          the name automatically.
        </Step>
      </Steps>

      <H2 id="apis">Resolve unmatched API codes</H2>
      <p>
        APIs no longer match by name. A usage row maps to an API only when its Product Code is an{" "}
        <em>active</em> catalog code. Anything else lands in <strong>Admin → API review</strong>,
        sorted into queues. Pick the queue, then take the matching action:
      </p>
      <Steps>
        <Step title="Unknown codes → accept into the catalog">
          A code that has usage but no catalog row. If it is a genuine product, accept it to create
          the catalog entry; its hits resolve from then on. Codes are never auto-created — they wait
          here for review.
        </Step>
        <Step title="Missing codes → add a name→code override">
          Rows that arrived with a blank or unknown code. Add an explicit{" "}
          <strong>name → code</strong> override mapping the raw name to the right active code; future
          rows with that name resolve to it.
        </Step>
        <Step title="Name drift → acknowledge the variant">
          The code matches but the raw name differs from the catalog name. Acknowledge the variant
          to record it as a known name and silence the drift alert. This is advisory only — the row
          already resolved by code.
        </Step>
        <Step title="Retired codes with usage → reactivate">
          A deactivated (retired) code is still taking traffic. If it should bill again, reactivate
          it in the catalog; otherwise leave it retired and the hits stay quarantined.
        </Step>
      </Steps>

      <Callout variant="tip">
        Sync runs link here directly: the Unmapped column in the run history on Admin → Usage sync
        jumps to the right queue whenever a pull contained unrecognised account names or API codes.
      </Callout>

      <Related
        links={[
          { href: "/help/features/api-review", label: "API review" },
          { href: "/help/guides/create-or-edit-an-api", label: "Create or edit an API" },
          { href: "/help/guides/refresh-usage-data", label: "Refresh usage data now" },
          { href: "/help/guides/read-the-dashboard", label: "Read the dashboard" },
        ]}
      />
    </>
  );
}
