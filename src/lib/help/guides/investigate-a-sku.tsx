import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, OpenInApp, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "investigate-a-sku",
  title: "Investigate a SKU",
  summary: "Find a SKU in the catalog and see who uses it, at what price, and with what margin.",
  group: "Daily work",
  role: "all",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        The SKU lens answers a different question than the account lens: for one SKU, who
        consumes it, how is it priced across accounts, and is it making money?
      </p>
      <OpenInApp href="/skus" label="Open SKUs" />

      <H2 id="catalog">Scan the catalog</H2>
      <Figure
        src="/help/shots/apis.png"
        alt="The SKU catalog table ranked by revenue"
        caption="The catalog, ranked by revenue. Columns are sortable; rows with problems are tinted."
      />
      <Steps>
        <Step title="Open SKUs (⌘3)">
          Every SKU in the catalog, ranked by revenue. Columns: SKU, Unit, Units, Accounts, Avg
          price, Revenue, Share, Margin — click any header to re-sort.
        </Step>
        <Step title="Watch the row tints">
          Rows with a negative margin are tinted red. Rows with units but no revenue are flagged —
          they earn nothing until priced.
        </Step>
        <Step title="Filter or search">
          The filter chips narrow to high-volume, low-margin, or inactive SKUs; the search box
          matches name or SKU code. Click a row to open its detail page.
        </Step>
      </Steps>

      <H2 id="detail">Read the detail page</H2>
      <Figure
        src="/help/shots/api-detail.png"
        alt="A SKU page with headline, heatmap, and the account price ladder"
        caption="SKU page: headline KPIs, activity heatmap, and per-account pricing."
      />
      <ul>
        <li>
          <strong>Headline</strong> — revenue with a month-over-month chip, units, unique accounts,
          average price per unit, and margin. If accounts pay different rates, the price spread ($min
          – $max per unit) is called out.
        </li>
        <li>
          <strong>Activity heatmap</strong> — 90 days of daily units.
        </li>
        <li>
          <strong>Account consumers table</strong> — every account using this SKU, with units, the
          negotiated price, a price-ladder bar comparing each account to the highest payer, and
          revenue. A <em>stitched</em> chip marks accounts billed via a bundle; a red{" "}
          <em>unpriced</em> chip marks accounts with no price row.
        </li>
      </ul>

      <Callout variant="tip">
        The price ladder is the quickest way to spot an account paying well below everyone else —
        useful ammunition before a renegotiation.
      </Callout>

      <p>
        Admins also get an <strong>Edit SKU</strong> button in the header to change the name,
        category, billing unit, vendor type, or log aliases — see the catalog guide.
      </p>

      <Related
        links={[
          { href: "/help/guides/create-or-edit-a-sku", label: "Create or edit a SKU" },
          { href: "/help/guides/create-a-stitched-bundle", label: "Create a stitched SKU bundle" },
          { href: "/help/math", label: "How the numbers are computed" },
        ]}
      />
    </>
  );
}
