import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "manage-vendor-costs",
  title: "Manage vendor costs",
  summary: "Replace placeholder cost estimates with confirmed per-API vendor rates so margin numbers are real.",
  group: "Admin",
  role: "admin",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        Margin is revenue minus vendor cost, so margin is only as good as the cost data behind it.
        Until you confirm a rate, Ledgerline uses placeholder estimates and flags them — the{" "}
        <strong>Est.</strong> chips you see across the vendor pages.
      </p>

      <H2 id="overview">Find vendors with estimated costs</H2>
      <Figure
        src="/help/shots/admin-vendor-cost.png"
        alt="The Vendor costs page with the total cost KPI and vendor cards"
        caption="Vendor cards: cost MTD, share of spend, and how many costs are still estimates."
      />
      <Steps>
        <Step title="Open Vendors">
          The KPI strip totals vendor spend for the month and warns when “N of M per-API costs are
          still estimates — margin numbers lean on placeholder rates until confirmed.”
        </Step>
        <Step title="Click a vendor card">
          Cards show cost MTD, share of total spend, API and hit counts, and an{" "}
          <strong>Est.</strong> chip when costs are unconfirmed.
        </Step>
      </Steps>

      <H2 id="edit">Confirm per-API costs</H2>
      <Figure
        src="/help/shots/admin-vendor-detail.png"
        alt="A vendor detail page with editable per-API cost cells"
        caption="The vendor detail table — cells are editable in place and save on blur."
      />
      <Steps>
        <Step title="Find the API row">
          Columns: API, Hits, <strong>Cost (S/ND/F/IP) ₹</strong> per hit by status, Total cost
          MTD, Share. Rows still on estimates carry the <strong>Est.</strong> chip.
        </Step>
        <Step title="Type the confirmed rate into a cell">
          The table is live for admins — “Editable — changes save on blur”. Click into a cost cell,
          type the ₹ value, and click away to save.
        </Step>
        <Step title="Watch the chip clear">
          Saving a cost marks that row confirmed: the <strong>Est.</strong> chip disappears and the
          “Confirmed cost rows” stat ticks up. Margin recomputes everywhere immediately — the
          dashboard, API pages, and internal invoice variants.
        </Step>
      </Steps>

      <Callout variant="info">
        Costs are temporal like prices: a confirmed rate applies from its effective date forward,
        and historical usage keeps the cost that was in effect at the time.
      </Callout>

      <Callout variant="tip">
        Start with the vendors that dominate the share bar — confirming the top two or three
        usually moves the org margin number from “guess” to “fact”.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/investigate-an-api", label: "Investigate an API" },
          { href: "/help/guides/read-the-dashboard", label: "Read the dashboard" },
          { href: "/help/math", label: "Vendor cost & margin math" },
        ]}
      />
    </>
  );
}
