import type { FeatureMeta } from "../types";
import { H2, Callout, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "briefing-panel",
  title: "Briefing panel",
  summary:
    "A short written narrative on the dashboard, every account profile, and every SKU page — composed deterministically from the same numbers the page shows.",
  group: "Dashboard",
  role: "all",
  routes: ["/dashboard"],
};

export default function Body() {
  return (
    <>
      <p>
        Numbers answer "what"; the briefing answers "so what". On the dashboard, each account
        profile, and each SKU page, a short paragraph reads the figures for you: how the period
        is pacing, where revenue is concentrated, and whether anything is leaking. It exists so
        that someone glancing at a page for ten seconds leaves with the same conclusion as someone
        who studied it.
      </p>

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Dashboard briefing</strong> — pacing against last month, margin trend, and the
          amount currently at risk.
        </li>
        <li>
          <strong>Account briefing</strong> — headline revenue and scale ("drove $X MTD across N
          SKUs on M units"), a concentration warning when a single SKU contributes 60% or more of
          revenue, a leak warning when (account, SKU) pairs have traffic but no pricing, and the
          month-over-month move when it is 5% or larger.
        </li>
        <li>
          <strong>SKU briefing</strong> — the top consumer and their share, margin, and the price
          spread when different accounts pay meaningfully different rates.
        </li>
      </ul>

      <Callout variant="info" title="Deterministic, not generated">
        Briefings are composed by fixed rules from the page&rsquo;s own data — no language model,
        no randomness. The same numbers always produce the same sentence, so a briefing can be
        quoted in a meeting and reproduced later.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Read it first</strong> — it is intentionally placed beside the headline number
          as the fastest summary of the page.
        </li>
        <li>
          <strong>Act on its warnings</strong> — leak sentences correspond to rows on the pricing
          page; concentration sentences to the SKU breakdown below.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Sandbox account</strong> — the briefing says so explicitly and notes the account
          is excluded from headline revenue and margin.
        </li>
        <li>
          <strong>No traffic</strong> — a quiet account gets "has no traffic this period" rather
          than an empty paragraph.
        </li>
        <li>
          <strong>Usage but no revenue</strong> — the briefing flags "produced no billable revenue
          this period — likely missing pricing", which is the cue to open the pricing page.
        </li>
        <li>
          <strong>Small moves stay quiet</strong> — month-over-month changes under 5% are omitted
          to avoid narrating noise.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/account-profile", label: "Account profile" },
          { href: "/help/features/sku-page", label: "SKU page" },
          { href: "/help/features/money-at-risk", label: "Money at risk" },
        ]}
      />
    </>
  );
}
