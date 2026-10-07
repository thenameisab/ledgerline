import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "aliases",
  title: "Aliases & unmapped names",
  summary:
    "The triage desk for raw account names that don't resolve to a record — map them or create the missing account, and quarantined revenue starts counting. (API identity is code-based now — see API review.)",
  group: "Admin",
  role: "admin",
  routes: ["/admin/aliases"],
};

export default function Body() {
  return (
    <>
      <p>
        Usage logs spell names however the upstream systems feel like. When the daily sync meets a
        account name it can&rsquo;t resolve, it never guesses and never auto-creates — the rows are
        kept with their raw labels and quarantined out of revenue. Aliases is where a human settles
        each one: map it to an existing account, or create the account it should be.
      </p>

      <Callout variant="info" title="APIs are matched by Product Code now">
        Since the API identity upgrade, usage resolves to an API by its <em>Product Code</em>, not
        its name — so unrecognised <em>API</em> codes are triaged on{" "}
        <a href="/help/features/api-review">API review</a>, not here. This page is the home for{" "}
        <em>account</em> names (which have no code). The APIs and Duplicates tabs remain for catalog
        hygiene, but mapping an API name no longer drives ingestion matching.
      </Callout>

      <Figure
        src="/help/shots/admin-aliases.png"
        alt="Aliases page with unmapped account names, hit counts, and inline resolution dropdowns"
        caption="Unmapped names with their hit counts and an inline resolver per row."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Accounts tab</strong> — unmapped account names with their MTD hits and last-seen
          date, headed by an "unattributed hits" KPI quantifying what the quarantine is costing.
        </li>
        <li>
          <strong>APIs tab</strong> — raw API names with no resolved code; mapping one heals
          already-quarantined rows by name, but day-to-day API resolution is code-based on{" "}
          <a href="/help/features/api-review">API review</a>. Names never seen before carry a{" "}
          <em>new</em> chip.
        </li>
        <li>
          <strong>Duplicates tab</strong> — identifiers claimed by more than one API, where the
          importer would resolve ambiguously (see{" "}
          <a href="/help/features/api-governance">API governance</a>).
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Map to an existing record</strong> — pick the account or API from a searchable
          dropdown; the raw name is saved as an alias on it.
        </li>
        <li>
          <strong>Create the missing record</strong> — a short modal (account: name, group,
          GSTIN; API: unique product code, name, category, vendor type) creates it with the raw
          name attached as an alias.
        </li>
      </ul>

      <Callout variant="tip" title="Resolution heals retroactively">
        Quarantined rows keep their raw labels, so mapping a name re-attributes <em>all</em> of
        its historical traffic, not just future days. Revenue for those rows starts counting the
        moment the mapping lands.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Nothing unmapped</strong> — the tabs show empty states, and sync-run history
          reads "all mapped".
        </li>
        <li>
          <strong>Where unmapped traffic shows up meanwhile</strong> — as the "Silent loss" row in
          the dashboard&rsquo;s Money at risk card, estimated at the org-average rate.
        </li>
        <li>
          <strong>From the sync page</strong> — each sync run&rsquo;s unmapped counts link
          directly here with the right tab pre-selected.
        </li>
        <li>
          <strong>Raw names are preserved</strong> — the original spelling stays on the usage rows
          for traceability even after resolution.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/api-review", label: "API review (unmapped codes)" },
          { href: "/help/features/usage-sync", label: "Usage sync" },
          { href: "/help/features/money-at-risk", label: "Money at risk" },
          { href: "/help/features/api-governance", label: "API governance" },
        ]}
      />
    </>
  );
}
