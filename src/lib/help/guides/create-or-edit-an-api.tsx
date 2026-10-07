import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "create-or-edit-an-api",
  title: "Create or edit an API in the catalog",
  summary: "Add a product to the catalog or fix its name, vendor type, and log aliases — from three different entry points.",
  group: "Admin",
  role: "admin",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        The API catalog is the source of truth for every product Ledgerline can bill: its code, name,
        category, vendor type, and the raw log names that map to it. One form handles both create
        and edit, and it opens from three places.
      </p>

      <H2 id="open">Open the form</H2>
      <ul>
        <li>
          <strong>Edit</strong> — the <strong>Edit API</strong> button on the API detail page
          (<code>/apis/&lt;code&gt;</code>).
        </li>
        <li>
          <strong>Create from an unmapped name</strong> — <strong>+ Create new API…</strong> in the
          Alias mapper’s APIs tab; the raw log name is wired in as an alias automatically.
        </li>
        <li>
          <strong>Create mid-entry</strong> — <strong>+ Create new API…</strong> at the bottom of
          the API dropdown in the manual-entry wizard; the new API is selected on the line when you
          save.
        </li>
      </ul>

      <Figure
        src="/help/shots/api-detail.png"
        alt="An API detail page with the Edit API button in the header"
        caption="The API detail page — admins see Edit API in the header."
      />

      <H2 id="fields">Fill the fields</H2>
      <Steps>
        <Step title="Product code (required)">
          The unique identifier, e.g. <code>IV2099</code>. Codes are validated against the catalog
          — duplicates are rejected.
        </Step>
        <Step title="Name (required)">
          The display name shown everywhere, e.g. “Aadhaar Masking V2”.
        </Step>
        <Step title="Category, Entity type, Vendor type, Default vendor">
          All optional classification. Vendor type is one of <em>InHouse</em>, <em>Vendor</em>,{" "}
          <em>Stitched</em>, or <em>Journey</em>; default vendor pre-attributes cost (e.g.
          “InHouse”).
        </Step>
        <Step title="Log aliases (comma separated)">
          Every raw name the usage logs might use for this API. The importer resolves rows by code,
          name, or any alias — keeping this list complete is what prevents unmapped traffic.
        </Step>
        <Step title="Save">
          <strong>Create API</strong> or <strong>Save changes</strong>. New APIs appear in every
          picker immediately; edits are recorded in the audit log.
        </Step>
      </Steps>

      <Callout variant="warn">
        Keep names and aliases unique across the catalog. If two APIs claim the same identifier,
        the importer resolves it ambiguously and the pair shows up in the Alias mapper’s{" "}
        <strong>Duplicates</strong> tab until you remove the overlap.
      </Callout>

      <Callout variant="info">
        Creating an API does not price it — each account that uses it still needs a row in their
        price book (or a stitch) before the traffic earns revenue.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/resolve-unmapped-names", label: "Resolve unmapped names" },
          { href: "/help/guides/set-account-pricing", label: "Set or edit account pricing" },
          { href: "/help/guides/read-the-audit-log", label: "Read the audit log" },
        ]}
      />
    </>
  );
}
