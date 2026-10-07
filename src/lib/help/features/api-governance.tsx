import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "api-governance",
  title: "API governance",
  summary:
    "Admin controls that keep the catalog clean: create and edit APIs, manage code identity, and catch hygiene issues like identifiers claimed by more than one API.",
  group: "APIs",
  role: "admin",
  routes: ["/apis"],
};

export default function Body() {
  return (
    <>
      <p>
        Everything in Ledgerline keys off the API catalog — pricing rows, vendor costs, usage
        attribution, invoices. Usage attributes to an API by <strong>Product Code</strong> alone,
        so a clean, unambiguous set of codes matters; catalog changes are admin-gated, validated,
        duplicate-checked, and audited. Code- and name-level issues raised by incoming usage surface
        in <a href="/help/features/api-review">API review</a>.
      </p>

      <Figure
        src="/help/shots/apis.png"
        alt="The API catalog list"
        caption="The API catalog — the single set of Product Codes every pricing row, cost, and invoice keys off."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Edit modal</strong> — on every API profile: display name, category, vendor type,
          entity type, and <em>log aliases</em> — comma-separated acknowledged name variants. These
          no longer drive matching (usage matches by code); they only record known names and
          suppress name-drift alerts.
        </li>
        <li>
          <strong>Create forms</strong> — new APIs can be created from the Aliases screen (when an
          unmapped name turns out to be a genuinely new product) or inline from the manual-entry
          wizard&rsquo;s API picker, without abandoning the form you were in. Product code is
          required and must be unique.
        </li>
        <li>
          <strong>Duplicate detection</strong> — the Duplicates tab in Aliases lists identifiers
          (names or aliases) claimed by more than one API, with the claiming APIs shown as
          clickable pills. This is catalog hygiene, not an importer hazard.
        </li>
      </ul>

      <Callout variant="tip" title="Duplicates are a hygiene signal, not an import hazard">
        Because usage matches by Product Code, two APIs sharing a name or alias no longer make
        attribution ambiguous. Duplicates just signal a cluttered catalog worth tidying — open the
        offending APIs and remove the shared identifier when convenient; the Duplicates tab itself
        is read-only.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Create an API</strong> — product code (unique), display name, optional category
          and vendor type. It appears in every picker immediately.
        </li>
        <li>
          <strong>Edit an API</strong> — rename, recategorise, or adjust the acknowledged name
          variants; attribution itself is unaffected, since usage resolves by code.
        </li>
        <li>
          <strong>Audit any change</strong> — <code>api.create</code> and <code>api.update</code>{" "}
          events record before/after values in the audit log.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Duplicate product code</strong> — creation is rejected; codes are the primary
          key of the catalog.
        </li>
        <li>
          <strong>Removing a name variant</strong> — attribution is unchanged (matching is by
          code), but a raw name that drifts from the catalog name may resurface as a name-drift
          item in <a href="/help/features/api-review">API review</a>.
        </li>
        <li>
          <strong>Deactivating a code</strong> — a retired (is_active = 0) code stops matching
          incoming usage; any further hits quarantine and appear in API review until the code is
          reactivated.
        </li>
        <li>
          <strong>Members</strong> — can browse the catalog and profiles but see no create or edit
          affordances.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/aliases", label: "Aliases & unmapped names" },
          { href: "/help/features/api-review", label: "API review" },
          { href: "/help/features/api-catalog", label: "API catalog" },
          { href: "/help/features/audit-log", label: "Audit log" },
        ]}
      />
    </>
  );
}
