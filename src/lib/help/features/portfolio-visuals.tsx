import type { FeatureMeta } from "../types";
import { H2, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "portfolio-visuals",
  title: "Portfolio visuals",
  summary:
    "Two dashboard views of the account book: a revenue-concentration treemap and a growth quadrant plotting size against month-on-month movement.",
  group: "Dashboard",
  role: "all",
  routes: ["/dashboard"],
};

export default function Body() {
  return (
    <>
      <p>
        Beyond the headline KPIs, the dashboard has two visuals that read the account book as a
        portfolio — where the revenue is concentrated, and which accounts are moving.
      </p>

      <H2 id="treemap">Revenue-concentration treemap</H2>
      <p>
        Each account is a tile sized by revenue and labelled with its logo. The treemap makes
        concentration obvious at a glance: whether a handful of accounts carry the month, or revenue
        is spread evenly across many.
      </p>

      <H2 id="quadrant">Growth quadrant</H2>
      <p>
        Accounts are plotted by size against month-on-month movement. The four quadrants separate the
        big-and-growing from the big-but-slipping and the small-but-accelerating — so the accounts
        worth attention stand out from the steady middle.
      </p>

      <Related
        links={[
          { href: "/help/features/revenue-dashboard", label: "Revenue dashboard" },
          { href: "/help/features/biggest-movers", label: "Biggest movers" },
          { href: "/help/features/dashboard-charts", label: "Dashboard charts" },
        ]}
      />
    </>
  );
}
