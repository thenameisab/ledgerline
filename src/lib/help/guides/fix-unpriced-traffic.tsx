import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "fix-unpriced-traffic",
  title: "Fix unpriced traffic (revenue leak)",
  summary: "Trace a revenue leak from the dashboard alert to the missing price row, and bill the traffic already logged.",
  group: "Pricing",
  role: "admin",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        A revenue leak is traffic that bills ₹0 because an account × API pair has no price row. The
        hits are logged, the work was done — the money just is not being counted. Ledgerline surfaces
        leaks in three places and fixing one takes a minute.
      </p>

      <H2 id="find">Find the leak</H2>
      <Figure
        src="/help/shots/dashboard.png"
        alt="The dashboard Money at risk panel highlighting the revenue leak bucket"
        caption="Money at risk on the dashboard — the leak bucket totals all unpriced billable pairs."
      />
      <Steps>
        <Step title="Start from the dashboard">
          The <strong>Money at risk</strong> panel shows “Revenue leak · unpriced billable pairs”
          with the estimated ₹ amount. The Accounts page also has a <strong>Revenue leak</strong>{" "}
          filter pill, and leaking accounts carry a red status chip.
        </Step>
        <Step title="Open the account">
          The account detail page shows a leak alert with the amount at risk and how many API pairs
          are unpriced. In the API breakdown, leaking rows are tinted red — hits but ₹0 revenue.
        </Step>
        <Step title="Click “Manage pricing”">
          The leak alert and the API breakdown header both link straight to the pricing editor.
        </Step>
      </Steps>

      <H2 id="fix">Price the pair</H2>
      <Figure
        src="/help/shots/account-pricing.png"
        alt="The pricing table with an unpriced row highlighted in red"
        caption="Unpriced rows are tinted red with an “unpriced” chip and the date of first use."
      />
      <Steps>
        <Step title="Find the rows flagged “unpriced”">
          They sit in the same table as priced rows, tinted red. Hover the chip to see how many
          hits have accrued since first use.
        </Step>
        <Step title="Type the negotiated rates">
          Fill the S / ND / F / IP cells. The Effective from column flips to “→ &lt;first-used
          date&gt;” — the new price applies from the pair’s first recorded usage, so the traffic
          already logged gets billed, not just future hits.
        </Step>
        <Step title="Save">
          Click <strong>Save change</strong> in the sticky bar. Revenue recomputes immediately: the
          account’s leak alert clears and the dashboard risk figure drops on its next refresh.
        </Step>
      </Steps>

      <Callout variant="info">
        If the “leak” is really a packaged product (several APIs sold as one call), do not price
        each member — create a stitched bundle instead. Members of a stitch bill ₹0 by design and
        stop counting as leak.
      </Callout>

      <Callout variant="tip">
        The manual-entry wizard warns about leaks before they happen: any line whose pair has no
        pricing shows “No pricing — revenue will be 0” in the preview. Price the pair first, then
        post the entry.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/set-account-pricing", label: "Set or edit account pricing" },
          { href: "/help/guides/create-a-stitched-bundle", label: "Create a stitched API bundle" },
          { href: "/help/guides/resolve-unmapped-names", label: "Resolve unmapped names" },
        ]}
      />
    </>
  );
}
