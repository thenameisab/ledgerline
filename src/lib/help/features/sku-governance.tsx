import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "sku-governance",
  title: "SKU governance",
  summary:
    "Admin controls that keep the catalog clean: create and edit SKUs, manage code identity, and catch hygiene issues like identifiers claimed by more than one SKU.",
  group: "SKUs",
  role: "admin",
  routes: ["/skus"],
};

export default function Body() {
  return (
    <>
      <p>
        Everything in Ledgerline keys off the SKU catalog — pricing rows, vendor costs, usage
        attribution, invoices. Usage attributes to a SKU by <strong>SKU code</strong> alone,
        so a clean, unambiguous set of codes matters; catalog changes are admin-gated, validated,
        duplicate-checked, and audited. Code- and name-level issues raised by incoming usage surface
        in <a href="/help/features/sku-review">SKU review</a>.
      </p>

      <Figure
        src="/help/shots/apis.png"
        alt="The SKU catalog list"
        caption="The SKU catalog — the single set of SKU codes every pricing row, cost, and invoice keys off."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Edit modal</strong> — on every SKU page: display name, category, billing unit, vendor type,
          entity type, and <em>log aliases</em> — comma-separated acknowledged name variants. These
          no longer drive matching (usage matches by code); they only record known names and
          suppress name-drift alerts.
        </li>
        <li>
          <strong>Create forms</strong> — new SKUs can be created from the Aliases screen (when an
          unmapped name turns out to be a genuinely new product) or inline from the manual-entry
          wizard&rsquo;s SKU picker, without abandoning the form you were in. SKU code and billing unit are
          required, and the SKU code must be unique.
        </li>
        <li>
          <strong>Duplicate detection</strong> — the Duplicates tab in Aliases lists identifiers
          (names or aliases) claimed by more than one SKU, with the claiming SKUs shown as
          clickable pills. This is catalog hygiene, not an importer hazard.
        </li>
      </ul>

      <Callout variant="tip" title="Duplicates are a hygiene signal, not an import hazard">
        Because usage matches by SKU code, two SKUs sharing a name or alias no longer make
        attribution ambiguous. Duplicates just signal a cluttered catalog worth tidying — open the
        offending SKUs and remove the shared identifier when convenient; the Duplicates tab itself
        is read-only.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Create a SKU</strong> — SKU code (unique), display name, billing unit (for example
          &ldquo;1M tokens&rdquo;, &ldquo;minute&rdquo;, or &ldquo;GPU-hour&rdquo;), optional category and
          vendor type. It appears in every picker immediately.
        </li>
        <li>
          <strong>Edit a SKU</strong> — rename, recategorise, or adjust the acknowledged name
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
          <strong>Duplicate SKU code</strong> — creation is rejected; codes are the primary
          key of the catalog.
        </li>
        <li>
          <strong>Removing a name variant</strong> — attribution is unchanged (matching is by
          code), but a raw name that drifts from the catalog name may resurface as a name-drift
          item in <a href="/help/features/sku-review">SKU review</a>.
        </li>
        <li>
          <strong>Deactivating a code</strong> — a retired (is_active = 0) code stops matching
          incoming usage; any further usage quarantines and appears in SKU review until the code is
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
          { href: "/help/features/sku-review", label: "SKU review" },
          { href: "/help/features/sku-catalog", label: "SKU catalog" },
          { href: "/help/features/audit-log", label: "Audit log" },
        ]}
      />
    </>
  );
}
