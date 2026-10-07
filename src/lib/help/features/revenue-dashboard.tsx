import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "revenue-dashboard",
  title: "Revenue dashboard",
  summary:
    "The org-level scorecard: month-to-date revenue, pacing against last month, projected month-end, and margin against target — all on one screen.",
  group: "Dashboard",
  role: "all",
  routes: ["/dashboard"],
};

export default function Body() {
  return (
    <>
      <p>
        The dashboard is the first screen after sign-in and the answer to one question:{" "}
        <em>how is the month going?</em> It leads with a single landmark number — MTD revenue —
        then qualifies it with pace, projection, and margin so you can tell a good month from a
        merely busy one without opening a spreadsheet.
      </p>

      <Figure
        src="/help/shots/dashboard.png"
        alt="Ledgerline dashboard with MTD revenue headline, month pace bar, margin bullet, and secondary stats"
        caption="The headline card: revenue, pace, margin, and the call-status mix."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>MTD revenue</strong> — the large serif figure. Next to it sits a delta pill
          comparing against the prior month, <em>normalised to elapsed days</em>: ten days into
          June are compared against the first ten days of May, not the whole of May. Green means
          ahead, red behind, grey within ±0.5%.
        </li>
        <li>
          <strong>Briefing</strong> — a one-paragraph plain-language read of the numbers beneath
          the headline (see the <a href="/help/features/briefing-panel">Briefing panel</a> page).
        </li>
        <li>
          <strong>Projected month-end</strong> — a progress bar that extrapolates the current
          run-rate (revenue ÷ elapsed days × days in month) and marks the prior-month benchmark
          as a dashed line. When the selected window already covers the whole period, the label
          switches to <em>Month complete</em> and shows the final figure instead — Ledgerline never
          shows a projection for a finished month.
        </li>
        <li>
          <strong>Margin bullet</strong> — current margin % tracked against target.
        </li>
        <li>
          <strong>Secondary stats</strong> — vendor cost, margin ($ and %), active accounts, and
          total units, plus a compact <em>call status</em> bar showing the
          successful / no-data / failed / in-progress mix.
        </li>
        <li>
          <strong>Status bar</strong> — at the very top, the active date window and whether
          sandbox traffic is excluded. (Data freshness — which date the logs run through and when
          the last sync landed — now lives on the Usage sync status page, not on every page.)
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Change the date window</strong> — the filter row updates every KPI, chart, and
          list on the page. Chips fill in month-to-date or the previous month in one click.
        </li>
        <li>
          <strong>Toggle sandbox traffic</strong> — recomputes everything with or without sandbox
          accounts. The choice persists in a cookie, so it sticks across visits.
        </li>
        <li>
          <strong>Drill down</strong> — every account and SKU row on the page links to its profile;
          "All accounts" jumps to the directory.
        </li>
      </ul>
      <p>
        The page silently refreshes itself roughly every 30 seconds, so a dashboard left open on a
        wall screen stays current without anyone touching it.
      </p>

      <Callout variant="info" title="Sandbox is excluded by default">
        Headline revenue, margin, and every chart exclude sandbox accounts unless you flip the
        toggle (here, or globally in Settings). The status bar always says which mode you are in.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>No usage yet</strong> — KPI tiles show "—" and charts render empty axes; the
          Usage sync status page reports that no sync has run yet.
        </li>
        <li>
          <strong>No prior-month data</strong> — the delta pill disappears rather than showing a
          meaningless percentage, and the pace bar notes "no prior-month data".
        </li>
        <li>
          <strong>Day one of a month</strong> — the projection is a straight-line extrapolation of
          a single day, so treat it as directional until a few days accumulate.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/money-at-risk", label: "Money at risk" },
          { href: "/help/features/dashboard-charts", label: "Dashboard charts" },
          { href: "/help/features/biggest-movers", label: "Biggest movers" },
          { href: "/help/math", label: "How the numbers are computed" },
        ]}
      />
    </>
  );
}
