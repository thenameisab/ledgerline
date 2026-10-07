import type { FeatureMeta } from "../types";
import { H2, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "biggest-movers",
  title: "Biggest movers",
  summary:
    "The accounts whose revenue changed most against last month — fairly compared by scaling the prior month to the days elapsed so far.",
  group: "Dashboard",
  role: "all",
  routes: ["/dashboard"],
};

export default function Body() {
  return (
    <>
      <p>
        Top-account lists tell you who matters; they rarely tell you who <em>changed</em>. Biggest
        movers fills that gap: it ranks accounts by how much their revenue moved against last
        month, so a mid-size account quietly doubling — or a large one quietly halving — surfaces
        before it shows up in the totals.
      </p>

      <Figure
        src="/help/shots/dashboard-full.png"
        alt="Dashboard with the Biggest movers card listing accounts with up and down arrows and rupee deltas"
        caption="Movers complement the top-accounts list: size vs. movement."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Up to six accounts</strong>, each with an up or down arrow, the rupee change, and
          the percent change.
        </li>
        <li>
          <strong>A fair comparison.</strong> The prior month is scaled to the days elapsed so
          far — ten days into the month, this month&rsquo;s ten days are compared against last
          month&rsquo;s first ten-days-equivalent, not the whole month. The card footnotes this:
          "vs last month, scaled to elapsed days".
        </li>
        <li>
          <strong>"new" tag</strong> — an account with no prior-month revenue shows{" "}
          <em>new</em> instead of a percentage, because any percent against zero would be
          meaningless.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Click a mover</strong> — navigates to that account&rsquo;s profile, where the
          briefing and API breakdown usually explain the move (a new API ramping, a price change,
          traffic going quiet).
        </li>
        <li>
          <strong>Hover a truncated name</strong> — long account names reveal in full on hover.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Not enough history</strong> — with no prior month to compare against, the card
          says "Not enough history to compare with last month." rather than inventing a ranking.
        </li>
        <li>
          <strong>Sandbox excluded</strong> — movers respect the sandbox toggle like every other
          dashboard number.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/revenue-dashboard", label: "Revenue dashboard" },
          { href: "/help/features/account-profile", label: "Account profile" },
          { href: "/help/math", label: "Day-scaled comparisons explained" },
        ]}
      />
    </>
  );
}
