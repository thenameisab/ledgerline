import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "set-slab-pricing",
  title: "Set up volume pricing (tiers & slabs)",
  summary:
    "Price a SKU by volume with one of two models: graduated tiers, or a single whole-volume slab rate.",
  group: "Pricing",
  role: "admin",
  minutes: 5,
};

export default function Body() {
  return (
    <>
      <p>
        When a contract prices a SKU by volume, Ledgerline offers two models on the account&rsquo;s
        pricing row. The vocabulary is conventional:
      </p>
      <ul>
        <li>
          <strong>Tier</strong> (graduated, like tax brackets) — each slice of the period&rsquo;s
          total units bills at its own rate. For example, an account sends 1.2M messages on{" "}
          <code>MSG-SMS-US</code> in a month, with tiers 0&ndash;1M at $0.0079 per message and 1M+ at
          $0.0065 per message. The month bills 1,000,000&nbsp;×&nbsp;$0.0079 +
          200,000&nbsp;×&nbsp;$0.0065 = $7,900 + $1,300 = $9,200.
        </li>
        <li>
          <strong>Slab</strong> (whole-volume) — the period&rsquo;s <em>entire</em> volume bills at
          the single rate of the bracket the total lands in. The same 1.2M messages land in the 1M+
          bracket, so all of them bill at $0.0065: 1,200,000&nbsp;×&nbsp;$0.0065 = $7,800.
        </li>
      </ul>
      <p>
        Both are graduated <strong>per calendar month</strong> — brackets reset monthly, which is the
        billing truth.
      </p>

      <H2 id="create">Put a row on volume pricing</H2>
      <Steps>
        <Step title="Open the account’s pricing page">
          From the account detail page, click <strong>Manage pricing</strong>.
        </Step>
        <Step title="Switch the SKU row to a volume model">
          The chip beside the SKU code swaps the four rate inputs for a bracket editor. Choose{" "}
          <strong>tier</strong> (graduated) or <strong>slab</strong> (whole-volume) — the editor
          defaults to whole-volume. (A brand-new SKU must be added flat first, then converted.)
        </Step>
        <Step title="Add the unit ranges">
          The first bracket starts at 0. Set each bracket&rsquo;s upper cap with{" "}
          <strong>Add bracket</strong>; the last is open-ended (&ldquo;and above&rdquo;). Ranges must
          be contiguous — no gaps or overlaps. The brackets are shared between both models, so you can
          flip the model without re-entering them.
        </Step>
        <Step title="Set each bracket’s rates">
          Every bracket has the four outcome prices (S / ND / F / IP). Most SKUs only price{" "}
          <strong>successful</strong> — leave the others at 0 if they aren&rsquo;t billed.
        </Step>
        <Step title="Set the effective date, apply, then save">
          Each row&rsquo;s <strong>effective from</strong> date is editable — set when this pricing
          starts. <strong>Apply</strong> stages the change; the sticky save bar commits it like any
          other pricing edit.
        </Step>
      </Steps>

      <H2 id="after">How a volume-priced row reads afterwards</H2>
      <ul>
        <li>
          The row shows a bracket summary (e.g. <em>3 tiers · $0.0079 → $0.0065 → $0.0055</em>, or a slab rate)
          with an edit button instead of the four rate boxes.
        </li>
        <li>
          Invoices and dashboards price the SKU on the period&rsquo;s total volume — it is never
          flagged as unpriced revenue leak, even though its flat columns are 0. The account SKU
          breakdown tags it and can expand to show the per-tier split.
        </li>
        <li>
          To remove volume pricing, click <strong>use flat</strong> on the row and set a single rate.
        </li>
      </ul>

      <Callout variant="warn">
        Volume rates apply over the <strong>whole month&rsquo;s</strong> units, so the effective rate
        is only final once the month&rsquo;s total volume is known. Editing a pair already billed on a
        finalized invoice supersedes with a new dated bracket set — issued numbers never change.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/set-account-pricing", label: "Set or edit account pricing" },
          { href: "/help/guides/create-a-stitched-bundle", label: "Create a stitched bundle" },
          { href: "/help/math#slabs", label: "Slab pricing math" },
        ]}
      />
    </>
  );
}
