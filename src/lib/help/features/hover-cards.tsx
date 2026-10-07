import type { FeatureMeta } from "../types";
import { H2, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "hover-cards",
  title: "Rich hover cards",
  summary:
    "Hover any account or SKU name to see a summary card — revenue, units, and status — without leaving the page.",
  group: "Platform",
  role: "all",
};

export default function Body() {
  return (
    <>
      <p>
        Account and SKU names throughout Ledgerline are hover targets. Pausing on one opens a compact card
        with the essentials — so you can confirm which entity a row refers to, or check its headline
        numbers, without navigating away and losing your place.
      </p>

      <H2 id="what-you-see">What&rsquo;s on the card</H2>
      <ul>
        <li>
          <strong>Account card</strong> — name and logo, revenue, units, and status for the current
          window.
        </li>
        <li>
          <strong>SKU card</strong> — SKU code, the same summary metrics, and how widely the SKU
          is used.
        </li>
      </ul>

      <H2 id="how-it-works">How it works</H2>
      <p>
        The cards reuse the same cached account and SKU summaries the dashboard already reads, so they
        add no meaningful query cost and always agree with the numbers elsewhere in the app.
      </p>

      <Related
        links={[
          { href: "/help/features/account-profile", label: "Account profile" },
          { href: "/help/features/sku-page", label: "SKU page" },
          { href: "/help/features/command-palette", label: "Command palette" },
        ]}
      />
    </>
  );
}
