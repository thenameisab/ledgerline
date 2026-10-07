import type { FeatureMeta } from "../types";
import { H2, Callout, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "unpriced-traffic",
  title: "Unpriced traffic detection",
  summary:
    "Ledgerline continuously detects (account, SKU) pairs that took traffic with no price row, estimates the loss, and surfaces it everywhere the fix is one click away.",
  group: "Pricing",
  role: "all",
  routes: ["/dashboard"],
};

export default function Body() {
  return (
    <>
      <p>
        The most expensive billing failure is silent: a SKU goes live for an account before anyone
        writes the price row, the traffic flows, and the invoice quietly omits it. Ledgerline treats
        unpriced traffic as a first-class defect — detected continuously, valued in dollars, and
        shown on every surface where someone could fix it.
      </p>

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Dashboard</strong> — the "Revenue leak" row in Money at risk totals all unpriced
          pairs org-wide, estimated at the org-average price per unit (marked with a ~ because no
          booked price exists).
        </li>
        <li>
          <strong>Accounts directory</strong> — affected accounts carry a red <em>leak</em> badge
          and a dedicated filter bucket.
        </li>
        <li>
          <strong>Account profile</strong> — a leak alert with the amount at risk and the count of
          unpriced pairs, plus red-tinted rows in the SKU breakdown (units, zero revenue). The
          briefing calls it out in words.
        </li>
        <li>
          <strong>Pricing page</strong> — an "unpriced SKUs" section listing each pair with the
          date it was first used.
        </li>
        <li>
          <strong>SKU page</strong> — consumers with no price row carry a red{" "}
          <em>unpriced</em> chip.
        </li>
      </ul>

      <Callout variant="info" title="$0 is not unpriced">
        A pair priced at $0 is a deliberate no-charge arrangement and is not flagged. A leak means
        there is <em>no price row at all</em> — nobody has decided what this traffic costs.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Fix it (admin)</strong> — set prices on the account&rsquo;s pricing page. The
          pair starts earning from the price&rsquo;s effective date, and the leak flags clear on
          the next refresh.
        </li>
        <li>
          <strong>See it (member)</strong> — members get every signal and can escalate; the edit
          itself is admin-only.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Manual entries can leak too</strong> — the wizard warns on lines with no
          pricing but allows them; they join the leak total until priced.
        </li>
        <li>
          <strong>Prospective recovery</strong> — pricing a pair today does not retroactively bill
          past unpriced days; for traffic that already happened, set the effective date back to
          when the price was actually agreed.
        </li>
        <li>
          <strong>Different from unmapped names</strong> — a leak is a known account and SKU with
          no price. An unmapped log name is traffic Ledgerline can&rsquo;t even attribute; that is the
          "silent loss" row, handled in Aliases.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/money-at-risk", label: "Money at risk" },
          { href: "/help/features/account-pricing", label: "Account pricing" },
          { href: "/help/features/aliases", label: "Aliases & unmapped names" },
          { href: "/help/math", label: "How the leak estimate works" },
        ]}
      />
    </>
  );
}
