import type { FeatureMeta } from "../types";
import { H2, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "api-catalog",
  title: "API catalog",
  summary:
    "Every API ranked by revenue, with hits, consumers, average price, share, and margin — plus filters that surface the high-volume, low-margin, and inactive ones.",
  group: "APIs",
  role: "all",
  routes: ["/apis"],
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
        It is also the source of truth for API identity and commercials. Each row's{" "}
        <strong>Product Code</strong> is the sole key usage matches on — a usage row maps to an API
        only when its code is an <em>active</em> catalog code — and the catalog owns the
        commercials: name, vendor, category, and price. The usage log source supplies the code and
        the usage. The catalog defines what that code means and what it costs.
      </p>

      <Figure
        src="/help/shots/apis.png"
        alt="API catalog table with revenue, hits, accounts, share bars, and margin per API"
        caption="APIs ranked by revenue, with share bars and margin."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Per row</strong> — API name with its product code, hits, unique account count,
          average ₹/hit, revenue, a share bar scaled against the top earner, and margin in ₹
          and %.
        </li>
        <li>
          <strong>Row warnings</strong> — negative-margin rows tint red; APIs that took traffic
          but earned nothing tint orange with a note ("earns nothing on N hits").
        </li>
        <li>
          <strong>Filters</strong> — <em>High-volume</em> (≥ 1,000 hits this month),{" "}
          <em>Low-margin</em> (margin under 25% of revenue), and <em>Inactive</em> (zero hits this
          month), alongside free-text search by name or code.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Open an API</strong> — any row navigates to the API profile with its consumers
          and price ladder.
        </li>
        <li>
          <strong>Filter, search, sort</strong> — all state lives in the URL, so a view like
          "low-margin, sorted by hits" is shareable.
        </li>
        <li>
          <strong>Create or edit APIs (admin)</strong> — catalog governance (creation, editing,
          duplicate detection) is covered on the{" "}
          <a href="/help/features/api-governance">API governance</a> page.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>No matches</strong> — "No APIs matched your filters" with the filters left in
          place to adjust.
        </li>
        <li>
          <strong>New API, no traffic</strong> — appears with zeroed metrics and shows up under
          the Inactive filter until usage arrives.
        </li>
        <li>
          <strong>Deactivated codes</strong> — a retired (is_active = 0) code no longer matches
          incoming usage; its hits quarantine and surface in{" "}
          <a href="/help/features/api-review">API review</a> rather than billing.
        </li>
        <li>
          <strong>Zero-revenue rows</strong> — the orange "earns nothing" state is the catalog
          view of unpriced traffic; the fix is per-account pricing, not the catalog.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/api-profile", label: "API profile" },
          { href: "/help/features/api-governance", label: "API governance" },
          { href: "/help/features/unpriced-traffic", label: "Unpriced traffic detection" },
        ]}
      />
    </>
  );
}
