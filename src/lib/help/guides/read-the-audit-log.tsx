import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "read-the-audit-log",
  title: "Read the audit log",
  summary: "Trace who changed what and when — pricing edits, invites, manual entries, and every other state change.",
  group: "Admin",
  role: "admin",
  minutes: 3,
};

export default function Body() {
  return (
    <>
      <p>
        Every state change in Ledgerline — a price edit, an invite, a finalized invoice, a voided
        manual entry — lands in the audit log with the actor, the action, and a before/after diff.
        When a number looks wrong, this is where you find out why.
      </p>

      <Figure
        src="/help/shots/admin-audit.png"
        alt="The audit log with filters and expandable change diffs"
        caption="The audit log: filters on top, one row per event, diffs expandable inline."
      />

      <H2 id="filter">Filter to what you care about</H2>
      <Steps>
        <Step title="Open Admin → Audit log">
          Events are newest-first, 50 per page, with <strong>Newer</strong> /{" "}
          <strong>Older</strong> links at the bottom. The subtitle counts matching events.
        </Step>
        <Step title="Combine the three filters">
          Filter by <strong>user</strong> (who did it), <strong>action</strong> (e.g.{" "}
          <code>pricing.update</code>, <code>user.invite</code>,{" "}
          <code>manual_entry.create</code>), and <strong>entity type</strong>. Changing a filter
          resets pagination; filters live in the URL so a filtered view is shareable.
        </Step>
      </Steps>

      <H2 id="diff">Read a change</H2>
      <Steps>
        <Step title="Scan the compact summary">
          Each row condenses the diff to “field: old → new”, with “+N more” when several fields
          changed.
        </Step>
        <Step title="Expand for the full before/after">
          The disclosure reveals the complete before and after JSON — useful for reconstructing a
          pricing row or invite exactly as it was.
        </Step>
        <Step title="Follow the entity">
          Where the entity still exists (a SKU, an account), its identifier links to the live
          record.
        </Step>
      </Steps>

      <Callout variant="info">
        The log is read-only by design — there is no way to edit or delete events, including for
        admins.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/set-account-pricing", label: "Set or edit account pricing" },
          { href: "/help/guides/manage-roles-and-access", label: "Change a role or disable a user" },
          { href: "/help/api", label: "API reference" },
        ]}
      />
    </>
  );
}
