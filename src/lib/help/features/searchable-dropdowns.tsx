import type { FeatureMeta } from "../types";
import { H2, Callout, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "searchable-dropdowns",
  title: "Searchable dropdowns",
  summary:
    "The API, account, and group pickers are type-to-filter dropdowns: search by product code, name, or any part of either — in any word order — instead of scrolling a long list.",
  group: "Platform",
  role: "all",
  routes: [],
};

export default function Body() {
  return (
    <>
      <p>
        Anywhere you pick an API, an account, or a group, the dropdown is searchable. Open it and
        a search box appears at the top — type a few characters and the list narrows to the best
        matches as you go, so you never have to scroll past hundreds of accounts to find one.
      </p>

      <H2 id="how-it-matches">How matching works</H2>
      <ul>
        <li>
          <strong>Multiple fields</strong> — API pickers match on both the <strong>product
          code</strong> and the <strong>API name</strong> (and category); account and group
          pickers match on the name. Typing <code>IV20</code> or <code>aadhaar</code> finds the
          same API.
        </li>
        <li>
          <strong>Partial words</strong> — you don&rsquo;t need the whole word; <code>mask</code>{" "}
          finds &ldquo;Aadhaar Masking&rdquo;.
        </li>
        <li>
          <strong>Any order</strong> — words can be out of order: <code>mask aadhaar</code> still
          finds &ldquo;Aadhaar Masking&rdquo;.
        </li>
        <li>
          <strong>Ranked</strong> — exact and prefix matches sort above looser ones, so the most
          likely choice is at the top.
        </li>
      </ul>

      <H2 id="where">Where it appears</H2>
      <ul>
        <li>
          <strong>Manual entry</strong> — the account picker and each line&rsquo;s API picker.
        </li>
        <li>
          <strong>Aliases</strong> — choosing the canonical account or API to map a raw name to.
        </li>
        <li>
          <strong>Account pricing</strong> — the &ldquo;add API&rdquo; row.
        </li>
        <li>
          <strong>New account</strong> — the group picker.
        </li>
        <li>
          <strong>Accounts directory</strong> — the group filter (search inside the menu).
        </li>
      </ul>

      <H2 id="keyboard">Keyboard</H2>
      <ul>
        <li>The search box is focused the moment the menu opens — just start typing.</li>
        <li>
          <strong>↑ ↓</strong> move through results, <strong>↵</strong> selects,{" "}
          <strong>esc</strong> closes.
        </li>
        <li>
          Action rows stay available while searching — <strong>+ Create new API…</strong> on the
          API pickers, <strong>(None)</strong> on the optional group picker.
        </li>
      </ul>

      <Callout variant="info" title="This is in-page search, not the command palette">
        These dropdowns filter the choices already loaded on the page. To jump across the whole
        product — any account or API by name — use the command palette (⌘K) instead.
      </Callout>

      <Related
        links={[
          { href: "/help/features/command-palette", label: "Command palette & shortcuts" },
          { href: "/help/features/manual-entries", label: "Manual entries" },
          { href: "/help/features/aliases", label: "Aliases & unmapped names" },
        ]}
      />
    </>
  );
}
