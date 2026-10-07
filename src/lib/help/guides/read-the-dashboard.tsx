import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, OpenInApp, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "read-the-dashboard",
  title: "Read the dashboard",
  summary: "What every number on the org dashboard means — revenue, pace, money at risk, movers, and volume.",
  group: "Getting started",
  role: "all",
  minutes: 5,
};

export default function Body() {
  return (
    <>
      <p>
        The dashboard is the org-level scorecard: revenue for the selected window, how the month is
        pacing, what is leaking, and which accounts moved the needle. It refreshes itself every 30
        seconds, so the numbers you see are live.
      </p>
      <OpenInApp href="/dashboard" label="Open the dashboard" />

      <Figure
        src="/help/shots/dashboard.png"
        alt="The Ledgerline dashboard headline with revenue, pace, and money at risk"
        caption="Headline revenue, month pace, and the Money at risk panel."
      />

      <H2 id="headline">Headline and pace</H2>
      <Steps>
        <Step title="Check the status bar">
          The subtitle shows the active date range and whether sandbox traffic is included, e.g.
          “2026-06-01 → 2026-06-12 · sandbox excluded”. To see which date the data runs through
          and when the last sync landed, open the Usage sync status page.
        </Step>
        <Step title="Read the headline revenue">
          The large serif figure is revenue for the selected window. The chip next to it is the
          change versus the same number of days last month — day-scaled, so a half-finished month
          compares fairly.
        </Step>
        <Step title="Scan the briefing">
          The briefing paragraph is composed deterministically from the same data — pacing, margin,
          and the amount at risk this month. It is a summary, not a prediction.
        </Step>
        <Step title="Check the pace bar">
          Month pace compares revenue so far against where last month stood at the same point, so
          you can see early whether the month is tracking ahead or behind.
        </Step>
      </Steps>

      <H2 id="risk">Money at risk</H2>
      <p>The risk panel flags revenue that is earning less than it should, in three buckets:</p>
      <ul>
        <li>
          <strong>Revenue leak · unpriced billable pairs</strong> — traffic from account × SKU pairs
          that have no price row, so every unit bills $0.
        </li>
        <li>
          <strong>Silent loss · unmapped log names</strong> — usage whose raw account or SKU name
          could not be matched to the catalog. It earns nothing until resolved in Aliases.
        </li>
        <li>
          <strong>Margin watch · selling below cost</strong> — pairs where the negotiated price is
          below the vendor cost, so each unit loses money.
        </li>
      </ul>
      <Callout variant="tip">
        Each risk bucket has a fix-it guide: see{" "}
        <em>Fix unpriced traffic</em> and <em>Resolve unmapped names</em> in this section of the
        docs.
      </Callout>

      <H2 id="charts">Charts and lists</H2>
      <Figure
        src="/help/shots/dashboard-full.png"
        alt="The full dashboard including trend chart, biggest movers, volume, and top lists"
        caption="The lower half: trend, movers, volume, and the top-7 lists."
      />
      <ul>
        <li>
          <strong>Daily revenue &amp; margin</strong> — daily revenue (accent line) and margin
          (green line) across the window.
        </li>
        <li>
          <strong>Biggest movers</strong> — the accounts whose revenue changed most versus last
          month, with up/down deltas and a “new” tag for first-time billers.
        </li>
        <li>
          <strong>Volume</strong> — daily units as bars, independent of pricing.
        </li>
        <li>
          <strong>Top accounts / Top SKUs by revenue</strong> — the top seven of each; click any row
          to open its detail page.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/guides/filter-by-date-range", label: "Filter by date range" },
          { href: "/help/guides/fix-unpriced-traffic", label: "Fix unpriced traffic" },
          { href: "/help/math", label: "How the numbers are computed" },
        ]}
      />
    </>
  );
}
