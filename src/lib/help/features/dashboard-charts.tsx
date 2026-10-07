import type { FeatureMeta } from "../types";
import { H2, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "dashboard-charts",
  title: "Daily charts: revenue, margin & volume",
  summary:
    "Two daily-resolution charts — revenue with margin overlaid, and raw hit volume — plus the call-status mix that explains the difference between the two.",
  group: "Dashboard",
  role: "all",
  routes: ["/dashboard"],
};

export default function Body() {
  return (
    <>
      <p>
        Totals hide shape. The dashboard&rsquo;s charts restore it: a daily revenue line with
        margin overlaid shows <em>when</em> the money came in and at what quality, while the
        volume bars underneath show the raw quantity of API hits behind it. Revenue can hold
        steady while volume shifts — a change in price mix or outcome mix — and only seeing both
        makes that visible.
      </p>

      <Figure
        src="/help/shots/dashboard-full.png"
        alt="Dashboard trend chart with daily revenue and margin lines, and the daily usage volume bar chart"
        caption="The trend card and the daily usage volume card."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Trend card</strong> — one point per day across the selected window. The accent
          line is revenue; the green line is margin. Hovering any day shows the exact figures.
        </li>
        <li>
          <strong>Daily usage volume</strong> — a bar per day of total API hits, with thousands
          abbreviated ("12K"). This is quantity with no pricing applied.
        </li>
        <li>
          <strong>Call status</strong> — a compact breakdown of how hits resolved: successful,
          no-data, failed, in-progress. Because the four outcomes are priced differently, the mix
          here is often the missing explanation when revenue and volume diverge.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Change the date window</strong> — both charts re-render to the filter at the top
          of the dashboard.
        </li>
        <li>
          <strong>Hover for exact values</strong> — tooltips show the date, hits, and rupee
          figures per point or bar.
        </li>
        <li>
          <strong>Cross-read</strong> — a volume spike with a flat revenue line usually means
          unpriced or low-priced traffic; check{" "}
          <a href="/help/features/money-at-risk">Money at risk</a>.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Empty window</strong> — charts render their axes with no series rather than
          collapsing, so a quiet week looks quiet instead of broken.
        </li>
        <li>
          <strong>Today&rsquo;s partial day</strong> — usage lands via the daily sync, so the most
          recent day can restate as in-progress hits settle; the trailing days are re-pulled
          automatically each morning.
        </li>
        <li>
          <strong>Sandbox toggle</strong> — both charts respect the sandbox setting.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/revenue-dashboard", label: "Revenue dashboard" },
          { href: "/help/features/usage-sync", label: "Usage sync" },
          { href: "/help/math", label: "Revenue & margin formulas" },
        ]}
      />
    </>
  );
}
