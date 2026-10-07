import type { FeatureMeta } from "../types";
import { H2, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "sku-catalog",
  title: "SKU catalog",
  summary:
    "Every SKU ranked by revenue, with its billing unit, units, consumers, average price, share, and margin — plus filters that surface the high-volume, low-margin, and inactive ones.",
  group: "SKUs",
  role: "all",
  routes: ["/skus"],
};

export default function Body() {
  return (
    <>
      <p>
        The catalog is the product list seen through a revenue lens. Where the accounts directory
        asks "who pays us?", the catalog asks "which products earn?" — and, just as usefully,
        which ones run hot with thin margins or sit idle.
      </p>

      <p>
        It is also the source of truth for SKU identity and commercials. Each row's{" "}
        <strong>SKU code</strong> is the sole key usage matches on — a usage row maps to a SKU
        only when its code is an <em>active</em> catalog code — and the catalog owns the
        commercials: name, vendor, category, billing unit, and price. The usage log source supplies the code and
        the usage. The catalog defines what that code means and what it costs.
      </p>

      <Figure
        src="/help/shots/apis.png"
        alt="SKU catalog table with unit, units, accounts, revenue, share bars, and margin per SKU"
        caption="SKUs ranked by revenue, with share bars and margin."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Per row</strong> — SKU name with its SKU code, the billing unit (for example
          &ldquo;1M tokens&rdquo; or &ldquo;message&rdquo;), units used, unique account count,
          average price per unit, revenue, a share bar scaled against the top earner, and margin in
          $ and %.
        </li>
        <li>
          <strong>Row warnings</strong> — negative-margin rows tint red; SKUs that took traffic
          but earned nothing tint orange with a note ("earns nothing on N units").
        </li>
        <li>
          <strong>Filters</strong> — <em>High-volume</em> (≥ 1,000 units this month),{" "}
          <em>Low-margin</em> (margin under 25% of revenue), and <em>Inactive</em> (zero units this
          month), alongside free-text search by name or code.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Open a SKU</strong> — any row navigates to the SKU page with its consumers
          and price ladder.
        </li>
        <li>
          <strong>Filter, search, sort</strong> — all state lives in the URL, so a view like
          "low-margin, sorted by units" is shareable.
        </li>
        <li>
          <strong>Create or edit SKUs (admin)</strong> — catalog governance (creation, editing,
          duplicate detection) is covered on the{" "}
          <a href="/help/features/sku-governance">SKU governance</a> page.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>No matches</strong> — "No SKUs matched your filters" with the filters left in
          place to adjust.
        </li>
        <li>
          <strong>New SKU, no traffic</strong> — appears with zeroed metrics and shows up under
          the Inactive filter until usage arrives.
        </li>
        <li>
          <strong>Deactivated codes</strong> — a retired (is_active = 0) code no longer matches
          incoming usage; its units quarantine and surface in{" "}
          <a href="/help/features/sku-review">SKU review</a> rather than billing.
        </li>
        <li>
          <strong>Zero-revenue rows</strong> — the orange "earns nothing" state is the catalog
          view of unpriced traffic; the fix is per-account pricing, not the catalog.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/sku-page", label: "SKU page" },
          { href: "/help/features/sku-governance", label: "SKU governance" },
          { href: "/help/features/unpriced-traffic", label: "Unpriced traffic detection" },
        ]}
      />
    </>
  );
}
