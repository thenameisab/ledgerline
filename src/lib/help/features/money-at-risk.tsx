import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "money-at-risk",
  title: "Money at risk",
  summary:
    "A triage card that totals the revenue you are losing right now — unpriced traffic, unmapped log names, and pairs sold below cost — each one click from its fix.",
  group: "Dashboard",
  role: "all",
  routes: ["/dashboard"],
};

export default function Body() {
  return (
    <>
      <p>
        Revenue dashboards usually show what you earned. Money at risk shows what you{" "}
        <em>didn&rsquo;t</em> — billable traffic that produced no revenue, or revenue booked at a
        loss. It sits high on the dashboard because every rupee on it is recoverable, and each row
        links straight to the screen where you recover it.
      </p>

      <Figure
        src="/help/shots/dashboard-full.png"
        alt="Full dashboard including the Money at risk card with its three risk rows"
        caption="Money at risk on the dashboard, with a Triage link into Aliases."
      />

      <H2 id="what-you-see">What you see</H2>
      <p>The card totals up to three kinds of risk, each with an amount and a hit count:</p>
      <ul>
        <li>
          <strong>Revenue leak — unpriced billable pairs.</strong> (account, API) pairs that took
          traffic with no price set. The traffic happened; nothing was billed. Links to the
          account&rsquo;s pricing page.
        </li>
        <li>
          <strong>Silent loss — unmapped log names.</strong> Account or API names in the usage logs
          that don&rsquo;t resolve to anything in the catalog, so their revenue is excluded
          entirely. Links to the Aliases triage screen.
        </li>
        <li>
          <strong>Margin watch — selling below cost.</strong> Pairs where the vendor cost exceeds
          the charged price. Shown as a negative amount because it is an actual booked loss, not an
          estimate.
        </li>
      </ul>
      <p>
        The header shows the month&rsquo;s combined total, and a <strong>Triage</strong> link jumps
        to <code>/admin/aliases</code>.
      </p>

      <Callout variant="info" title="Why some figures carry a ~">
        Unpriced and unmapped traffic has no booked price, so leak and silent-loss amounts are{" "}
        <em>estimated</em> at the org-average rate per hit (the card footnotes the exact rate).
        Margin watch is never estimated — it is computed from real prices and real vendor costs.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Click a risk row</strong> — each one deep-links to its remedy: pricing pages for
          leaks, Aliases for unmapped names, the API view for margin problems.
        </li>
        <li>
          <strong>Fix the cause, watch the row shrink</strong> — pricing a pair or mapping a name
          re-attributes the historical traffic, so the amount drops on the next refresh rather
          than only for future days.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Nothing at risk</strong> — the card collapses to a green "No money at risk"
          state: every billable pair priced, all log names resolved, nothing sold below cost.
        </li>
        <li>
          <strong>Member role</strong> — the rows are visible to everyone, but the fixes (pricing,
          aliases) live behind admin-only screens; members see the problem, admins clear it.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/unpriced-traffic", label: "Unpriced traffic detection" },
          { href: "/help/features/aliases", label: "Aliases & unmapped names" },
          { href: "/help/features/account-pricing", label: "Account pricing" },
          { href: "/help/math", label: "How risk amounts are estimated" },
        ]}
      />
    </>
  );
}
