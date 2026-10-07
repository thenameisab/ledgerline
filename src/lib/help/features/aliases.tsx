import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "aliases",
  title: "Aliases & unmapped names",
  summary:
    "The triage desk for raw account names that don't resolve to a record — map them or create the missing account, and quarantined revenue starts counting. (SKU identity is code-based now — see SKU review.)",
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

      <Callout variant="info" title="SKUs are matched by SKU code">
        Usage resolves to a SKU by its <em>SKU code</em>, not its name — so unrecognised{" "}
        <em>SKU</em> codes are triaged on{" "}
        <a href="/help/features/sku-review">SKU review</a>, not here. This page is the home for{" "}
        <em>account</em> names (which have no code). The SKUs and Duplicates tabs remain for catalog
        hygiene, but mapping a SKU name does not drive ingestion matching.
      </Callout>

      <Figure
        src="/help/shots/admin-aliases.png"
        alt="Aliases page with unmapped account names, unit counts, and inline resolution dropdowns"
        caption="Unmapped names with their unit counts and an inline resolver per row."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Accounts tab</strong> — unmapped account names with their MTD units and last-seen
          date, headed by an "unattributed units" KPI quantifying what the quarantine is costing.
        </li>
        <li>
          <strong>SKUs tab</strong> — raw SKU names with no resolved code; mapping one heals
          already-quarantined rows by name, but day-to-day SKU resolution is code-based on{" "}
          <a href="/help/features/sku-review">SKU review</a>. Names never seen before carry a{" "}
          <em>new</em> chip.
        </li>
        <li>
          <strong>Duplicates tab</strong> — identifiers claimed by more than one SKU, where the
          importer would resolve ambiguously (see{" "}
          <a href="/help/features/sku-governance">SKU governance</a>).
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Map to an existing record</strong> — pick the account or SKU from a searchable
          dropdown; the raw name is saved as an alias on it.
        </li>
        <li>
          <strong>Create the missing record</strong> — a short modal (account: name, group,
          Tax ID; SKU: unique SKU code, name, category, vendor type) creates it with the raw
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
          { href: "/help/features/sku-review", label: "SKU review (unmapped codes)" },
          { href: "/help/features/usage-sync", label: "Usage sync" },
          { href: "/help/features/money-at-risk", label: "Money at risk" },
          { href: "/help/features/sku-governance", label: "SKU governance" },
        ]}
      />
    </>
  );
}
